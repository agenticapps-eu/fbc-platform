# Feedback ausbauen (AGE-628)

## Why

Das QM-Feedback sammelt heute Sterne und drei Freitexte — mehr nicht. Wer es
liest, kann weder sehen, **wovon** die Rede ist (ein Screenshot fehlt), noch
**worum** es geht (kein Thema), noch die Menge sortieren (kein Filter), noch
antworten (kein Weg zum Verfasser). Donald hat die vier Lücken am 27.08. an
einem Vorgang gemeldet; die Fläche ist seit AGE-587 eine eigene Route und trägt
die Menge, aber nicht die Mittel, mit ihr zu arbeiten.

Jetzt, weil zwei Vorbedingungen inzwischen entschieden sind: `admin_list_feedback()`
gibt seit AGE-587 die `profile_id` des Verfassers heraus — die Spec sagt
ausdrücklich, das geschehe, „so that a later capability can address the author
directly". Und die beiden offenen Produktfragen sind beantwortet (siehe unten).

## What Changes

**1. Screenshot ans Feedback.** Beim Abgeben kann ein Bild mitgeschickt werden.
Neuer privater Bucket; die Größenbegrenzung hängt serverseitig am Bucket, nicht
nur im Formular. Der Admin sieht das Bild an der Feedback-Zeile — und darf es
löschen (Donald, 01.09.): ein Leserecht ohne Löschrecht ließe ein
missbräuchliches Bild liegen, bis ausgerechnet sein Verfasser es entfernt.

**2. Geschlossene Themenliste.** Fünf Themen — Generell, Fehler, Bedienung,
Inhalte, Idee (Donald, 01.09.) — als Zeilen in einer kleinen Tabelle
`feedback_themes`, auf die `feedback.theme` per Fremdschlüssel zeigt. Kein
Freitext, sonst ist Filtern (Teil 3) wertlos. Eine Tabelle und kein `CHECK`,
weil die Oberfläche einen `CHECK` nicht lesen kann und die Liste sonst ein
zweites Mal im Code stünde. Bestandszeilen bekommen „Generell", weil eine leere
Spalte sonst als eigenes, namenloses Thema durchginge.

**3. Filtern in der Admin-Übersicht.** Auswahlkästchen nach Thema und Bewertung,
in der bestehenden `FilterSpalte` (AGE-629). Das Filtern geschieht **in der RPC**,
nicht im Browser: die Fläche pagiert seit AGE-587, und ein Filter über der
geladenen Seite filterte die Seite statt den Bestand.

**4. Sprung in den Chat mit dem Verfasser.** Aus einer Feedback-Zeile heraus
öffnet sich das Gespräch mit der Person. **Das ist der Teil mit Gewicht:** der
Chat-Zugang hängt heute an einer angenommenen Kontaktanfrage, erzwungen in
**zwei** RLS-Policies (`threads_insert` und `messages_insert`). Ein Admin darf
diese Hürde überspringen — von Donald am 01.09. entschieden. Die Ausnahme wird
**in der Datenbank ausgesprochen**, nicht im Frontend umgangen.

**Was NICHT Teil dieses Changes ist**

- **Anonymes Feedback.** AGE-588 ist am 01.09. abgebrochen. `feedback.profile_id`
  ist `not null` mit Fremdschlüssel — jede Zeile trägt ihren Verfasser. Der
  Chat-Sprung hat also immer ein Gegenüber; einen „kein Knopf"-Fall gibt es nicht.
- **Ein gemeinsames Bauteil für Kästchen-Facetten.** Das Markup steht heute in
  fünf Flächen dupliziert (`EventsList`, `CommunityFeed` ×2, `AcademyPage`,
  `AdminNeuigkeitenPage`). Das zu vereinheitlichen ist ein eigener Vorgang und
  kein Beifang hier — dieser Change verwendet die `FilterSpalte`-Hülle wieder
  und folgt dem bestehenden Markup.
- **Der Admin verwaltet die Feedback-Zeilen.** `feedback_admin_read` bleibt
  `for select`; der Admin darf das **Bild** löschen, nicht die Zeile.

## Capabilities

### New Capabilities

Keine. Beide berührten Fähigkeiten bestehen.

### Modified Capabilities

- `feedback-qm`: Eine Feedback-Zeile trägt zusätzlich ein Thema aus einer
  geschlossenen Menge und optional ein Bild. `admin_list_feedback()` nimmt
  Filterargumente entgegen und gibt Thema und Bildpfad heraus. Die Admin-Fläche
  filtert über die RPC und bietet je Zeile den Weg zum Verfasser.
- `messaging`: Die Zusage „Senden setzt eine angenommene Kontaktanfrage voraus"
  bekommt eine ausgesprochene Ausnahme für Admins — in `threads_insert` **und**
  `messages_insert`, weil die Bedingung in beiden steht. Die Teilnehmerprüfung
  bleibt unangetastet: der Admin muss weiterhin selbst am Gespräch beteiligt sein.

## Impact

**Datenbank** (Migrationen, forward-only)

- Neue Tabelle `feedback_themes` (Schlüssel, Beschriftung, Reihenfolge). **Sie
  bricht den Golden-Snapshot in `grants_test.sql`** — das wird im selben Change
  nachgezogen, sonst steht CI rot und der Bruch sieht aus wie ein Rechtefehler.
- `feedback`: neue Spalten `theme` (Fremdschlüssel, Bestand auf „Generell"
  gesetzt, dann `not null`) und `screenshot_path`.
- Neuer privater Storage-Bucket für die Screenshots, mit `file_size_limit` und
  `allowed_mime_types` am Bucket sowie eigenen Policies. Nach der Hausregel
  `upsert: false` beim Hochladen — bei `true` scheitert der Upload an der
  SELECT-Policy.
- `admin_list_feedback()`: neu deklariert mit Filterargumenten und zwei
  zusätzlichen Rückgabespalten. Grants und `SECURITY DEFINER` bleiben.
- `threads_insert` und `messages_insert`: die `contact_requests`-Bedingung wird
  um `or public.is_admin()` erweitert. **Zwei Policies, nicht eine** — wer nur
  eine anfasst, baut einen Admin, der ein Gespräch anlegen, aber nicht schreiben
  kann (oder umgekehrt).

**Frontend**

- `src/components/feedback/FeedbackButton.tsx` — Bildauswahl und Themenauswahl.
- `src/pages/AdminFeedbackPage.tsx` — `FilterSpalte`, Filterzustand, Bildanzeige,
  Knopf zum Gespräch.
- `src/lib/feedback.ts` — die Datenschicht zu beidem.
- `src/types/database.types.ts` — **von Hand** nachziehen; `gen types` darf nicht
  darüberlaufen.

**Sicherheit**

Dieser Change weitet **zwei** Zusagen an verschiedenen Stellen: die
Kontaktanfrage-Hürde (Teil 4) und das Löschrecht am Bild (Teil 1). Beide
gehören in die `cso`-Betrachtung und je in eine pgTAP-Abdeckung, die **beide
Richtungen** belegt — Admin darf, Nicht-Admin darf weiterhin nicht. Ein Test,
der nur die neue Richtung prüft, ließe eine Öffnung für alle unbemerkt; und ein
Lauf, der beide Ausnahmen zusammen prüft, kann grün bleiben, während eine von
beiden zu weit greift.
