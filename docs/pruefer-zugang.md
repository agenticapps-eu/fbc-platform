# Prüfer-Zugang für App Store und Play Console

**Entschieden am 2026-09-13 von Donald: Weg 1 — der Prüfer bekommt ein normales
Mitgliedskonto und sieht die echte Gemeinschaft.**

Dieses Dokument hält fest, was daraus folgt, was ein Prüfer tatsächlich zu sehen
bekommt, und trägt den Text, der in die Prüfhinweise beider Stores eingesetzt
wird. Es ersetzt `demo-zugang.md`, das seit dem Spiegel (AGE-576) historisch ist.

> ⚠️ **Keine Zugangsdaten in dieser Datei.** Das Repository ist öffentlich.
> Kennung und Kennwort des Prüferkontos gehören nach Infisical, nicht hierher —
> und nicht in die Commit-Historie.

## Was entschieden wurde, und was es kostet

Die Abnahmezeile in AGE-644 lautete ursprünglich „*Prüfer-Zugang funktioniert,
ohne echte Mitgliederdaten preiszugeben*". **Diese Zusage ist nicht einlösbar**,
und das ist der Grund für die Entscheidung, nicht ein Versäumnis daran.

Gemessen am 2026-09-12/13:

- Es gibt **keine Mandantentrennung**. `tenant`, `mandant`, `workspace_id`,
  `org_id` kommen in `supabase/migrations/` und `src/` null Mal vor.
- **Die Stufe ist kein Werkzeug.** Feed und Events lesen über
  `visibility in ('public','members')` — jedes angemeldete Konto sieht sie, auf
  `active` genauso wie auf `impact`.
- **Namen maskiert nur die Aktivierung, nicht die Stufe.**
  `resolve_display_name` gibt `'Mitglied'` zurück, wenn `is_activated()` falsch
  ist; ein aktiviertes Konto sieht Klarnamen auf **jeder** Stufe.
- **Auf DEV ausweichen geht nicht.** DEV trägt seit AGE-576 die echten
  Mitglieder aus PROD; 0 von 72 Konten sind Demo-Konten.

**Die Folge, ausgesprochen:** Ein Prüfer bei Apple und ein Prüfer bei Google
sehen Namen, Profilbilder, Beiträge und Veranstaltungen echter Mitglieder. Das
ist eine Offenlegung gegenüber Dritten, für die es eine Rechtsgrundlage braucht —
und es ist eine Entscheidung über rund 70 Menschen, die bewusst getroffen wurde,
nicht ein technischer Nebeneffekt. Wer sie später anders bewerten will, findet
die verworfenen Alternativen unten.

## Was der Prüfer sieht — nach Fläche

| Fläche | Tor im Code | Was ein aktiviertes Konto sieht |
| --- | --- | --- |
| `/aktivitaet` (Feed) | **keins** (`src/config/nav.ts:107`) | Beiträge, Klarnamen, Bilder, Kommentare |
| `/events` | **keins** (`src/config/nav.ts:87`) | Veranstaltungen, Gastgeber, Anmeldungen |
| `/mitglieder` (Liste) | `discover` (Rang 4) | Name, Bild, Region, Firma, Kurzbio, Branche, Rollen |
| Kompetenzen, Suchen/Bieten | `discover` (Rang 4) | **dieselbe Schwelle** — seit AGE-903 gibt es keine zweistufige Trennung mehr |
| `/academy` | `discover` (Rang 4) | seit AGE-903; vorher trug sie gar keine Stufenprüfung |
| Kontaktdaten | Kontaktanfrage | nie automatisch — unverändert |
| Chat | akzeptierte Kontakte | ein neues Konto hat keine |

## Welche Stufe das Prüferkonto bekommt: `discover` (Rang 4)

**Die unterste Clubstufe — nicht `active` und nicht `impact`.**

Seit AGE-903 (26.09.2026) lautet die Leiter `active`(1) · `boost`(2) ·
`connect`(3) · `discover`(4) · `focus`(5) · `impact`(6), und **der FBC beginnt
bei `discover`**. Die Entscheidung vom 13.09. — „die kleinste Stufe, die eine
vollständig wirkende App zeigt" — trifft damit `discover`:

- **Nicht `active`, `boost` oder `connect`:** dort fehlen Mitgliederliste und
  Academy. Eine App, in der zwei Hauptmenüpunkte ins Leere laufen, lädt zu genau
  der Ablehnung nach Richtlinie 4.2 ein, die dieses Vorhaben ohnehin fürchtet.
- **Nicht `impact`:** der Unterschied zu `discover` liegt heute in keinem Gate —
  jede Clubschwelle lautet `has_level(4)`. `impact` brächte also keinen weiteren
  Einblick, nur eine höhere Stufe im Profil.
- **`discover`** zeigt eine vollständig wirkende App und ist die kleinste Stufe,
  die das leistet.

Reicht es wider Erwarten nicht, ist das Hochsetzen ein Feldwechsel in
`profiles.tier` und **ohne Neuanmeldung wirksam** — die Prüfung muss dafür nicht
neu beginnen.

### Das Konto EXISTIERT seit dem 26.09. — und steht bis `migrate-prod` auf `exchange`

Angelegt am 26.09.2026 auf PROD, **vor** der AGE-903-Migration und deshalb auf
dem Schlüssel, der die unterste Clubstufe der HEUTIGEN Leiter ist: `exchange`
(Rang 4, 300 €). Entscheidung Donald, weil die externe TestFlight-Gruppe
Benutzername und Kennwort als Pflichtfeld verlangt und die Mitglieder-Beta sonst
gestanden hätte.

**Es wandert von selbst mit.** Die Key-Migration hängt die Kohorte
`connect` · `discover` · `exchange` geschlossen nach `discover` um; das Konto
landet also ohne Sonderregel auf dem neuen Rang 4. Es braucht dafür keine Zeile
in der Migration und keinen Handschritt danach — nur die Gegenprobe unten.

| | |
|---|---|
| Adresse und Kennwort | Infisical `prod`: `STORE_REVIEW_LOGIN`, `STORE_REVIEW_PASSWORD` |
| Stufe | `discover`, Rang 4 — **gemessen am 26.09. nach `migrate-prod`** |
| Stufe davor | `exchange`, Rang 4 (gleiche Stufe, alter Name) |
| `is_public` | `false` — das Konto ist kein Mitglied und gehört nicht ins Verzeichnis |

Wie es angelegt wurde, und warum nicht über den Aktivierungslink: der gebaute
Weg setzt einen Menschen voraus, der den Link einlöst und sich dabei SELBST ein
Kennwort setzt. Hier muss das Kennwort **bekannt** sein, weil es in eine
Prüfmaske gehört. Gewählt wurde deshalb der zweite der beiden dokumentierten
Wege: anlegen mit `email_confirm: true` und ohne Kennwort im Rumpf, dann
`PUT /auth/v1/admin/users/{id}` mit dem Kennwort. `activated_at` ist gesetzt,
und das ist hier unbedenklich — die Einbahnstraße aus der Warnung unten greift
nur, solange jemand auf den Zugangslink angewiesen ist.

**Abgenommen wurde mit einer echten Anmeldung, nicht mit dem 200 des Setzens**
(26.09.): Token über den ANON-Schlüssel wie in der App, danach unter der eigenen
Identität 28 Vollprofile, 27 Verzeichniszeilen, 7 Events, 40 Beiträge,
`search_directory` 27 Zeilen.

**Nachgesehen am 26.09., nach `migrate-prod`** — eine Zeile, und sie prüft am
Rang statt am Namen:

```sql
select p.tier, m.level_rank
  from public.profiles p
  join public.membership_tiers m on m.key = p.tier
 where p.name = 'App Store Pruefer';
-- gemessen: discover | 4
```

**Ergebnis: `discover` | `4`**, `is_public = false`, aktiviert. Das Konto ist
ohne Sonderregel mitgewandert, wie geplant — die Key-Migration hat die Kohorte
`connect`·`discover`·`exchange` geschlossen nach `discover` umgehängt. Es
brauchte keine Zeile in der Migration und keinen Handgriff danach.

### ⚠ Die Falle ist der Schlüsselname, nicht der Rang

Dieser Abschnitt hiess bis AGE-903 „Nach AGE-903 heisst diese Stufe DISCOVER —
und der Wechsel ist Pflicht". Der Wechsel ist vollzogen; die Warnung bleibt, weil
sie jetzt erst recht gilt.

**`discover` bezeichnet inzwischen in drei Modellen etwas anderes:** im
Prototyp-Modell die kostenlose Einstiegsstufe, ab AGE-311 die erste bezahlte
(Rang 3, 150 €), seit AGE-903 die unterste Clubstufe (Rang 4, 300 €). Dasselbe
gilt für `connect`: Rang 2 ab AGE-311, Rang 3 seit AGE-903 — und damit
**ausserhalb** des Clubs.

Wer in einem älteren Dokument „`connect`" liest und es einträgt, setzt das Konto
heute auf Rang 3 und damit vor genau die Wände, die dieses Dokument vermeiden
will. Genau diese Verwechslung ist hier schon zweimal passiert.

**Prüfe deshalb am RANG, nicht am Namen:**

```sql
select p.tier, m.level_rank
  from public.profiles p
  join public.membership_tiers m on m.key = p.tier
 where p.id = '<uuid des prueferkontos>';
-- erwartet: discover | 4
```

## Der Text für die Prüfhinweise

Apple liest App Store Connect → App Review Information → Notes. Google liest
Play Console → App content → App access. **Englisch**, weil beide Prüfteams
international besetzt sind.

```text
FBC Community is a members-only app for an existing German business
association. Membership is granted offline; there is no public sign-up, so a
reviewer cannot create a working account without the credentials below.

Review account
  Username: <Infisical prod, STORE_REVIEW_LOGIN>
  Password: <Infisical prod, STORE_REVIEW_PASSWORD>

This is a real member account on the production system. The content it shows —
posts, events, member profiles — is genuine association content, not sample
data. Please treat it as confidential and do not share it.

Native capabilities to look at
  · Push notifications  — Settings → Notifications, then a new post or a direct
    message triggers a delivery. Requires accepting the system prompt on first
    launch.
  · Camera and photo library — Profile → edit → change picture, and the "add
    image" control when composing a post.
  · Deep links — links to app.effbeezee.com/… open directly in the app rather
    than in the browser.
  · Account deletion — Settings → Delete account, in-app and immediate, per
    App Store Review Guideline 5.1.1(v).

The app is not a repackaged website: it ships native push, camera access and
verified universal/app links, and it has no browser chrome or "open in browser"
affordance.
```

Bei Google gehört zusätzlich in **App access** die Angabe, dass *alle*
Funktionen hinter der Anmeldung liegen — sonst fragt die Prüfung nach.

## Vor dem Einreichen

1. **Konto anlegen und aktivieren.** Die Aktivierung ist nicht optional: ohne
   sie gibt `resolve_display_name` für jedes Mitglied `'Mitglied'` zurück, und
   der Prüfer hält die App für kaputt.
   ⚠️ Wird das Konto über `POST /auth/v1/admin/users` angelegt, muss
   **`email_confirm: true`** gesetzt sein. Ohne das Flag setzt der
   Aktivierungslink zwar das Kennwort (200), die Anmeldung scheitert danach aber
   mit `400 email_not_confirmed` — der Fehler zeigt sich erst *nach* der
   Aktivierung und sieht nicht nach seiner Ursache aus.
2. **Stufe auf `discover` setzen** (`profiles.tier`, Rang 4 — am Rang prüfen,
   siehe die Warnung oben). Achtung: `on_auth_user_created`
   legt die Profilzeile bereits beim Anlegen mit `tier = 'active'` an (bis
   AGE-903: `'basic'`). Ein
   `insert … on conflict do update` muss `tier` deshalb im `do update set`
   führen — eine Spalte, die nur in der Einfügeliste steht, kommt nie an.
3. **Kennung und Kennwort nach Infisical**, nicht ins Repository und nicht in
   die Commit-Historie.
4. Beide Notiz-Felder mit dem Text oben füllen.

## Nach der Veröffentlichung

Das Konto **nicht stehen lassen.** Es ist ein aktiviertes Mitgliedskonto mit
Lesezugriff auf die Gemeinschaft. Nach der Freigabe abschalten (`disabled_at`)
und bei der nächsten Einreichung neu aktivieren. Ein Prüfkonto, das zwischen
zwei Einreichungen ein Jahr offen steht, ist eine Tür, an die niemand mehr denkt.

## Verworfene Alternativen — nicht neu aufrollen

Am 2026-09-13 gegen den gemessenen Stand geprüft und verworfen:

| Weg | Warum nicht |
| --- | --- |
| **Demo-Sicht im Schema** (`demo`-Spalte, Partition in der RLS) | **44 Lese-Policies** auf `posts` (8), `events` (7), `event_registrations` (7), `comments` (6), `profiles` (5), `post_media` (4), `post_saves` (4), `post_likes` (3), dazu **21 auf `storage.objects`** und die DEFINER-Sicht `profiles_public`, die die RLS umgeht. Kein Flaschenhals zum Abkürzen: `feed.ts` und `events.ts` lesen die Tabellen **direkt**, nur das Verzeichnis geht über `search_directory`. Großer Change plus Fremdreviewer — für eine Fläche, die eine Person einmal sieht |
| **Zweite Supabase-Instanz** | Der Prüfer lädt dieselbe Binärdatei wie die Mitglieder, und die zeigt auf PROD. Ein Konto woandershin zu routen hieße, eine anmeldungsabhängige Endpunkt-Weiche ins Produktivbinary zu bauen — eine Hintertür, die man nie wieder los wird |
| **Demo-Modus im Client** | Verstößt gegen das Kernprinzip „Frontend ist Komfort, nicht Sicherheitsgrenze": mit dem Token dieses Kontos bleiben die echten Daten über die API erreichbar. Es verbirgt, es verhindert nicht |
| **Leeres Konto** | Richtlinie 4.2. Eine App ohne sichtbaren Inhalt ist der Standardfall für eine Ablehnungsrunde |
