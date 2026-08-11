# Design — C6: Hintergrundbild, Migrationsfelder, Admin-Bearbeitung

Acht Entscheidungen, jede mit der verworfenen Alternative. Sie wandern wortgleich
in die Köpfe der Migrationen, wie im Repo üblich
(`20260721070000_grant_update_videos.sql` ist die Vorlage).

Fassung 2, nach dem Fremd-Review (`REVIEWS.md`). Die Entscheidungen 6–8 sind aus
diesem Review entstanden; 1–5 sind geblieben, zwei davon korrigiert.

## 1 · Eigener Bucket `covers` statt Präfix in `avatars`

**Entschieden: eigener Bucket `covers`**, `public = true`,
`file_size_limit = 2 MiB` (2 097 152 Bytes), `allowed_mime_types = {image/webp}`.

Der Bucket ist die einzige Stelle, an der sich Größe und Dateityp
**serverseitig** aussprechen lassen. Für das Hintergrundbild ist das keine
Kosmetik: es ist die größere Datei (1500×500 statt 512×512), und die
Begrenzung liegt heute ausschließlich im Client — ein handgebauter Upload
umgeht sie.

**2 MiB, und woher die Zahl kommt:** ein 1500×500-WebP bei Qualität 0,85 liegt
bei 80–250 kB. 2 MiB lässt jedes reale Bild durch und schneidet den Fall ab, in
dem jemand ein 40-MB-TIFF durchreicht.

`on conflict (id) do update` statt `do nothing`: ein bereits bestehender
`covers`-Bucket mit falschen Einstellungen würde sonst konserviert, und der Test
liefe grün gegen eine falsche Konfiguration.

**VERWORFEN: ein Präfix `{uid}/cover-*.webp` im avatars-Bucket.** Billiger — die
drei vorhandenen Policies erlauben es bereits, null neue Policies. Es scheitert
daran, dass die Trennung dann nur eine Namenskonvention wäre, die niemand
durchsetzt, und dass für Hintergrundbilder keine andere Größe zugelassen werden
könnte als für Profilbilder.

**Der Preis, und wie er bezahlt wird.** Drei neue Policies sind drei neue
Stellen für das Aktivierungs-Gate. Die avatars-Policies tragen seit C3
`public.is_activated()` (`20260806080100_activation_gate.sql:453`); die
covers-Policies übernehmen es **wörtlich**, und der pgTAP-Test führt dieselbe
Falltabelle gegen **beide** Buckets. Wer das Gate an einem Bucket ändert, wird
am anderen rot.

**Nicht in diesem Change:** `avatars` nachträglich ein `file_size_limit` geben.
Richtig, aber ein anderer Diff (Folgenotiz).

## 2 · Die legacy-Felder gehören nicht auf `profiles`

**Entschieden: eine private 1:1-Tabelle `public.profile_legacy`**
(`profile_id uuid primary key references profiles(id) on delete cascade`,
`paid_until date`, `legacy_tier text`, `legacy_price numeric(10,2)`,
`legacy_source_id text`). RLS an, **keine** Policy für `authenticated`, **kein**
Grant. Zugriff über `service_role` und die Admin-Funktionen.

**Warum nicht als Spalten auf `profiles`, wie AGE-498 es vorschlägt.** Ein
Spalten-Grant regelt das **Schreiben**. Gelesen wird über `grant select on
public.profiles to authenticated` plus `profiles_select_self_or_discover`, und
die Policy gibt jedem bestätigten `discover`-Mitglied die **volle Zeile** jedes
anderen bestätigten Mitglieds (`20260806080100_activation_gate.sql:75-81`).
`legacy_price` — was jemand gezahlt hat — stünde damit offen. Postgres kennt
kein spaltenweises Leseverbot, wenn Tabellen-SELECT erteilt ist; die Trennung
muss über die Tabelle laufen.

**VERWORFEN: Tabellen-SELECT auf `profiles` entziehen und durch eine
Spaltenliste ersetzen.** Das schlösse die Lücke ohne neue Tabelle und bräche
jede Abfrage im Repo, die `select *` auf `profiles` macht — darunter
`fetchProfileEditorData`.

**Semantik, damit C10 nicht raten muss:** `paid_until` ist der **letzte
eingeschlossene** Tag der bezahlten Mitgliedschaft; `null` heißt **unbekannt**,
nicht „unbefristet". `legacy_price` ist der tatsächlich gezahlte
**Brutto**-Betrag in Euro für die abgelaufene Periode
(500 / 600 / 780 / 840 / 1 080 / 1 200). `legacy_tier` ist die **rohe**
Bezeichnung aus dem Altsystem, unnormalisiert — normalisiert man sie beim
Import, ist die Herkunft weg.

**`legacy_source_id`**: Unique-Index über `nullif(btrim(legacy_source_id), '')`,
partiell auf `is not null`. Ohne das Trimmen kollidieren eine leere und eine
aus Leerzeichen bestehende Kennung nicht, obwohl beide „keine Kennung" bedeuten.

Der Index macht den Import **wiederholbar**, nicht **atomar**: bricht C10
zwischen dem Anlegen des GoTrue-Nutzers und dem Schreiben der legacy-Zeile ab,
bleibt ein Konto ohne Kennung zurück, das der nächste Lauf nicht wiedererkennt.
Das zu lösen ist Aufgabe des Import-Scripts (Kennung vor oder in derselben
Transaktion wie das Profil schreiben) und steht hier, damit C10 es nicht
übersieht.

## 3 · `admin_update_profile(target uuid, patch jsonb)` — Weißliste, statisches SQL

**Die Weißliste steht in der Funktion, nicht im Client.** Erlaubt sind die 16
heute client-schreibbaren Spalten plus `cover_url`, die drei Felder der
Kontaktzeile (`email`, `phone`, `website`) und die vier der legacy-Zeile.
**Nicht** erlaubt: `tier`, `potential_score`, `profile_completion`,
`search_doc`, `activated_at`, `member_number`.

**Ein unbekannter Schlüssel bricht ab.** `patch` kommt aus einem Formular; ein
stillschweigend ignoriertes Feld meldet Erfolg für etwas, das nicht passiert
ist. Ebenso bricht ab, was kein JSON-Objekt ist (`jsonb_typeof(patch) <>
'object'`) und was leer ist.

**Kein dynamisches SQL.** Ein `execute format(...)` über Schlüssel aus einem
jsonb ist die klassische Injektionsfläche in `SECURITY DEFINER`. Stattdessen ein
statisches `update` mit `case when patch ? '<feld>' then … else <feld> end`.

**Und das Dekodieren ist feldweise, nicht einheitlich** — Befund aus dem
Review, und der Grund, warum das nicht ein Suchen-und-Ersetzen ist:

| Art | Felder | Ausdruck |
|---|---|---|
| Text | `name`, `region`, `company`, … | `patch ->> 'name'` |
| Text-Array | `roles`, `competencies`, `videos` | `array(select jsonb_array_elements_text(patch -> 'roles'))` |
| jsonb | `socials` | `patch -> 'socials'` |
| Datum | `paid_until` | `(patch ->> 'paid_until')::date` |
| Zahl | `legacy_price` | `(patch ->> 'legacy_price')::numeric` |
| Bool | `is_public` | `(patch ->> 'is_public')::boolean` |

Ein fehlschlagender Cast **bricht die Funktion ab**, und das ist das gewünschte
Verhalten: `paid_until: "morgen"` darf keine Zeile schreiben. Eine eigene
Fehlermeldung je Feld ist Aufwand ohne Empfänger — der einzige Aufrufer ist ein
Formular, das die Felder bereits typisiert.

JSON-`null` heißt **auf NULL setzen**; Abwesenheit heißt **unverändert**. Das
ist der Unterschied, den `coalesce` nicht abbilden kann und `patch ? 'feld'`
schon.

**VERWORFEN: typisierte Parameter.** Über 20 Parameter, und jedes neue
Profilfeld ändert die Signatur und damit jeden Aufrufer.

**Rechte**: `revoke execute … from public, anon`, `grant execute … to
authenticated`. Die Prüfung sitzt **in** der Funktion — genau so kann ein
Nicht-Admin sie aufrufen und prallt mit einer Ausnahme ab. Das ist die Fläche,
die die Abnahme testet.

## 4 · Der Admin braucht einen LESE-Weg, nicht nur einen Schreib-Weg

**Der wichtigste Befund des Reviews.** Ohne ihn wäre der Change gebaut worden
und hätte am Anlassfall nicht gegriffen.

`profiles_select_self_or_discover` verlangt `activated_at is not null` **am
Zielprofil** (`:79`), und `profiles_public` verlangt dasselbe (`:494-495`). Ein
importiertes, unbestätigtes Mitglied ist damit für **niemanden** sichtbar —
auch nicht für einen Admin, unabhängig von dessen Stufe. Folge: `/p/:id` zeigt
„Profil nicht gefunden", der Bearbeiten-Button erscheint nie, und
`fetchProfileEditorData` bekäme null Zeilen. Der Fall, für den die Fähigkeit
gebaut wird, ist genau der, den sie nicht erreicht.

Deshalb zwei Lesefunktionen, `SECURITY DEFINER`, `is_admin()` im Rumpf:

- **`admin_get_profile(target uuid)`** — Profilzeile, Kontaktzeile und
  legacy-Zeile als ein `jsonb`, an Policy und Gate vorbei, mit derselben
  Weißliste wie der Schreibweg.
- **`admin_find_profile(needle text)`** — sucht über die Login-Adresse
  (`auth.users.email`) und den Namen, gibt höchstens 20 Treffer zurück. Nötig,
  weil es keine Mitgliederliste gibt (AGE-304) und `/p/:id` für unbestätigte
  Profile nicht existiert. Der Admin muss die UUID sonst aus der Datenbank
  holen — also genau das tun, was dieser Change abschaffen soll.

**VERWORFEN: die RLS für Admins öffnen** (`or public.is_admin()` in
`profiles_select_self_or_discover`). Es wäre kürzer und ließe den Bearbeiten-Weg
über `/p/:id` laufen. Verworfen, weil dann ein zweites Mal an einer Policy
steht, was schon in vier Funktionen steht — und weil `profiles_public` davon
gar nicht erreicht würde (die View umgeht die Policies, das ist ihr Zweck).
Ein Admin-Zugang, der an zwei Stellen halb gilt, ist schlechter als einer, der
an einer Stelle ganz gilt.

## 5 · Der Admin-Editor ist der Editor, mit einer Ziel-ID

`ProfilPage` trennt schon heute sauber: `ProfilPage` liest `user.id`,
`ProfileEditor({ uid })` kennt nur eine ID. Der Fremd-Modus gibt eine andere ID
hinein und schaltet **beide** Wege um: Lesen über `admin_get_profile`,
Schreiben über `admin_update_profile`.

**Route**: `/admin/mitglied/:id` hinter `RequireAdmin` — **nicht**
`/p/:id/bearbeiten`. Der Grund ist Entscheidung 4: `/p/:id` existiert für
unbestätigte Profile nicht, und eine Bearbeiten-Route unter einer Seite, die
404 liefert, ist eine Sackgasse. Der Einstieg ist `/admin` mit einem Suchfeld
(`admin_find_profile`); zusätzlich steht auf `/p/:id` ein Bearbeiten-Button für
die Profile, die dort **sichtbar** sind.

**Im Fremd-Modus ausgeblendet**: Avatar und Cover (die Bucket-Policies verlangen
die `auth.uid()` des Aufrufers — ein Admin-Upload prallt ab), Interessen, Ziele,
Kompass-Kategorien. **Zusätzlich sichtbar**: `paid_until`, die drei
`legacy_*`-Felder, die Kontaktadresse und die Login-Adresse.

**Der Button ist Komfort, nicht die Grenze.** Die Grenze ist `is_admin()` im
Rumpf. Beides wird getestet, getrennt: der Button per Vitest, die Abwehr per
pgTAP mit einem direkten RPC-Aufruf als normales Mitglied.

**VERWORFEN: ein zweites Admin-Formular.** Es müsste jedes Feld ein zweites Mal
kennen und würde beim nächsten neuen Profilfeld still veralten.

## 6 · `admin-change-email` als Edge Function — und was sie nicht leistet

Muster: `redeem-activation`. `verify_jwt = true`, damit das Gateway die Signatur
prüft.

**Die Aufruferkennung kommt aus dem Token, nicht aus `getUser()`.** Prod
signiert seit dem 16.07. mit asymmetrischen Schlüsseln (ES256); dort scheitern
in Edge Functions **sowohl** `getUser()` **als auch** `getClaims()`. Gangbar
ist, `sub` aus dem vom Gateway bereits verifizierten JWT zu lesen — so macht es
`create-checkout-session` seit AGE-259.

Ablauf: `sub` lesen → mit `service_role` gegen `staff_roles` prüfen → sonst 403
→ `auth.admin.updateUserById(target, { email, email_confirm: true })` →
`public.revoke_sessions(target)` → `admin_audit`-Zeile.

**`email_confirm: true`** ist notwendig und der Grund für Admin-only: die neue
Adresse gilt sofort, ohne Bestätigungsmail an ein Postfach, an das das Mitglied
gerade **nicht** herankommt. Genau das ist der Fallback-Zweck.

**Was `revoke_sessions` NICHT leistet** — Befund aus dem Review, und die
Funktion sagt es in ihrem eigenen Kopf: ein bereits ausgegebener Access-Token
ist zustandslos und bleibt bis `jwt_expiry` gültig, **derzeit 3600 Sekunden**.
Gelöscht werden Sitzung und Refresh-Token; damit ist die Erneuerung weg, nicht
das laufende Token. Diese Restfläche wird **benannt**, nicht geschlossen — sie
zu schließen hieße, `jwt_expiry` zu senken oder in jeder Policy gegen
`auth.sessions` zu joinen. Die Zusage lautet deshalb „keine neue Anmeldung mit
der alten Adresse", nicht „sofort abgemeldet".

**Die Aufrufreihenfolge ist Teil der Zusage.** `updateUserById` **vor**
`revoke_sessions`: umgekehrt entstünde ein Fenster, in dem die Sitzungen weg
sind und die Adresse noch die alte ist. Schlägt `revoke_sessions` nach
erfolgreichem `updateUserById` fehl, ist die Adresse geändert — die Antwort
SHALL das unterscheidbar melden und nicht als Gesamtfehler ausgeben, sonst
wiederholt der Admin eine Änderung, die längst gilt. Ein Test hält die
Reihenfolge fest.

**VERWORFEN: `update auth.users` aus einer `SECURITY DEFINER`-Funktion.** Die
Adresse steht ein zweites Mal in `auth.identities.identity_data`. Ein Update nur
auf `auth.users` hinterlässt das Konto in einem Zustand, den GoTrue nicht kennt.

## 7 · Login-Adresse und Kontaktadresse sind zwei Dinge

Korrektur aus dem Review: **`public.profiles.email` existiert nicht.** Die Zeile
`email text` in `20260611115655_community_foundation.sql:38` gehört zum
`create table public.profile_contacts`.

Und `profile_contacts.email` ist **nicht tot**:
`supabase/functions/notify-contact-request/index.ts:103` liest sie mit
`service_role`, `src/lib/contact-requests.ts:176` nach angenommener
Kontaktanfrage.

Damit hat der Fallback eine zweite Hälfte, die vorher fehlte: Wird nur die
Login-Adresse geändert, gehen **Benachrichtigungen weiter an das alte,
unerreichbare Postfach**. Deshalb schreibt `admin_update_profile` die
Kontaktzeile mit (`upsert` auf `profile_contacts`), und die Oberfläche zeigt
beide Adressen nebeneinander mit dem Hinweis, was welche tut.

**Sie werden NICHT automatisch gleichgesetzt.** Ein Mitglied darf sich mit einer
Adresse anmelden und unter einer anderen erreichbar sein; das ist der Zweck der
Trennung von `profile_contacts` („never auto-disclosed"). Eine stille
Synchronisierung nähme diese Wahl weg.

## 8 · Audit-Log jetzt, nicht später

Beide Reviewer haben es unabhängig als HIGH gemeldet, und die frühere Fassung
schob es auf („später lässt sich dort ein Audit-Log anhängen"). Ein Admin ändert
mit diesen beiden Wegen Sichtbarkeit, Identität, bezahlte Laufzeiten und Preise
— ohne Spur, wer wann was.

`public.admin_audit` (`id`, `actor uuid`, `action text`, `target uuid`,
`payload jsonb`, `at timestamptz default now()`), RLS an, Lesen nur für
`is_admin()`, kein INSERT-Grant für `authenticated` — geschrieben wird
ausschließlich aus den `SECURITY DEFINER`-Funktionen und aus der Edge Function.

`payload` hält den **Patch**, nicht die ganze Zeile: der Vorher-Zustand ist über
die Migrationshistorie nicht rekonstruierbar, und ein vollständiger
Zeilen-Schnappschuss verdoppelt bei jedem Speichern das Profil in eine Tabelle,
die niemand aufräumt. Was geändert werden sollte, reicht, um eine Änderung
nachzuvollziehen.

**VERWORFEN: als go-live-Risiko notieren und nichts bauen.** Der Aufwand ist
eine Tabelle und je zwei Zeilen in drei Funktionen. Bei zwei unabhängigen
HIGH-Befunden ist das die falsche Sparsamkeit.
