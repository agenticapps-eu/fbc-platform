## Why

Linear: **AGE-498** (C6 des eff.bee.zee-Go-Live).

Dieser Change **bereitet die Migration vor, ohne sie durchzuführen**. Das Ziel
ist eng und prüfbar: **nach C6 fehlt für C10 keine Schema-Änderung mehr.** (Die
frühere Formulierung „dann fehlt nur noch ein Import-Script" war zu stark — was
beim Ablauf von `paid_until` geschieht, ist eine Abrechnungsentscheidung und
bleibt offen. Sie ist nach C6 nur nicht mehr durch fehlende Felder blockiert.)

Drei Lücken schließt er:

1. **`paid_until` fehlt, und damit Detlevs Bestandsschutz.** Die Zusage lautet:
   alle Bestandsmitglieder bekommen `impact`, aber nur bis zum Ablauf der
   bereits bezahlten Mitgliedschaft. Dieses Datum steht heute ausschließlich im
   alten WordPress-System. Wird es beim Import nicht mitgeschrieben, ist es
   danach **nicht rekonstruierbar** — niemand weiß mehr, wann wer neu
   entscheiden muss, und `tier = 'impact'` sieht für alle gleich dauerhaft aus.
   Der Verlust fällt nicht beim Import auf, sondern Monate später.
2. **Das Hintergrundbild fehlt komplett.** Das Mockup vom 29.07. zeigt es
   prominent; `ProfileHero` nimmt bereits ein `coverUrl` entgegen und
   dokumentiert dazu „Upload vorbereitet, noch kein Storage-Backend". Es gibt
   weder Spalte noch Bucket.
3. **Ein Admin kann kein fremdes Profil bearbeiten.** Nach dem Import sind ~70
   Konten fremdbefüllt; jeder Tippfehler und jede Rückfrage landet sonst per
   Hand in der Datenbank. Der Sonderfall, der es dringend macht, ist der
   Fallback aus C3: kommt ein Mitglied nicht mehr an sein altes Postfach, ist
   es **dauerhaft ausgesperrt**, solange niemand seine Login-Adresse ändern
   kann.

## What Changes

- **`profiles.cover_url text`** — die einzige neue Spalte auf `profiles`, und
  die einzige neue Spalte im Client-UPDATE-Grant.
- **Neue private Tabelle `public.profile_legacy`** (1:1 zu `profiles`) mit
  `paid_until date`, `legacy_tier text`, `legacy_price numeric`,
  `legacy_source_id text`. **Kein Client-Grant, RLS an, für Mitglieder
  unsichtbar.** `legacy_source_id` bekommt einen partiellen Unique-Index über
  den getrimmten Wert, damit der Import wiederholbar ist.
- **`cover_url` wird an `profiles_public` angehängt.** Ohne das rendert das
  Hintergrundbild auf `/p/:id` nie — die Seite liest die öffentliche
  Projektion. **Angehängt, nicht eingefügt**: `create or replace view` erlaubt
  neue Spalten nur am Ende.
- **Neuer Storage-Bucket `covers`** mit drei Policies nach dem Muster von
  `avatars_insert_own` / `_update_own` / `_delete_own` — inklusive
  `is_activated()`, das die avatars-Policies seit C3 tragen.
- **Vier `SECURITY DEFINER`-Funktionen** statt einer: `admin_update_profile`
  (schreiben), `admin_get_profile` und `admin_find_profile` (lesen — ohne die
  ist der Anlassfall unerreichbar, siehe unten), und der Audit-Schreiber.
- **Tabelle `public.admin_audit`**, von beiden Schreibwegen befüllt.
- **Edge Function `admin-change-email`** ändert die Login-Adresse in
  `auth.users`. Das geht nicht aus der Datenbank heraus.
- **Frontend**: `AvatarCropper` bekommt ein Seitenverhältnis (3:1) und wird
  wiederverwendet; der bestehende Profil-Editor wird mit einer Ziel-ID
  wiederverwendet; die Profilansicht folgt dem Mockup.

### Warum keine Admin-Policy, sondern eine Funktion

Das ist der wichtigste technische Punkt dieses Changes, und er ist eine
Falle, in die man genau einmal tappt.

`public.profiles` trägt **spaltenweise** UPDATE-Grants — heute 16 Spalten für
`authenticated` — **zusätzlich** zur Policy `profiles_update_own`. Postgres
prüft das Grant **vor** der Policy. Eine zusätzliche Policy
`profiles_update_admin` wäre also vollständig wirkungslos: der Admin liefe trotz
passender Policy in `permission denied for table profiles`, und zwar erst zur
Laufzeit. Wer es „reparieren" wollte, müsste den Client-Grant aufmachen — und
damit für **jedes** Mitglied, nicht nur für Admins.

Die `SECURITY DEFINER`-Funktion läuft als ihr Eigentümer und geht an Grant
**und** Policy vorbei. Drei Folgen, alle erwünscht: die Client-Grant-Fläche
bleibt unverändert bis auf `cover_url`; Admin-Schreibrechte sind an genau einer
Stelle definiert; das Audit-Log hängt im Rumpf, nicht in einer Policy.

### Warum der Admin auch einen LESE-Weg braucht

Aus dem Fremd-Review, und es hätte den Change sonst unbrauchbar gemacht:

`profiles_select_self_or_discover` verlangt `activated_at is not null` **am
Zielprofil**, und `profiles_public` verlangt dasselbe. Ein importiertes,
**noch nicht bestätigtes** Mitglied ist damit für niemanden sichtbar — auch
nicht für einen Admin. `/p/:id` zeigt „Profil nicht gefunden", der
Bearbeiten-Button erscheint nie, und `fetchProfileEditorData` bekäme null
Zeilen.

Das ist **genau der Fall**, für den die Fähigkeit gebaut wird. Ein Schreibweg
ohne Lesepfad wäre ein Werkzeug, das nur an den Profilen greift, die es nicht
braucht. Deshalb: `admin_get_profile(target)` liest die Zeile am Gate vorbei,
und `admin_find_profile(needle)` findet sie über E-Mail oder Name, weil es
keine Mitgliederliste gibt und `/p/:id` für unbestätigte Profile nicht existiert.

### Warum die legacy-Felder nicht auf `profiles` liegen

Ebenfalls aus dem Review. `authenticated` hält **Tabellen-SELECT** auf
`public.profiles`, und `profiles_select_self_or_discover` gibt jedem
bestätigten `discover`-Mitglied die **volle Zeile** jedes anderen bestätigten
Mitglieds. Ein Spalten-Grant regelt nur das **Schreiben**. `legacy_price` —
was jemand tatsächlich gezahlt hat — stünde damit für jedes Mitglied ab der
zweiten Stufe im Klartext.

Postgres kennt kein spaltenweises Leseverbot bei erteiltem Tabellen-SELECT.
Die Trennung muss deshalb über die Tabelle laufen: `public.profile_legacy`,
1:1, RLS an, ohne jedes Client-Grant. Das weicht von der Feldliste in AGE-498
ab — bewusst, und der Import schreibt dieselben vier Werte, nur woanders hin.

### Was der Admin-Editor NICHT kann (bewusst)

`admin_update_profile` schreibt die **Profilzeile**, die **Kontaktzeile**
(`profile_contacts`) und die **legacy-Zeile**. Interessen, Ziele und die
Kompass-Kategorien bleiben draußen: sie liegen in eigenen Tabellen mit
`profile_id = auth.uid()`-Policies, und der Grund für C6 ist die Korrektur
importierter Stammdaten, nicht das Führen fremder Ziele. Mehr ist AGE-304.

**Auch die Medien bleiben draußen.** Avatar und Cover laden nach
`{uid}/…`, und beide Bucket-Policies verlangen die `auth.uid()` **des
Aufrufers**. Ein Admin, der ein fremdes Bild hochlädt, prallt an der Policy ab.
Statt einen serverseitigen Umweg zu bauen, blendet der Editor die
Medien-Steuerung im Fremd-Modus aus.

### Warum die E-Mail-Änderung eine Edge Function braucht

Die Login-Adresse steht in `auth.users` und wird von GoTrue verwaltet. Ein
direktes `update auth.users` — auch aus einer `SECURITY DEFINER`-Funktion —
ließe `auth.identities` zurück, wo dieselbe Adresse ein zweites Mal in
`identity_data` steht. Der einzige unterstützte Weg ist die Admin-API
(`updateUserById`), und die braucht `service_role`.

**Login-Adresse und Kontaktadresse sind zwei Dinge.** Die eine steht in
`auth.users`, die andere in `profile_contacts.email` — und die ist **nicht
tot**: `notify-contact-request` und `src/lib/contact-requests.ts` lesen sie.
Wird nur die Login-Adresse geändert, gehen die Benachrichtigungen weiter an das
Postfach, an das das Mitglied gerade nicht herankommt. Deshalb schreibt
`admin_update_profile` die Kontaktzeile mit, und die Oberfläche zeigt beide
Adressen nebeneinander.

*(Eine frühere Fassung dieses Abschnitts berief sich auf eine tote Spalte
`profiles.email`. Die gibt es nicht — die zitierte Zeile gehört zu
`profile_contacts`.)*

## Impact

- **Specs**: `member-profiles` (ADDED + MODIFIED), `admin` (ADDED + MODIFIED)
- **Migrationen** (4, forward-only): `cover_url` + Grant + View · `profile_legacy`
  · `covers`-Bucket + Policies · `admin_audit` + die vier Admin-Funktionen
- **Edge Function** (1, neu): `admin-change-email`
- **Frontend**: `AvatarCropper`, `ProfileHero`, `ProfilPage`,
  `ProfilAnsichtPage`, `PublicProfilePage`, `src/lib/profile.ts`,
  `src/lib/public-profile.ts`, `src/lib/dashboard.ts`, `App.tsx`
- **Tests**: `rls_test.sql` (Bucket-Pfade, RPC-Abwehr, Lesbarkeit von
  `profile_legacy`), `grants_test.sql` (**Golden-Snapshot muss `cover_url`
  aufnehmen, sonst wird der CI-migrations-Job rot**), Vitest, ein
  DEV-Integrationslauf für die Edge Function
- **Generiert**: `src/lib/database.types.ts` neu ziehen

## Non-Goals

- **Befüllung** der neuen Felder — C10.
- **Was beim Ablauf von `paid_until` geschieht** — Abrechnung, C10/`billing-upgrades`.
  Hier wird nur die Bedeutung des Feldes festgelegt.
- **Vollständige Admin-Konsole** (Mitgliederliste, Massenmail) — AGE-304.
- **Medien in Aktivitäten** — C7.
- **Kein Aufmachen des Client-Grants** über `cover_url` hinaus.
- **Keine zweite Kategorienliste.** „Ich biete" / „Ich suche" lesen `offers` / `needs`.
