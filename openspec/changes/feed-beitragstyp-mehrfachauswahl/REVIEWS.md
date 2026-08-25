---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2 (Modell vom CLI nicht ausgewiesen), gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: f015ca363e99f5c5807b0aa2042b2434b1e1beac576f44f8997fc3cdeaccc501
---

# Change review — feed-beitragstyp-mehrfachauswahl (AGE-590)

Plan-Review nach Schritt 2b, **vor der ersten Zeile Code**. Beide Vendoren sind
fremd; dieser Host hat sich nicht selbst gelesen. Beide liefen mit
`REVIEWER_TIMEOUT=900` und exit 0 — die 300 s des Standards reichen für codex
hier nicht.

## Reviewer: gemini (gemini-cli 0.28.2)

VERDICT: REQUEST-CHANGES

- [MEDIUM] Impact/Risks — Die Leistung der ODER-Abfrage ist ungemessen. Ein
  Logikbaum über mehrere Spalten und eine eingebettete Beziehung kann deutlich
  langsamer sein als aneinandergehängte UND-Filter. Der Entwurf belegt
  *Korrektheit*, nicht *Laufzeit*. — Plan für den schlimmsten Fall aufnehmen.
- [LOW] UI/Tasks — Die Sichtprobe auf feste 375 px und die heutigen
  Beschriftungen ist spröde; längere Texte oder ein fünfter Typ brechen sie. —
  Umbrechenden Aufbau verwenden und die Zusage darauf umstellen.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- [HIGH] proposal/design/tasks 2.4 — Die behauptete `anon`-„Messfalle"
  widerspricht dem Bestand: `feed.auswahl.integration.test.ts:398-402` meldet
  sich ab und erwartet eine volle Seite, obwohl der Select immer
  `post_media(...)` einbettet. Entweder war die Sonde ungültig oder der
  öffentliche Feed ist defekt — beides darf nicht als Kommentar konserviert
  werden. Zudem fehlt ein anonymer Mehrfachfilter-Test.
- [HIGH] tasks 1.7 / feed.ts:659 — „Genau ein `or()`" ist ab Seite 2 falsch: der
  Cursor verwendet `or()` bereits. Der Mock speichert `or` als eine Zeichenkette
  und überschriebe einen der beiden Aufrufe.
- [HIGH] tasks 5.5-5.6 — Der Plan-Review wird hinter die Implementierung
  geschoben und mit dem Diff-Review vermischt.
- [MEDIUM] tasks 1.2-1.8 — Die behauptete RED-Ursache existiert nicht: der Code
  kennt `typen` überhaupt nicht. Und zwei Zusagen sind schon heute wahr, können
  also unmöglich rot sein. Ein „enthält"-Test bleibt bei ignoriertem Filter grün.
- [MEDIUM] tasks 4.1-4.4 — Die einzelne Entfernung eines Typ-Chips ist nicht
  zugesagt, und die bestehenden Tests zu beiden „Filter entfernen"-Wegen stehen
  noch auf dem Einzelwert.
- [LOW] design 2-3 / tasks 3.1 — `[]` und alle vier Haken bleiben zwei
  ergebnisgleiche Zustände mit verschiedenen Schlüsseln. Die zugesagte
  Deduplizierung im Schlüssel ist ungetestet.

## Not counted

Keiner. Beide Vendoren liefen durch.

## Resolution

**codex HIGH 1 — angenommen, es war mein Fehler.** Nachgemessen: `anon` mit
eingebettetem `post_media` liefert auf DEV sehr wohl Zeilen (drei von drei). Die
Nullen in meiner ersten Messung kamen von den **Filtern**, nicht von der
Einbettung — keiner der drei öffentlich sichtbaren Beiträge ist ein Event oder
trägt ein Bild. Es gab nie eine `anon`-Falle. Die Warnung ist aus Proposal,
Design und Aufgaben **entfernt** statt umformuliert, und der geplante Kommentar
im Code entfällt. Ein anonymer Mehrfachfilter-Test ist als Aufgabe 1.7 ergänzt,
dazu ein Szenario im Delta.

**codex HIGH 2 — angenommen, und der Entwurf trägt trotzdem.** `feed.ts:659`
bestätigt: der Cursor setzt `or()`. Gemessen auf DEV: zwei `or=`-Parameter
werden **UND**-verknüpft (`or(A,B)` ∧ `or(B,C)` = `[B]`). Das ist genau die
gewünschte Bedeutung. Neue Entscheidung 1b im Design, Zusage 1.9 ersetzt „genau
ein `or()`" durch „Seite 1: eine Gruppe · Seite 2: zwei Gruppen", und der Mock
wird in Aufgabe 1.8 auf ein Array umgestellt.

**codex HIGH 3 — angenommen.** Aufgabe 5.5 heißt jetzt ausdrücklich *Diff*-Review
als Schritt 4 und hält fest, dass er diesen Plan-Review nicht ersetzt. Dieser
Review hier ist Schritt 2b und lief vor der ersten Codezeile.

**codex MEDIUM 1 — angenommen, und es war der schärfste Befund.** Neue Aufgabe 0
stellt zuerst die Schnittstelle um, damit Rot eine Aussage über Verhalten wird
statt ein Übersetzerfehler. Der Kopf der Aufgabenliste benennt jetzt, welche zwei
Zusagen **grün starten dürfen** (Regressionsschutz) — statt so zu tun, als wären
alle rot. Und jede Mengenzusage prüft die exakte ID-Menge, nie „enthält".

**codex MEDIUM 2 — angenommen.** Aufgaben 4.5 und 4.6 ergänzt.

**codex LOW — angenommen.** `normalisierteTypen` bildet die volle Menge auf `[]`
ab; die Abbildung sitzt in der Kanonisierung, nicht im Zustand der Oberfläche.
Zusagen 3.3 (Dubletten) und 3.4 (Vollmenge) ergänzt, dazu ein Szenario im Delta.

**gemini MEDIUM — angenommen** als Aufgabe 5.2b: Plan für drei Typen auf Seite 2
aufnehmen und lesen, Ergebnis in den Commit-Kopf. Nicht als Blocker geführt —
die Abfrage ist korrekt, die Frage ist ihr Preis.

**gemini LOW — angenommen** als Aufgabe 4.7 (`flex-wrap`).

**Zu gemini's Annahme „RLS komponiert korrekt mit dem ODER":** die
Sichtbarkeitsbedingung steht als RLS-Policy auf `posts` und wird vom Server mit
UND an jede Anfrage gehängt, unabhängig vom Logikbaum des Clients. Ein Client
kann sie über `or` nicht aufweichen. Die Zusagen in Abschnitt 1 laufen zusätzlich
unter einer echten Sitzung gegen den lokalen Stack, nicht unter `service_role`.

**Zu codex' Annahme „alle Beiträge entsprechen mindestens einem der vier Typen":**
das ist keine Annahme, sondern folgt aus der Definition — „Text" ist die
Abwesenheit der drei anderen, deckt also den Rest lückenlos ab. Genau darauf
beruht die Vollmengen-Kanonisierung.

**Zur Paritäts-Annahme (PostgREST-Version DEV/PROD vs. lokal):** teilweise
ausgeräumt. Beide Verhaltensweisen sind **auf DEV** gemessen, nicht nur lokal
(lokal: postgrest/14.5; DEV/PROD melden hinter Cloudflare keine Version). Für
PROD bleibt sie eine Annahme, gestützt darauf, dass beide Projekte dieselbe
verwaltete Plattform sind.
