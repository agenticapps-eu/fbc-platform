---
reviewers: [gemini, codex]
models: [nicht ausgewiesen, gpt-5.6-sol]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: d5b7b7a04692706847a8f18fc6b886d69e799cfd
---

# Change review — titelbilder-einpassen (AGE-596)

Gelaufen am 2026-08-25 gegen die **erste** Fassung des Changes
(`object-contain` bei unveränderter Bahnhöhe). Der Review hat den Entwurf
gekippt, nicht nur ergänzt — die heutige Fassung ist sein Ergebnis.

`REVIEWER_TIMEOUT=900`, beide Reviewer mit Exit 0. Mein eigener Vendor
(Anthropic) war ausgeschlossen.

## Reviewer: gemini (Modell nicht ausgewiesen)

VERDICT: APPROVE

- [MEDIUM] `EventCover.tsx` — Für `ProfileHero` ist der Platzhalter als
  Akzent-Verlauf definiert, für `EventCover` steht nur „dasselbe". Ist er dort
  eine flache Farbe, sieht ein Foto zwischen zwei Farbbalken nach Fehler aus.
  Fix: Platzhalter prüfen; ggf. eine unscharfe, abgedunkelte Kopie des Bildes
  als Untergrund.
- [LOW] Impact — Der Change nimmt an, dies seien die einzigen Stellen mit
  `object-cover` für Titelbilder. Fix: global suchen.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- [HIGH] proposal.md — Beide Upload-Wege erzwingen 3:1; der große Event-Kopf
  ist bereits 3:1 und beschneidet normale Uploads gar nicht. Der Kacheldefekt
  ist speziell ein 3:1-Bild in einem 16:9-Feld, und `object-contain` nutzte
  dort nur 59,3 % der Kachelhöhe. Die Lösung ist plausibel, aber nicht gegen
  verhältnisgleiche Container abgewogen. Fix: echte gespeicherte Verhältnisse
  erheben und je Fläche begründen.
- [HIGH] Spec — „Jedes Titelbild" verspricht eine globale Regel, während
  Impact und Tasks zwei Bauteile abdecken. Vorschau in `ProfilPage`, Vorschau
  im `EventCoverPicker`, Feed-Cover und die Verzeichnis-Karte aus AGE-595
  wären mit dem Archivieren sofort regelwidrig. Fix: aufzählen oder
  ausdrücklich einschränken.
- [HIGH] tasks.md — Der Platzhalter-Untergrund für Events wird weder gebaut
  noch getestet. Der Verlauf existiert nur im Zweig „kein Bild"; nach einer
  bloßen `object-contain`-Umstellung zeigt die freie Fläche das flache
  `bg-soft` des Elternteils und verletzt die eigene Zusage.
- [HIGH] tasks.md — Die geplante Messung kann `cover` und `contain` nicht
  unterscheiden: die `<img>`-Box behält in beiden Fällen die Container-Maße,
  nur der gemalte Inhalt ändert sich, und „naturalHeight × Skalierung" ist
  ohne definierten Faktor bedeutungslos. Fix: `s = min(bw/nw, bh/nh)`
  definieren, im Browser messen, jsdom-Tests ausdrücklich als strukturell
  kennzeichnen.
- [MEDIUM] proposal.md — Die Geometrie im Proposal ist widersprüchlich; ein
  7:1-Bild in einer 2,7–4,5:1-Bahn verlöre links und rechts, nicht oben und
  unten. Fix: natürliche Maße, Containermaße und die tatsächlich fehlenden
  Kanten aufnehmen, bevor die Screenshots als Beleg dienen.
- [MEDIUM] Spec — „lediglich kleiner" ist bei fester Höhe und `contain` nicht
  garantiert. Fix: nur zusagen, dass das ganze Bild sichtbar bleibt.
- [MEDIUM] Spec vs. Non-goals — „Kein Teil des Motivs" liest sich als Zusage
  über das Original, das beide Upload-Wege aber schon zuschneiden. Fix: das
  **gespeicherte** Bild als geschütztes Objekt definieren.

## Resolution

Der Review hat die Entwurfsentscheidung umgeworfen. Ich habe **gemessen**, statt
zu argumentieren: alle 55 Objekte des `covers`-Buckets, Maße aus den
Dateiköpfen, 0 Fehlschläge. Ergebnis — Median **2,70:1**, Minimum 1,33:1,
Maximum 3,00:1, keines breiter als 3:1; genau **2** liegen auf 3:1, die
übrigen 53 stammen aus dem WP-Import.

Damit ist codex' Prämisse („die Uploads sind 3:1, also sind die Bilder 3:1")
für 2 von 55 richtig und für den Rest falsch — der Befund trägt trotzdem, nur
mit anderer Zahl: das Feld hat das falsche Verhältnis, nicht die
`object-fit`-Regel.

- **HIGH (3:1 vs. contain)** — angenommen und weitergedreht. Die Felder werden
  3:1, `contain` bleibt nur Auffangnetz für die vier Ausreißer. Neu erhoben:
  Profilkopf verliert 56 % der Bildhöhe (Bahn 6,1:1, breiter als das Bild),
  Kachel 34 % der Breite (Feld 1,78:1, schmaler als das Bild).
- **HIGH (Geltungsbereich)** — angenommen. Die Anforderung zählt die drei
  Bauteile auf und schließt Vorschauen, Feed und Verzeichnis-Karte
  ausdrücklich aus.
- **HIGH (Platzhalter-Untergrund)** — angenommen. Der Verlauf liegt jetzt als
  Zusage **unter** dem Bild, mit eigenem Szenario und eigener Task. Deckt
  zugleich gemini [MEDIUM] ab; die unscharfe Bildkopie ist verworfen, weil sie
  bei 3:1-Feldern kaum je sichtbar würde und einen zweiten Renderpfad kostet.
- **HIGH (Messverfahren)** — angenommen. `s = min(bw/nw, bh/nh)`, Messung im
  Browser, jsdom ausdrücklich nur strukturell.
- **MEDIUM (falsche Geometrie)** — angenommen; meine Ursachenbeschreibung war
  aus dem Screenshot geraten. Korrigiert in Proposal, Spec und im Linear-Issue.
- **MEDIUM (schmaleres Fenster)** — angenommen, Szenario umformuliert.
- **MEDIUM (Original vs. gespeichert)** — angenommen, in der Anforderung
  benannt.
- **gemini [LOW] (global suchen)** — durchgeführt: `object-cover` steht an
  zwölf Stellen, davon sind acht Avatare, Feed-Bilder oder Vorschauen. Genau
  die drei benannten Bauteile tragen Titelbilder. Der Befund führte zur
  Einschränkung des Geltungsbereichs oben.

Nicht angenommen: nichts.

## Not counted

Keine. Beide Reviewer liefen mit Exit 0.
