## Why

Linear: **AGE-531** (C8 des eff.bee.zee-Go-Live).

Die Event-**Mechanik** ist fertig und wird hier nicht angefasst: Anmeldung über
`register_for_event`, Warteliste bei voller `capacity`, Check-in über
`set_event_check_in`, Bewertung 1–5, drei Reiter. Was fehlt, ist der **Inhalt**.
Ein Event trägt heute Titel, Typ, einen Startzeitpunkt, einen Ort — und sonst
nichts. Detlev im Meeting: „Du hast die Beschreibung von dem Event. Das ist
wichtig, das haben wir nämlich im Moment noch nicht" und „Wir brauchen für jedes
Event einen Header und ein von bis Event."

Referenz sind die beiden Mockups vom 29.07. aus dem Dropbox-Ordner
`Ausarbeitungen 2026-07-29`, im Repo abgelegt als
`docs/mockups/eventuebersicht-2026-07-29.png` und
`docs/mockups/event-detail-2026-07-29.png`.

### Was AGE-531 anders annimmt als die Datenbank

Vor dem Planen gegen **DEV** (`foelowldexkcqzewvrcf`) gemessen, read-only:

- **`starts_at IS NULL` gibt es nicht** — 9 Events, 0 ohne Termin. Die Spalte
  kann `not null` werden.
- **`prime` und `legacy` sind längst weg.** AGE-531 verlangt, sie aus
  `events_visibility_check` zu entfernen; sie stehen dort seit dem **15.07.**
  nicht mehr. `20260715150000_six_level_model.sql:284–287` hat Bestand
  umgeschrieben und den Check ersetzt, für `posts` gleich mit. Gemessen:
  `CHECK (visibility = ANY (ARRAY['public','members']))`, Bestand 8× `members`
  / 1× `public`. **Diese Teilaufgabe entfällt ersatzlos**, samt ihres
  Abnahmepunkts. Vermutlich wurde die Juni-Definition gelesen;
  `src/lib/events.ts:6` verweist bereits auf die Juli-Fassung.
- **Die Übersicht ist heute zwei Kacheln breit, nicht vier**
  (`EventsList.tsx:135`, `sm:grid-cols-2`). Das Mockup zeigt vier, die
  Entscheidung vom 03.08. sagt drei. „Drei statt vier" ist gegenüber dem Code
  also eine Erhöhung, keine Reduktion — das Ziel bleibt drei.
- **Die Übersicht im Mockup zeigt keine Teilnehmer-Avatare**, sondern die Zahl
  („63 nehmen teil"). Avatare stehen nur auf der Detailseite. Die
  Sichtbarkeitsfrage betrifft daher **nur die Detailseite**; die Zahl liefert
  `event_registration_counts` seit AGE-251.

### Die Entscheidung, an der dieser Change hängt

Heute sieht die Teilnehmerliste nur der Veranstalter und man selbst
(`regs_select_self_or_host`). Das Mockup zeigt Gesichter, und Detlev will genau
das: „Und dadurch weiß man auch schon, wer kommt denn alles."

**Entschieden am 2026-08-12: Variante 2 — jedes aktivierte Mitglied, das das
Event sehen darf, sieht die Angemeldeten.** Nicht nur Mitangemeldete
(Variante 1: erfüllt Detlevs Satz nicht, denn „vorher sehen" heißt vor der
eigenen Anmeldung) und nicht nur die Zahl (Variante 3: ändert nichts).

**Gebaut wird sie als `SECURITY DEFINER`-RPC, nicht als geöffnete Policy.**
Verworfen wurde die naheliegende Fassung — `regs_select_self_or_host` um einen
Zweig „Event sichtbar **und** `status = 'registered'`" erweitern. Sie ist
kürzer und scheitert an zwei Dingen:

1. **RLS ist zeilenweise, nicht spaltenweise.** Wer eine fremde
   Registrierungszeile lesen darf, liest sie ganz — samt `checked_in` und
   `rating`. Die Sterne-Bewertung eines namentlich bekannten Mitglieds wäre
   damit für jedes Mitglied abrufbar. Für die Avatarreihe im Mockup wird davon
   nichts gebraucht.
2. **Das Aktivierungs-Gate stünde danach an einer umgebauten Stelle.** Die
   Policy trägt `public.is_activated()` seit C3
   (`20260806080100_activation_gate.sql:185`). Ein Umbau derselben Policy macht
   den pgTAP-Fall „eingeloggt, nicht aktiviert liefert leer" zu einem Test über
   neuen Code statt über die gesetzte Grenze.

Die RPC liefert **nur `profile_id` und `status`** für Angemeldete eines
sichtbaren Events und trägt dasselbe Gate. `regs_select_self_or_host` bleibt
Wort für Wort stehen. Das Muster ist im Repo etabliert —
`event_registration_counts` ist genau dieser Bau, eine Ebene schmaler.

**Wer nicht im Verzeichnis steht, steht auch nicht in der Teilnehmerreihe.**
Die RPC liefert **nur Teilnehmer, deren Profil öffentlich und aktiviert ist** —
dieselbe Bedingung, mit der die View `profiles_public` filtert
(`WHERE is_public AND is_activated() AND activated_at IS NOT NULL`; in DEV
41 Profile, 38 davon öffentlich und aktiviert).

Die erste Fassung dieses Changes gab stattdessen alle `profile_id` heraus und
zeigte nicht auflösbare Profile als „Ein Mitglied". Der Plan-Review hat daran
das Richtige getroffen: **das UI-Label macht die Preisgabe auf der Leitung
nicht rückgängig.** Eine stabile UUID lässt sich mit allem korrelieren, was
sonst noch über dieses Konto sichtbar ist. Wer sein Profil verbirgt, soll auch
seine Teilnahme verbergen — das ist die konsistente Regel, nicht die strengere
Auslegung einer halben.

Der Preis ist benannt: **die Gesamtzahl kann größer sein als die Zahl der
Gesichter.** Sie kommt weiterhin aus `event_registration_counts` und bleibt
vollständig. Das ist gewollt — „64 Teilnehmer, 61 davon sichtbar" ist ehrlich;
eine Zahl, die stillschweigend nur die Sichtbaren zählte, wäre es nicht.

> **Für Detlev:** diese Festlegung weitet die Wirkung von „Profil nicht
> öffentlich" aus. Sie ist die vorsichtigere Lesart und jederzeit umkehrbar,
> aber sie ist eine Produktentscheidung und keine technische.

### Titelbild: kein `cover_url`, sondern ein Pfad

AGE-531 nennt die Spalte `cover_url`. **Sie heißt hier `cover_path`**, und das
ist keine Kosmetik. C7 hat für Beitragsbilder **einen privaten Bucket mit
signierten URLs** entschieden, ausdrücklich gegen zwei Buckets nach
Sichtbarkeit (`20260812090100_post_media_storage.sql`, Kopf). Dieselbe Mechanik
gilt hier, weil dieselbe Frage gilt: das Titelbild eines `members`-Events darf
ohne Session nicht abrufbar sein. Aus einem privaten Bucket gibt es aber
**keine dauerhafte URL** — nur einen Pfad plus eine Signatur mit einer Stunde
Gültigkeit. Eine Spalte `cover_url`, die einen Pfad enthält, wäre eine falsche
Auskunft an jeden künftigen Leser, zumal `profiles.cover_url` (C6, öffentlicher
Bucket `covers`) danebensteht und dort wirklich eine URL hält.

## What Changes

- **Vier neue Spalten auf `public.events`**: `description` (text),
  `ends_at` (timestamptz), `cover_path` (text, `unique`), `topics` (text[]).
  `unique (cover_path)` ist nicht Kosmetik — die Sichtbarkeitsfunktion des
  Buckets schlägt das Event über genau diese Spalte nach, und zwei Zeilen auf
  denselben Pfad machten die Antwort mehrdeutig (dieselbe Begründung wie
  `post_media.storage_path`).
- **`cover_path` wird an den Host gebunden**, an zwei Stellen. Der
  Plan-Review hat hier eine echte Lücke gefunden: die Upload-Policy beweist
  Eigentum nur, während das **Objekt** entsteht — wer danach die Spalte
  schreibt, prüft niemand. Ein Mitglied könnte den verwaisten Pfad eines
  fremden `members`-Events an sein eigenes `public`-Event hängen, und `anon`
  signierte ein Bild, das nie öffentlich war. C7 wehrt genau diesen Angriff in
  `create_post_with_media` ab (`20260812090000_post_media.sql:214–240`); hier
  fehlte er. Geschlossen wird er **schreibend** (`events_write_host` verlangt
  im `with_check`, dass das erste Pfadsegment die eigene uid ist) **und
  lesend** (`event_cover_lesbar` verlangt, dass es der `host_id` des
  gefundenen Events entspricht) — die zweite Hälfte deckt Zeilen ab, die die
  erste nie gesehen hat.
- **`starts_at` wird `not null`.** Kein Bestand steht im Weg — und das ist
  gemessen, nicht angenommen: DEV 9 Events / 0 ohne Termin,
  **PROD 0 Events** (`viwntbodrtqxgmqyxluh`, read-only Vorabmessung mit
  `scripts/probe-c8-starts-at-preflight.ts`). Folge im Frontend: `EventForm`
  muss den Termin **verlangen**, sonst scheitert das Anlegen erst am `insert`.
- **Constraint `ends_at is null or ends_at > starts_at`.** Das Ende bleibt
  optional; ist es gesetzt, liegt es nach dem Beginn.
- **Neue RPC `public.event_attendees(uuid)`**, `SECURITY DEFINER`, `stable`,
  `set search_path = ''`. Liefert `profile_id` und `status` der **angemeldeten**
  Teilnehmer eines Events, das der Aufrufer sehen darf, nur für ein aktiviertes
  Konto und nur für Profile, die öffentlich und aktiviert sind. `execute` nur
  für `authenticated` — ausgeloggt gibt es keine Teilnehmer, auch nicht bei
  einem öffentlichen Event.
- **Ein eigener Query-Key für die Teilnehmerreihe.** `fetchAttendees` und
  `attendeesKey` bleiben unangetastet: sie liefern `registrationId`,
  `checked_in` und `rating` und werden von **zwei** privilegierten Stellen
  benutzt — `HostTools` **und** `RatePanel` (`EventDetailPage.tsx:226`). Die
  erste Fassung dieses Changes behauptete „nur `HostTools`"; das war schlicht
  falsch. Die neue, schmalere Projektion bekommt deshalb einen getrennten
  Schlüssel und wird nach An- und Abmeldung mit invalidiert, statt sich einen
  Cache mit einer anderen Datenform zu teilen.
- **Neuer privater Bucket `event-covers`**, 2 MiB, nur `image/webp`, mit
  SELECT-Policy über die neue Funktion `public.event_cover_lesbar(text)` sowie
  INSERT/UPDATE/DELETE im eigenen `{uid}/`-Pfad hinter `public.is_activated()`
  — wörtlich das Muster der drei bestehenden Buckets. 2 MiB statt 1 MiB wie bei
  `post-media`: das Titelbild ist ein Querformat-Header, nicht eine von sechs
  Kacheln; `covers` (C6) trägt aus demselben Grund 2 MiB.
- **Titelbild-Upload im Formular** über den bestehenden `AvatarCropper` mit
  `aspect = 3` (er nimmt den Wert bereits als Prop entgegen,
  `AvatarCropper.tsx:67`), Ausgabe WebP wie beim Hintergrundbild.
- **`EventForm` um vier Felder**, alle optional außer dem jetzt verlangten
  Termin: Beschreibung (mehrzeilig), Ende, Titelbild, Themen. Damit hat das
  Formular **ein** Pflichtfeld mehr als heute (Termin), nicht vier.
- **Übersicht auf drei Kacheln** (`lg:grid-cols-3`) und Kachel nach Mockup:
  Titelbild mit Datumsmarke, Typ-Marke, Titel, Von–Bis, Ort, Teilnehmerzahl,
  Knopf.
- **Detailseite nach Mockup**: Titelbild als Header mit Datumsmarke, Titel und
  Typ, Von–Bis, Ort, Beschreibung, Themen, Veranstalter mit Bild und
  Verlinkung, Teilnehmerreihe (fünf Gesichter + „+n"), Anmeldeknopf mit
  Kapazität und Warteliste, ähnliche Events.
  **Ohne Session bleiben Veranstalter und Teilnehmerreihe leer** — die
  Bestandsanforderung „Ohne Session löst die Eventliste keine Hosts auf"
  (AGE-530) gilt unverändert, und `event_attendees` trägt für `anon` kein
  `execute`. Die Seite bleibt erreichbar; nur die Anreicherung entfällt, und
  die Konsole bleibt frei von `42501`.

### Drei Festlegungen zu den Mockups

Aus dem Abgleich der Bilder mit AGE-531; sie sind Annahmen dieses Changes und
umkehrbar, solange sie hier stehen.

1. **„Themen" ist eine Häkchenliste, keine Chip-Reihe.** Das Mockup zeigt
   „Aktuelle Club-News · Neue Mitglieder begrüßen · Chancen & Gesuche aus der
   Community · …" mit Häkchen und darunter „Änderungen vorbehalten." Das sind
   Programmpunkte dieses einen Events, keine Schlagworte. `topics text[]` trägt
   sie als freien Text pro Zeile. **Kein Bezug zu `public.tags`** — die 15
   kuratierten Tags aus C7 sind eine redaktionelle Liste für den Feed und
   beschreiben keine Tagesordnung.
2. **Kein Untertitel.** Das Mockup trägt unter dem Titel eine eigene Zeile
   („Wöchentliches Community-Meeting"), getrennt von der Beschreibung. Das wäre
   ein fünftes Feld; die Beschreibung trägt es mit.
3. **„Ähnliche Events" = die drei nächsten kommenden Events desselben `type`**,
   das eigene ausgenommen; sind es weniger als drei, wird mit den nächsten
   kommenden überhaupt aufgefüllt. Gelesen wird aus dem bereits geladenen
   `eventsListKey(uid)`-Cache, also **kein neuer Datenweg**.

## Non-goals

- **Events im Aktivitätsfeed** (`posts.kind` + Trigger) → **C9**. Auch keine
  Vorstufe: keine Spalte „für später", kein Trigger, der noch nichts tut.
- **Highlights** — vorerst komplett draußen (Entscheidung 04.08.).
- **Partner als Veranstalter.** `events.host_partner_id` zeigt auf `partners` —
  eine Tabelle ohne UI und ohne Zeilen. Die bestehende Auflösung in
  `hostsFor` (`src/lib/events.ts:204`) bleibt unverändert stehen; sie wird
  weder ausgebaut noch entfernt.
- **Wiederkehrende Termine.**
- **Die Event-Mechanik.** `register_for_event`, `set_event_check_in`,
  `event_registration_counts`, `regs_write_own`, `regs_select_self_or_host`,
  die Bewertung und die drei Reiter werden **nicht** angefasst. Der bekannte
  Nebenweg an der Kapazitätslogik vorbei (`regs_write_own`, im Spec als
  Constraint festgehalten) bleibt, wie er ist.
- **Aus den Mockups, aber nicht in diesem Change:** die Filterleiste
  (Typ/Region/Format/Veranstalter), die Sortier-Auswahl, „Zum Kalender
  hinzufügen", Teilen nach LinkedIn/WhatsApp/E-Mail, „Merken", Kommentare unter
  dem Event, „Nachricht senden" an den Veranstalter, „Teilnehmerliste
  anzeigen" als eigene Ansicht.
- **Neue Event-Typen.** Die Mockups zeigen Marken wie `ERLEBNISTAG`,
  `NETWORKING` und `BUSINESS-DINNER`; `events_type_check` kennt `online`,
  `presence`, `dinner`, `workshop`, `mastermind`. Der Check bleibt unangetastet.
- **Aufräumen verwaister Objekte im Bucket.** Ein ersetztes Titelbild
  hinterlässt sein altes Objekt. Das ist bei `avatars` seit AGE-238, bei
  `covers` seit C6 und bei `post-media` seit C7 so — hier bewusst gleich
  gehalten und benannt, statt als Löschung versprochen. Ohne
  `events.cover_path`-Zeile findet `event_cover_lesbar` kein Event, also gibt
  es für das Objekt keine Signatur mehr: es kostet Speicher, es leckt nichts.

## Impact

- **Specs:** `events` — zwei MODIFIED (Spalten; Registrierungs-Sichtbarkeit,
  die um den Verweis auf die neue RPC ergänzt wird), sechs ADDED.
- **Migrationen:** drei neue, forward-only.
  - `20260812100000_events_content.sql` — Spalten, Constraints, `not null`
  - `20260812100100_event_attendees.sql` — die RPC
  - `20260812100200_event_covers_storage.sql` — Bucket, Sichtbarkeitsfunktion,
    vier Policies
- **Code:** `src/lib/events.ts`, `src/components/events/EventCard.tsx`,
  `EventForm.tsx`, `EventsList.tsx`, `src/pages/EventDetailPage.tsx`, neu
  `src/lib/event-cover.ts`. `src/lib/database.types.ts` **von Hand** ergänzen,
  nicht neu generieren.
- **Tests:** `supabase/tests/rls_test.sql` (neuer Abschnitt, `plan()` mitziehen),
  erste Testdateien zu `EventCard`/`EventForm`/`EventDetailPage`.
- **`grants_test.sql` bleibt voraussichtlich grün** — der Golden-Snapshot führt
  `events/authenticated=DELETE,INSERT,SELECT,UPDATE` auf Tabellenebene (Zeile
  47), und die Spalten-Grants-Assertion (Zeile 95 ff.) deckt nur `profiles`,
  `contact_requests`, `routing_queue` und `platform_settings`. Dieser Change
  legt **keine neue Tabelle** an. Trotzdem wird er ausgeführt, bevor der Branch
  fällt: dieser Snapshot hat in AGE-455 schon einmal ohne Namensnennung den
  `migrations`-Job rot gemacht.
- **Nicht betroffen:** `event_registrations` (Schema und Policies), `posts`,
  `partners`, `profiles`, die Buckets `avatars`, `covers`, `post-media`.
