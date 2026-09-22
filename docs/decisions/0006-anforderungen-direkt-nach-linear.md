# ADR-0006: Detlevs Anforderungen gehen aus ChatGPT direkt nach Linear

**Status**: Accepted  **Date**: 2026-09-22  **Linear**: AGE-830 (ersetzt Abschnitt 4 von AGE-680)

## Context

Detlev Krause formuliert Wünsche, Änderungen und Fehlermeldungen als
Fließtext in KI-Dialogen: nicht verortet, Vision und Wunsch vermischt, ohne
Priorität. Am 01.09. fiel die Entscheidung für einen **Custom GPT** in
ChatGPT, der über eine Action an eine Sammelstelle im Admin-Bereich
(`/admin/anforderungen`, AGE-680) schreibt. Von dort sollte Donald per Knopf
ein Linear-Issue anlegen.

Getragen war dieser Umweg von einer Behauptung, die niemand nachgemessen
hatte: **„Custom-GPT-Actions übertragen keine Binärdaten."** Deshalb sollten
Bilder über einen späteren Anmerkungs-Knopf in der App oder durch
Nachreichen in der Sammelstelle kommen.

Am 22.09. mit einer Wegwerf-Function `bildtest` und einem Test-GPT
nachgemessen:

- ChatGPT schickt Dateien im Body-Feld **`openaiFileIdRefs`** als Array von
  Objekten `{ name, id, mime_type, download_link }` (dokumentiert unter
  developers.openai.com/api/docs/actions/sending-files).
- Das gilt für **hochgeladene Screenshots und für vom GPT erzeugte Bilder**.
  Screenshot plus erzeugtes Zielbild in einem Aufruf kommen beide an.
- `download_link` ist **fünf Minuten** gültig.
- Der Supabase-Gateway nimmt bei `verify_jwt = false` Aufrufe mit **nur**
  einem eigenen Header (`x-anforderung-schluessel`) an. Kein `apikey`-Header
  nötig. Die offene Frage aus AGE-680, ob die Edge Function der richtige Wirt
  ist, ist damit beantwortet.

## Decision

**Die Action ruft eine Edge Function `anforderung-eingang`, die direkt ein
Linear-Issue anlegt — mit den Bildern als eingebettete Dateien.**

- Ziel fest verdrahtet: Team AgenticApps, Zustand **Triage**, Projekt
  „eff.bee.zee — Backlog (nach Go-Live)", Label `von-detlev` plus ein Label
  nach Art (fehler → Bug, aenderung → Improvement, funktion → Feature,
  idee → Idee).
- Der Eingangskorb ist Linears **Triage**, nicht eine eigene Fläche im
  Produkt. Nichts landet ohne Donalds Handgriff in einem Zyklus.
- Die Function lädt Dateien **im selben Aufruf**, weil die Links nach fünf
  Minuten verfallen.

## Consequences

- **AGE-680 schrumpft.** Abschnitt 4 (Eingang von außen) entfällt dort. Ob
  die Sammelstelle für QM-Feedback (Abschnitte 1–3, 5) noch gebaut wird, ist
  eine eigene Entscheidung.
- **Aufwand** ~1,5 Tage statt 4,5 Tage.
- **Detlev braucht keinen Linear-Zugang.** Er bekommt die Issue-Nummer
  zurück, keine URL.
- **Issues erscheinen als von Donald angelegt** (Personal API Key). Eine
  OAuth-App mit eigenem Akteur ist nachrüstbar.
- **Personenbezogene Daten verlassen die Plattform.** Screenshots können
  Namen und Fotos von Mitgliedern zeigen; sie gehen an OpenAI und Linear. Der
  GPT weist darauf hin. Ob Screenshots nur aus Testkonten kommen sollen, ist
  in AGE-830 offen.
- **Der Preis bleibt:** Jede Anforderung bekommt binnen einer Woche einen
  Zustand, bei Ablehnung einen Satz Begründung. Sonst hört Detlev auf, den
  Weg zu benutzen.

## Alternatives considered

- **Sammelstelle `/admin/anforderungen` (AGE-680).** Verworfen für diesen
  Eingang: ihr Hauptargument (Bilder kommen nicht über die Action) ist
  widerlegt, und Linear-Triage leistet den Eingangskorb ohne eigenen Bau.
- **ChatGPT Apps SDK (MCP-Server mit `openai/fileParams`).** Kann dasselbe,
  verlangt aber einen eigenen MCP-Server und App-Freigabe. Für eine einzige
  Person mit ChatGPT Plus ist der Custom GPT mit Action der kleinere Weg.
- **Claude-Desktop-Plugin, Formular, Sprachnotiz.** Verworfen am 31.08.
  (Detlev arbeitet in ChatGPT; ein Formular füllt er nicht aus; eine
  Sprachnotiz kann nichts verorten).
