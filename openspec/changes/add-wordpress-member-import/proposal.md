# Mitglieder-Import aus WordPress (AGE-534, C10)

Linear-Issue: AGE-534

## Why

Der Club hat 70 Bestandsmitglieder in einer WordPress-Installation mit dem
Plugin *Ultimate Member*. Ohne sie ist die neue Plattform am Go-Live-Tag ein
leeres Verzeichnis, und der Nutzen der gebauten Funktionen — Suche, Matching,
Kontaktanfragen, Feed — entsteht erst mit Mitgliedern darin. C10 ist der letzte
Change vor dem Go-Live Ende August.

Der Import ist dabei **nicht** der riskante Teil. Riskant ist, dass jeder Fehler
70 Menschen gleichzeitig trifft und am Go-Live-Tag als Telefonat zurückkommt.
Deshalb ist der eigentliche Gegenstand dieses Changes **der Trockenlauf**: ein
Lauf, der nichts schreibt, aber vollständig benennt, was er schreiben würde und
welche Datensätze Handarbeit brauchen. Er ist zugleich das Werkzeug, das die
noch fehlenden Angaben von Detlev überhaupt erst einfordert — bisher stand im
Issue, der Import warte auf eine Liste, die nur der Trockenlauf erzeugen kann.

## What Changes

- **Neu: ein Import-Script** unter `supabase/seed/`, in der Bauweise des
  Demo-Seeds (`tsx`, `pg`-Direktverbindung, Infisical). Es liest den
  CSV-Export, bildet die Felder ab, lädt die Bilder und schreibt Konten,
  Profile und `profile_legacy`.
- **Trockenlauf ist der Standard.** Geschrieben wird nur mit einem
  ausdrücklichen Schalter. Ein Aufruf ohne Argumente kann nichts kaputt machen.
- **Neu: die fehlenden Feld-Parser** für Beitrittsdatum und Telefonnummer, plus
  eine Übertragung der beiden bereits gegen die echten Daten gemessenen Parser
  (PHP-Array, Ort/PLZ) von Python nach TypeScript. Entgegen der Annahme im
  Issue liegen **nur zwei der vier** Parser vor.
- **Neu: ein Bericht** am Ende jedes Laufs — angelegt / aktualisiert /
  übersprungen / fehlerhaft, je mit Grund, plus die Fälle, die Handarbeit
  brauchen.
- **Idempotenz über `legacy_source_id`.** Ein zweiter Lauf aktualisiert, statt
  zu duplizieren.
- **Die Personendaten bleiben außerhalb des Repositoriums.** Der CSV-Export
  trägt Klarnamen, Anschriften, Telefonnummern und Passwort-Hashes von 70
  Menschen; das Repository ist öffentlich. Das Script bekommt den Pfad
  übergeben und **lehnt einen Pfad im Arbeitsbaum ab**; die Standardausgabe
  führt keine Personendaten.
- **Die Passwort-Hashes des Altsystems werden nicht übernommen.** Sie werden
  weder gelesen noch geschrieben noch protokolliert; importierte Konten
  entstehen ohne Passwort. Das ist der Grund, warum der ursprüngliche Plan mit
  einem geteilten Passwort in einer Rundmail verworfen wurde.
- **Der Import verschickt keine Mail.** Der Zugang entsteht dadurch, dass ein
  Mitglied seine Adresse auf der Plattform eingibt und den Versand selbst
  auslöst. Ein Versand aus dem Import heraus verschickte Links vor der
  Ankündigung und entwertete sie beim nächsten Lauf wieder.

Nicht in diesem Change: der echte Lauf gegen PROD. Der ist eine Handlung am
Go-Live-Tag, kein Diff — und er setzt Angaben voraus, die noch fehlen.

## Capabilities

### New Capabilities

- `member-import`: Der Umzug bestehender Mitgliedschaften aus einem Altsystem —
  Trockenlauf als Standard, Feldabbildung, Wiederholbarkeit, Bildübernahme,
  Berichtspflicht und die Behandlung der Datensätze, die nicht sauber
  durchlaufen.

### Modified Capabilities

Keine. Was importierte Profile *sind*, steht bereits in `member-profiles`
(„Ein importiertes Profil startet unbestätigt") und in `membership-tiers`; die
Stufe `impact` für Bestandsmitglieder ist dort schon entschieden. Dieser Change
beschreibt, wie sie **entstehen**, und wiederholt die Aussagen nicht.

## Impact

**Neu**
- `supabase/seed/wp_import.ts` — das Script
- `supabase/seed/wp_felder.ts` (+ Test) — die Parser, ohne Datenbank testbar
- `supabase/seed/wp_import.lib.ts` (+ Test) — Abbildung, Vorabprüfung,
  Merge-Regeln, Berichtsaufbau

**Berührt**
- `package.json` — die Skripte, plus `sharp` und ein RFC-4180-fähiger
  CSV-Parser; beide liegen heute nicht im Projekt
- `supabase/seed/tsconfig.json` — führt heute eine feste `include`-Liste mit drei
  Dateien; ohne Erweiterung liefen die neuen Dateien ohne Typprüfung

**Datenbank** — keine Migration. Alle Zielspalten stehen: `profile_legacy`
(AGE-511), die Adressfelder (AGE-537, `Done`), `member_since` (C6).
Geschrieben wird in `auth.users` (über die Admin-Schnittstelle), `profiles`,
**`profile_contacts`** (Telefon, Kontaktadresse, Homepage — eine eigene Tabelle)
und `profile_legacy`.

**Abhängigkeiten** — der Import selbst hängt an keinem offenen Issue mehr. Der
Mailweg ist gemessen (PROD sendet von `effbeezee.com`, Resend-DNS vollständig),
AGE-256 (`fbc.de`) ist damit Nachlauf statt Vorbedingung. Offen bleiben drei
**Datenlieferungen** von Detlev, nicht Code: Zahlungsstände (`paid_until`),
Rückläufer der Sommerfest-Rundmail, Liste der Ausgetretenen. Der Trockenlauf
läuft ohne sie und weist sie aus.

**Extern** — die Bilder liegen offen lesbar unter
`fairbusinessworld.de/wp-content/uploads/ultimatemember/<id>/`; nachgemessen,
kein Zugang nötig. Fällt die alte Seite ab, ist die Bildübernahme verloren —
ein Grund, den Export der Bilder nicht bis zum Go-Live-Tag aufzuschieben.
