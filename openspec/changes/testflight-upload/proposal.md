## Why

AGE-907

`ios-release.yml` baut ein signiertes, geprüftes `.ipa` und hört dort auf. Der
Weg nach TestFlight ist am 07.09. durchgemessen worden — `xcrun altool
--validate-app` → „VERIFY SUCCEEDED with no errors" — aber bewusst nicht
verdrahtet, weil die Store-Seite damals noch nicht existierte. Der Dateikopf
sagt das selbst: „er ist hier nur bewusst nicht verdrahtet."

Damit bleibt der letzte Schritt Handarbeit: Artefakt aus dem Lauf laden, lokal
`altool` aufrufen. Das ist die Stelle, an der ein Release still danebengeht —
jemand lädt ein älteres Artefakt hoch, oder eines aus einem Lauf, dessen
Nachweisschritt gar nicht grün war. Donald hat die frühere Bedingung („erst
nach dem ersten Handupload") am 25.09. aufgehoben.

## What Changes

- **Der Workflow lädt nach TestFlight hoch** — `xcrun altool --upload-app`,
  mit demselben ASC-Schlüssel, der schon für Archiv und Export authentifiziert.
- **Nur auf ein geschobenes Tag `ios-v*`.** Ein Handstart
  (`workflow_dispatch`) baut, prüft und legt das Artefakt ab wie bisher, lädt
  aber **nicht** hoch — auch dann nicht, wenn er auf eine Tag-Referenz gerichtet
  wird. Die Bedingung prüft deshalb den **Auslöser** mit, nicht nur den Namen
  der Referenz. Damit bleibt der gefahrlose Probebau möglich, und eine
  Auslieferung an Apple braucht eine bewusste, benannte Handlung.
- **Der Upload steht hinter dem Signaturnachweis**, nie davor. Was die vier
  Prüfungen am `.ipa` nicht besteht, erreicht Apple nicht.
- **`--validate-app` läuft vor `--upload-app`** — es prüft gegen Apples Regeln,
  ohne eine Build-Nummer zu verbrauchen. Denselben Weg ist dieses Repo am
  07.09. schon gegangen.
- **Das Artefakt wird vor der Übertragung abgelegt.** Scheitert die Übertragung,
  ist das der Fall, in dem man das geprüfte Bündel am dringendsten braucht;
  dahinter entfiele die Ablage nach der üblichen Überspringregel.
- Der Wächter `scripts/ios-release.workflow.test.ts` bekommt Zusagen für
  Reihenfolge und Tag-Bedingung.
- **Nebenbei, auf Donalds Entscheidung vom 25.09.:** drei Dokumentstellen, die
  PR #419 zu Waisen gemacht hat — sie beschreiben Kaufwege, die es nicht mehr
  gibt. Kein Wächter findet sie, weil keiner Fließtext liest.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `native-shell`: Die Zusage „Ein nativer Bau läuft nur, wenn er angefordert
  wird" regelt heute nur den **Auslöser** des Baus. Sie bekommt einen zweiten
  Halbsatz für das **Ziel** des Ergebnisses: ein gebautes Bündel verlässt das
  Repository nur über ein Tag und nur nach bestandenem Nachweis. Dieselbe
  Begründung — nichts Unangefordertes —, eine Stufe schärfer, weil ein Upload
  anders als ein Bau nicht folgenlos ist.

## Impact

- `.github/workflows/ios-release.yml` — ein Schritt, plus Kopfkorrektur (der
  Kopf sagt heute ausdrücklich „Er lädt NICHT zu TestFlight hoch").
- `scripts/ios-release.workflow.test.ts` — der Wächter; er hat eine Zusage, die
  auf den Bereich **vor** `upload-artifact` schneidet. Weil die Ablage vorgezogen
  wird, bleibt dieser Schnitt unverändert klein.
- `docs/store-assets/README.md`, `docs/secrets.md`,
  `docs/technisches-handbuch.md` — die drei Waisen aus #419.
- **Keine Migration, kein Frontend, keine Edge Function.** `drift-gate` bleibt
  ohne Befund.
- Berührt **keine** Geheimnisse neu: `ASC_KEY_P8`, `ASC_KEY_ID`,
  `ASC_ISSUER_ID` und `APNS_TEAM_ID` liegen bereits in Infisical `prod` und
  werden vom Job schon geladen.
