# Detlevs Anforderungen gehen aus ChatGPT direkt nach Linear

Linear: **AGE-830** · Entscheidung: `docs/decisions/0006-anforderungen-direkt-nach-linear.md`
· Vertrag mit dem GPT: `docs/custom-gpt-anforderungen.md`

## Why

Detlev formuliert Wünsche, Änderungen und Fehler als Fließtext in KI-Dialogen:
nicht verortet, ohne Bild und ohne Priorität. Am 22.09. ist gemessen, was den
Umweg über eine Sammelstelle im Admin (AGE-680) begründet hatte, und es war
falsch: eine Custom-GPT-Action **überträgt** Dateien (`openaiFileIdRefs`),
auch vom GPT erzeugte Zielbilder. Damit kann der GPT direkt einen
Linear-Eingang beliefern, und Linears Triage übernimmt den Eingangskorb, den
wir sonst selbst bauen müssten.

## What Changes

- **Neue Edge Function `anforderung-eingang`** (`verify_jwt = false`). Sie nimmt
  von der ChatGPT-Action `titel`, `beschreibung`, `art`, `einreicher`, optional
  `route` und bis zu 10 Dateien entgegen und legt daraus **ein** Linear-Issue
  an.
- **Echtheit über ein geteiltes Geheimnis** im Header
  `x-anforderung-schluessel`, verglichen in konstanter Zeit. Kein JWT, kein
  `apikey`.
- **Pflichtfelder werden serverseitig erzwungen.** Fehlt etwas oder ist ein Wert
  unzulässig, antwortet die Function mit 400 und einem ganzen deutschen Satz, den
  der GPT vorlesen kann. Es wird nichts Halbes angelegt.
- **Das Ziel ist fest verdrahtet**: Team AgenticApps, Zustand Triage, Projekt
  „eff.bee.zee — Backlog", Label `von-detlev` plus ein Label je Art (fehler → Bug,
  aenderung → Improvement, funktion → Feature, idee → Idee). Der Aufrufer kann
  nichts davon wählen.
- **Dateien werden im selben Aufruf geladen**, weil ChatGPTs Links nach fünf
  Minuten verfallen, und per Linear-`fileUpload` abgelegt. Bilder stehen
  eingebettet in der Beschreibung, Videos als Link. Eine Datei, die nicht
  ankommt, wird mit Namen und Grund vermerkt, und das Issue entsteht trotzdem.
- **Legt an, ändert nie.** Es gibt keinen Pfad, der ein bestehendes Issue
  berührt.
- **Rate-Begrenzung** nach dem Muster `activation_attempts`, mit einer **neuen**
  Migration.
- **Antwort 201** mit `nummer` (z. B. `AGE-901`) und `hinweis`, ohne Linear-URL.
- **Probelauf-Schalter per Secret**, damit ein Testlauf gegen DEV kein echtes
  Issue anlegt.
- `docs/secrets.md` bekommt `LINEAR_API_KEY` und `ANFORDERUNG_SCHLUESSEL` in die
  Tabelle und den `supabase secrets set`-Befehl, `.env.example` Platzhalter.
- `docs/custom-gpt-anforderungen.md` Teil 4 wird nachgezogen, wo Felder,
  Grenzen oder Antworten abweichen (mindestens die Antwort bei Linear-Ausfall).

## Capabilities

### New Capabilities

- `anforderungen`: Der Eingang für Anforderungen von außen. Wer darf einreichen
  (geteiltes Geheimnis), was muss eine Anforderung tragen, wohin geht sie (fest
  verdrahtetes Linear-Ziel), wie werden Dateien übernommen und was bekommt der
  Einreicher zurück. **Die Wahl der Capability entscheidet Donald**, siehe
  `design.md`, offene Frage 1. Die Alternative ist ein Delta auf `feedback-qm`.

### Modified Capabilities

(keine)

## Impact

- **Neu:** `supabase/functions/anforderung-eingang/` (`index.ts` als dünner
  Rumpf, reine Logik in eigenen Dateien mit `deno test`), ein Block in
  `supabase/config.toml` (bewacht von `scripts/functions-config.test.ts`), eine
  Migration für die Drossel.
- **Fremddienste:** Linear-GraphQL (`issueCreate`, `fileUpload`) über einen
  Personal API Key, also erscheinen Issues als von Donald angelegt. Downloads von
  OpenAI-Dateilinks.
- **Datenschutz:** Screenshots können Mitgliedernamen und Fotos zeigen, und sie
  gehen an OpenAI und Linear. Das ist in AGE-830 offen und wird von diesem Change
  nicht entschieden.
- **Nicht betroffen:** Frontend, RLS auf Bestandstabellen, `database.types.ts`.
- **Ausrollen:** zwei Supabase-Projekte (DEV `foelowldexkcqzewvrcf`, PROD
  `viwntbodrtqxgmqyxluh`). Donald setzt die Secrets von Hand und prüft sie per
  SHA-256.
- **Aufräumen:** `supabase/functions/bildtest/` wird nicht committet und am Ende
  gelöscht. Die ausgelieferte Function löscht Donald.
