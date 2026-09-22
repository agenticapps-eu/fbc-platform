# anforderung-eingang

Detlevs Custom GPT „eff.bee.zee Anforderungen" ruft diese Function über eine
ChatGPT-Action auf, und sie legt direkt ein Linear-Issue an: Team AgenticApps,
Zustand Triage, Projekt „eff.bee.zee — Backlog", Label `von-detlev` plus eines
nach Art. Screenshots und Zielbilder hängen eingebettet daran.

- Entscheidung: `docs/decisions/0006-anforderungen-direkt-nach-linear.md`
- Vertrag mit dem GPT (OpenAPI-Schema, Teil 4): `docs/custom-gpt-anforderungen.md`
- Spec und Design: `openspec/changes/anforderung-eingang/` (nach dem Archivieren
  `openspec/specs/anforderungen/`)
- Linear: AGE-830

## Aufbau

| Datei | Was |
|---|---|
| `index.ts` | `Deno.serve`, baut die echten Abhängigkeiten, sonst nichts |
| `eingang.ts` | Der Ablauf: Schlüssel → JSON → Rumpf → Drossel → Dateien → `issueCreate` → Zähler |
| `pruefung.ts` | Pflichtfelder und Grenzen, Fehler als vorlesbare Sätze |
| `dateien.ts` | Download, Hostliste, Größe, Signatur, Fristen, Upload |
| `linear.ts` | `fileUpload`, `PUT`, `issueCreate` über rohes GraphQL |
| `beschreibung.ts` | Markdown des Issues, Maskierung, Datum in Europe/Berlin |
| `frist.ts` | Lässt jedes Warten spätestens mit dem Signal enden |

Tests: `deno test --allow-env --allow-net --allow-read=supabase/functions supabase/functions/anforderung-eingang/`
aus dem Repo-Wurzelverzeichnis. Kein Test ruft das Netz oder legt ein Issue an.

## Grenzen

| | |
|---|---|
| Dateien | höchstens 10; PNG, JPEG, WebP, GIF, MP4, MOV; je 25 MB |
| Download | nur `https://files.oaiusercontent.com`, keine Weiterleitungen |
| Zeit | 12 s je Datei, 25 s für alle, 8 s für `issueCreate`. ChatGPT bricht nach 45 s ab |
| Drossel | 20 angelegte Issues pro Stunde, global (`anforderung_frei`, `anforderung_vermerken`) |

## Secrets

`LINEAR_API_KEY`, `ANFORDERUNG_SCHLUESSEL`, auf DEV zusätzlich
`ANFORDERUNG_PROBELAUF=1`. Wie man sie setzt und per Hash prüft, steht in
`docs/secrets.md`, Abschnitt „anforderung-eingang".

## Probelauf

Mit `ANFORDERUNG_PROBELAUF=1` läuft alles bis einschließlich der Downloads
echt, aber es wird nichts hochgeladen, nichts angelegt und nichts gezählt. Die
Antwort ist 200 mit `{ probelauf: true, hinweis }`. Im Log (`event: probelauf`)
stehen je Datei Typ, Größe, Host und Ergebnis. Dort sieht man beim ersten Test,
ob OpenAIs Links weiterleiten (`weitergeleitet nach …`). Dann muss
`ERLAUBTE_HOSTS` in `dateien.ts` erweitert werden.

## Log

Kein Text, kein Titel, kein Einreicher, kein Dateiname, kein Link, kein
Schlüssel. Ereignisse: `angelegt` (mit `nummer`), `probelauf`,
`issue_nicht_bestaetigt`, `gedrosselt`, `schluessel_abgelehnt`,
`abgelehnt_400`, `secret_fehlt`, `drossel_fehler`, `vermerken_fehler`,
`unerwartet`.

## Deploy

```bash
supabase functions deploy anforderung-eingang --project-ref <ref>
```

`verify_jwt = false` steht in `supabase/config.toml`.
