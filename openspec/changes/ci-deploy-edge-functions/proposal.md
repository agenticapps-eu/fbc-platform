## Why

Linear: **AGE-506**.

`grep -rn "functions deploy" .github/` ist **leer**. Von den drei Flächen rollt
CI zwei aus — Frontend (`deploy`) und Migrationen (`migrate-dev` /
`migrate-prod`) — und Edge Functions **gar nicht**.

Das ist zweimal aufgeschlagen: bei AGE-495/B2 existierten die drei
Aktivierungs-Functions auf PROD überhaupt nicht, während der Change als „live"
geführt wurde; und der Code-Review zu PR #133 musste als Befund melden, dass ein
PR `send-activation` ändert, ohne dass irgendetwas sie ausliefert. Die
Gegenmaßnahme war bisher eine Merkregel (Aufgabe 11.2 (f) in
`member-activation-flow`). Eine Regel, an die gedacht werden muss, ist genau das,
was hier zweimal versagt hat.

## What Changes

- Neuer Job **`functions`** in `deploy.yml`. Läuft auf `main`, hängt an denselben
  Vorbedingungen wie `deploy` (`migrate-dev`, `drift-gate`).
- Er leitet aus den geänderten Dateien des Merges ab, **welche** Functions
  betroffen sind, und deployt **nur diese** — auf DEV **und** PROD.
- Nach dem Deploy liest er `supabase functions list` je Projekt und protokolliert
  Version und Prüfsumme; übersprungene Functions werden **namentlich** genannt.
- Neues Skript `scripts/changed-functions.logic.ts` (reine Ableitung, unter Test)
  plus ein dünner CLI-Aufruf.
- `docs/secrets.md` und die Aufgabe 11.2 (f) werden auf den neuen Zustand
  gebracht: die Merkregel wird durch den Job ersetzt, nicht ergänzt.

**Blocker, der außerhalb des Repos liegt:** `SUPABASE_ACCESS_TOKEN` existiert
nicht als GitHub-Secret. Ohne ihn kann der Job nichts tun.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `deployment-environments`: bislang ist nur das **Aufsetzen** eines Projekts
  geregelt („Edge Functions und ihre Secrets gehören zum Aufsetzen eines
  Projekts"). Für den **laufenden Betrieb** fehlt die Regel — genau dort
  entsteht die Drift. Ergänzt wird eine Anforderung über das fortlaufende
  Ausliefern.

## Impact

**CI** — `.github/workflows/deploy.yml` (ein Job), `scripts/` (ein Skript plus
Test).

**Nicht betroffen** — `migrate-dev`, `migrate-prod`, `drift-gate` und der
`deploy`-Job selbst bleiben unverändert; der neue Job hängt sich nur an dieselben
Vorbedingungen.

**Zwei Fallen, die der Entwurf ausdrücklich behandelt:**

1. `supabase functions deploy` ohne Namen deployt **alle sechs**. Das überschriebe
   `notify-contact-request` auf PROD, wo laut 11.4 bewusst ein älterer Stand
   liegt.
2. Eine Function kann einen RPC aufrufen, den es auf PROD noch nicht gibt —
   Migrationen gehen dort nur von Hand. Deshalb dieselben Vorbedingungen wie
   `deploy`.
