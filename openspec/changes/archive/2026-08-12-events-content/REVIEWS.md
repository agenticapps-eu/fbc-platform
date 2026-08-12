---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2-default, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: f06c02ec6f91e49d7276a170c5f7e38bec1eef90fdb2a87dfe362e3ffc856d5b
---

# Change review — events-content (AGE-531, C8)

Zwei Anbieter, beide **andere** als der Verfasser des Deltas (claude). Fassung
der Artefakte: `proposal.md` + `tasks.md` + `specs/events/spec.md`, verkettet,
SHA-256 oben.

**Einschränkung, benannt statt verschwiegen:** codex meldet sein Modell selbst
(`gpt-5.6-sol`). Die gemini-CLI (0.28.2) gibt ihres weder auf stdout noch in
`~/.gemini/settings.json` aus; hier steht deshalb die CLI-Version statt eines
Modellnamens. Regel 4 des Review-Verfahrens ist damit für einen der beiden Arme
nur halb erfüllt. Die Anbieter-Trennung selbst ist unstrittig.

## Reviewer: gemini (gemini-cli-0.28.2, Standardmodell)

VERDICT: REQUEST-CHANGES

- **[MEDIUM] `event_attendees` / `event_cover_lesbar`** — Das Aktivierungs-Gate
  schließe den Host aus. Vorschlag: `(is_activated() AND sichtbar) OR ist_host`
  statt `is_activated() AND (sichtbar OR ist_host)`.
- **[LOW] Aufgabe 9.4, Sonde** — `emptyBucket` sei als Abbau unzuverlässig.
  Vorschlag: je Lauf ein eindeutiger Pfad, danach dieses eine Objekt gezielt
  löschen.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- **[HIGH] `cover_path` lässt sich mit einem fremden Pfad belegen.** Die
  Upload-Policy beweist Eigentum nur beim Anlegen des Objekts. Nichts hindert
  einen Host daran, einen bekannten fremden `cover_path` an sein eigenes
  `public`-Event zu hängen; nach dem Ersetzen des Originals ist der Pfad
  verwaist und `unique (cover_path)` steht nicht mehr im Weg. Danach signiert
  `anon` ein Bild, das nie öffentlich war.
- **[HIGH] `profiles_public` anonymisiert die RPC-Antwort nicht.**
  `event_attendees` gibt die stabile `profile_id` auch dann heraus, wenn das
  Profil nicht öffentlich ist. „Ein Mitglied" im UI macht die Preisgabe auf der
  Leitung nicht rückgängig.
- **[HIGH] Die Behauptung „`fetchAttendees` nur in `HostTools`" ist falsch** —
  `RatePanel` benutzt sie ebenfalls. Dazu fehlen ein eigener Query-Key für die
  neue, schmalere Projektion und dessen Invalidierung nach An-/Abmeldung.
- **[MEDIUM] `database.types.ts`** — nicht nur die vier Spalten; `starts_at`
  wechselt von nullable auf non-null in `Row`, `Insert` und `Update`.
- **[MEDIUM] Zwei RED-Fälle sind nicht konstruierbar** — „unsichtbares Event"
  und „Host auf das eigene, sonst unsichtbare Event". `visibility` kennt nur
  `public` und `members`, beide sieht jedes aktivierte Mitglied.
- **[MEDIUM] Ähnliche Events aus dem Cache scheitern beim Direktaufruf** —
  Deeplink, Neuladen, Lesezeichen: die Liste war nie geladen.
- **[MEDIUM] Die Bucket-Invarianten sind ungetestet** — MIME, Größe,
  `public = false`.
- **[MEDIUM] Der Weg der signierten URLs in die Oberfläche ist unspezifiziert** —
  Bündelung, Ablauf, Cache-Schlüssel.
- **[MEDIUM] `not null` ist nur aus DEV abgeleitet**, während PROD abweichen
  könnte.
- **[MEDIUM] Der Veranstalter-Block widerspricht der Bestandsanforderung**
  „Ohne Session löst die Eventliste keine Hosts auf" (AGE-530).
- **[LOW] `event_cover_lesbar` bekommt kein `revoke … from public`** —
  Funktionen sind per Voreinstellung für `PUBLIC` ausführbar.

## Nicht gezählt

Keiner. Beide Arme liefen mit `REVIEWER_TIMEOUT=900` und beendeten mit 0;
mit der Voreinstellung von 300 s wäre codex als exit 4 durchgefallen.

## Resolution

### Übernommen

**codex HIGH 1 — `cover_path`-Diebstahl. Bestätigt und geschlossen.**
Nachgeprüft statt geglaubt: C7 wehrt exakt diesen Angriff ab, und der Kopf von
`20260812090000_post_media.sql:214–240` beschreibt ihn Wort für Wort
(„wartet auf dessen Löschung … hängt den verwaisten Pfad an seinen eigenen
`public`-Beitrag"). Der Angriff überträgt sich eins zu eins. Geschlossen wird
er an **zwei** Stellen, weil eine davon nur neue Zeilen erwischt:

1. **Schreiben:** `events_write_host` bekommt im `with_check`
   `cover_path is null or split_part(cover_path, '/', 1) = auth.uid()::text`.
2. **Lesen:** `event_cover_lesbar` verlangt zusätzlich, dass das erste
   Pfadsegment der `host_id` des gefundenen Events entspricht. Das deckt auch
   Zeilen ab, die vor dieser Migration entstanden wären.

Neuer RED-Fall: fremden, verwaisten Pfad an ein eigenes `public`-Event hängen →
Schreiben abgelehnt, und selbst bei erzwungener Zeile keine Signatur.

**codex HIGH 2 — `profile_id` eines nicht öffentlichen Profils.** Übernommen,
und zwar in der strengeren Form: `event_attendees` liefert **nur Teilnehmer,
deren Profil öffentlich und aktiviert ist**. Damit steht die UUID eines
Opt-out-Mitglieds gar nicht erst auf der Leitung, und die Oberfläche braucht für
diesen Fall keinen Ersatztext. Das ist zugleich die konsistentere Regel: wer
nicht im Verzeichnis steht, steht auch nicht in der Teilnehmerreihe. Die
Gesamtzahl kommt weiterhin aus `event_registration_counts` und bleibt dadurch
vollständig — die Zahl kann also größer sein als die Zahl der Gesichter, und
das ist gewollt. **Das ist eine Produktentscheidung, die ich getroffen habe;
sie gehört Detlev vorgelegt**, weil sie die Wirkung von „Profil nicht
öffentlich" ausweitet. Spec-Szenario umgeschrieben.

**codex HIGH 3 — `RatePanel` benutzt `fetchAttendees` auch.** Sachlich falsche
Behauptung meinerseits, nachgeprüft in `EventDetailPage.tsx:226–229`. Beide
privilegierten Aufrufer bleiben unverändert; die neue Projektion bekommt einen
eigenen Schlüssel `eventAttendeesKey(uid, eventId)` und wird nach Anmeldung und
Abmeldung mit invalidiert. Regressionstests für Bewertung und `HostTools`.

**codex MEDIUM `database.types.ts`** — übernommen, alle drei Stellen.

**codex MEDIUM nicht konstruierbare RED-Fälle** — bestätigt: `visibility`
erlaubt nur `public` und `members`, also ist der Host-Zweig für ein aktiviertes
Konto unerreichbar. Die beiden Fälle fallen raus. Der Host-Zweig selbst
**bleibt** in der Funktion, weil sie die bestehende Policy spiegeln soll, in der
er ebenfalls steht; dass er heute tot ist, steht ab jetzt im Migrations-Kopf,
statt als getestet behauptet zu werden.

**codex MEDIUM ähnliche Events beim Direktaufruf** — übernommen. Die
Detailseite hängt sich mit `useQuery` an denselben `eventsListKey(uid)`, statt
auf einen gefüllten Cache zu hoffen.

**codex MEDIUM Bucket-Invarianten** — übernommen, zweigeteilt: `public`, Größe
und MIME als `is()` auf `storage.buckets` in pgTAP (wie §17 für `covers`),
die tatsächliche Ablehnung eines zu großen bzw. nicht-WebP-Uploads in der Sonde
über die echte Storage-API. pgTAP kann Letzteres nicht — die Grenzen sitzen im
Storage-Dienst, nicht in der Datenbank.

**codex MEDIUM Weg der signierten URLs** — übernommen. Ein **gebündelter**
Signieraufruf je Liste (nicht einer je Kachel), ein eigener für die
Detailseite, Cache-Schlüssel am Principal, Ablauf- und Fehlerverhalten
ausbuchstabiert.

**codex MEDIUM PROD-Vorabmessung** — übernommen und **bereits erledigt**, bevor
die Migration geschrieben wurde: `scripts/probe-c8-starts-at-preflight.ts`,
nur lesend, gegen `viwntbodrtqxgmqyxluh`. Ergebnis: **0 Events in PROD**, also
auch 0 ohne Termin; `events_visibility_check` ist dort ebenfalls schon sauber.
`set not null` läuft durch. Damit ist die Annahme eine Messung.

**codex MEDIUM Veranstalter ohne Session** — übernommen. Die ADDED-Anforderung
qualifiziert die Host-Darstellung jetzt als „mit Session"; ein Szenario hält
fest, dass ausgeloggt weder `profiles_public` noch `partners` abgefragt wird.

**codex LOW `revoke … from public`** — übernommen. Nachgeprüft: `post_media_lesbar`
tut genau das (`20260812090000_post_media.sql:167–168`); meine Auslassung wäre
eine stille Rechteausweitung gewesen. Dazu eine Grants-Assertion.

**gemini LOW Sondenabbau** — übernommen. Eindeutiger Pfad je Lauf und gezieltes
Löschen dieses einen Objekts statt `emptyBucket`. Das ist verlässlicher als der
C7-Weg, der in DEV einen Wegwerf-Bucket stehen ließ, während die Sonde Erfolg
meldete.

### Abgelehnt

**gemini MEDIUM — Gate vor den Host ziehen.** Nicht übernommen; der Befund
beruht auf einer Annahme über den Bestand, die messbar falsch ist. gemini
schreibt, bestehende Host-Rechte seien „not gated this way". Gemessen in DEV
(`pg_policies`, 2026-08-12):

```
events_select_by_visibility  is_activated() AND (visibility IN (…) OR host_id = uid)
events_write_host            is_activated() AND (host_id = uid)
regs_select_self_or_host     is_activated() AND (profile_id = uid OR host des Events)
```

Alle drei tragen `is_activated()` als äußeres `AND`, der Host-Zweig steht bei
allen dreien **innerhalb**. Die vorgeschlagene Form
`(is_activated() AND sichtbar) OR ist_host` würde einem nicht bestätigten Konto
Zugriff auf die Daten seines eigenen Events geben — also genau das Gate
aufreißen, dessen Erhalt AGE-531 ausdrücklich verlangt („`is_activated()` MUSS
erhalten bleiben, sonst reißt das Gate"). Ein nicht aktiviertes Konto sieht in
dieser Plattform nichts, auch nicht Eigenes; das ist die Entscheidung aus C3
und keine Unachtsamkeit.

### Nicht als Befund, aber notiert

Codex' Liste unausgesprochener Annahmen trifft zweimal etwas, das der Change
tatsächlich offenließ und das jetzt in `tasks.md` steht: **Zeitzone/„selber
Tag"** bei der Zeitspanne (lokale Zone des Browsers, DST-Grenze) und die
**Entfernen-Semantik** des Titelbilds (Bearbeiten ohne neue Auswahl behält das
Bild; Entfernen ist ein eigener Knopf, der `cover_path` auf null setzt). Die
übrigen Annahmen waren bereits im `proposal.md` benannt.
