# Session Handoff — 2026-08-31 (AGE-642: D1 ist fertig, D3 ist dran)

> ## ⚠ ZUERST: Diese Sitzung macht NUR die mobile Hülle
>
> **AGE-642 (Capacitor-Hülle) gehört hierher, alles andere nicht** (Donald,
> 31.08.). Frühere Fassungen schleppten fremde Punkte mit — das war der Grund
> für drei Rebase-Konflikte auf dieser Datei in zwei Tagen. Wer den Stand
> ausserhalb AGE-642 braucht, **fragt die Sitzung `fbc-platform-f4`**; sie
> schreibt ihre Übergabe nicht mehr ins Repo.
>
> ### ⛔ Für AGE-599 gilt weiterhin: NICHT löschen
>
> Die acht Objekte in `event-covers` auf DEV stammen aus dem Spiegel DEV ← PROD
> (AGE-576); kein Skript stellt sie wieder her. Steht als SHALL NOT in
> `openspec/specs/design-system/spec.md`.

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`. Heute auf `origin/main` rebased (sauber),
danach **10 Commits voraus** — davon zwei mit Code.

Den Rückstand selbst messen, nicht hier ablesen:
`git fetch origin main && git rev-list --left-right --count origin/main...HEAD`.

Change `capacitor-huelle`: **D1 ist abgeschlossen.**

## Accomplished

**Phase D1 steht vollständig** — Speicher, Schreibweg und
Veröffentlichungs-Schritt.

* `eaedcdd` — Bucket `ota-buendel` und Manifest-Tabelle `public.ota_buendel`,
  per Migration. RLS an, keine Policy, kein Grant (Muster `activation_tokens`).
* `f765036` — `scripts/ota-buendel.logic.ts` (zippen und rechnen),
  `scripts/ota-buendel.ts` (hochladen und eintragen), die
  SECURITY-DEFINER-Funktion `ota_buendel_veroeffentlichen`, die Vertragsnummer
  `1.0.0` in `capacitor.config.ts` und ein Schritt in `deploy.yml`.

**27 pgTAP-Zusagen und 12 vitest-Zusagen, alle grün.** Der Kern des
vitest-Teils ist ein Rundlauf, der das Gerät nachspielt: sessionKey mit dem
öffentlichen Schlüssel öffnen, AES entschlüsseln, Archiv **auspacken**,
Prüfsumme vergleichen. Zusätzlich einmal gegen den **echten** Schlüssel und das
**echte** 2,75-MB-Bündel gefahren — `index.html` an der Wurzel, 0 von 64
Sourcemaps drin.

## Der Schlüssel ist getauscht und gemessen

Donald hat am 31.08. einen 2048-Bit-Schlüssel erzeugt und in Infisical `prod`
abgelegt. Fünf Messungen an `~/Documents/capgo_privat.pem`: 2048 Bit · PKCS#1
in beiden Dateien · Chiffrat **256 Byte** · Rundlauf byte-gleich · Base64 344
und Hex 512 Zeichen, also genau die Längen, die die Tabelle verlangt.

**Nicht selbst nachgemessen:** dass der Wert in Infisical derselbe ist wie die
Datei. Das braucht ein echtes Terminal. Donald hat es abgelegt und gesagt.

## Decisions

- **Der Objektname trägt den INHALT**, nicht nur die Fassung:
  `<version>-<sha256(chiffrat)[0..16]>.bin`. Das kam aus dem Fremd-Review und
  erledigt drei HIGH-Befunde auf einmal — ein Re-Run desselben Commits
  überschreibt keine liegende Datei mehr, und es gibt kein Zeitfenster, in dem
  die Manifest-Zeile auf veränderte Bytes mit alten Kryptowerten zeigt.
  `deploy.yml` trägt `cancel-in-progress: true`, dieses Fenster war real.
- **Zwölf Stellen des SHA** in der Fassung, nicht sieben (28 Bit sind bei
  tausend Auslieferungen rund 0,2 % Kollisionsgefahr).
- **AES-128**, weil das Plugin diese Länge durchgängig benennt und die
  Verschlüsselung Echtheit trägt, nicht Vertraulichkeit.
- **Der Schreibweg ist eine DEFINER-Funktion**, kein Tabellen-Grant für
  `service_role`. Das Repo macht es nirgends anders.
- **Kein npm-Modul fürs Zippen.** `zip` liegt auf `ubuntu-latest`; eine neue
  Abhängigkeit führe in jedes `pnpm install` und berührte die Sperrdateien, die
  f4s Dependabot-PRs anfassen.

## Files modified

`eaedcdd` + `f765036`: `supabase/migrations/20260831100000_ota_buendel.sql` ·
`…140000_ota_buendel_veroeffentlichen.sql` · `supabase/tests/ota_buendel_test.sql`
(27 Zusagen) · `scripts/ota-buendel.logic.ts` · `…logic.test.ts` · `…ota-buendel.ts`
· `capacitor.config.ts` · `.github/workflows/{ci,deploy}.yml` · `tasks.md` ·
`design.md` · `REVIEWS.md` (Runden 3 und 4) · `docs/decisions/0005-…md`.

## Next session: start here

**D3 — die drei Endpunkte als Edge Functions.** Das ist der nächste Block, und
er bringt auch das Plugin selbst mit.

**Zwei Dinge sind für D3 schon entschieden und gemessen:**

1. **Der `updateUrl`-Endpunkt trägt die Ordnung allein.** Das Gerät vergleicht
   Fassungen auf **Ungleichheit**, nicht auf Grösse
   (`CapacitorUpdaterPlugin.java:4909`, `.swift:4360`). Liefert der Endpunkt ein
   älteres Bündel, installiert das Gerät es kommentarlos. Also ausdrücklich
   `order by created_at desc` und das erste Bündel nehmen, dessen
   `benoetigte_schale` das Gerät erfüllt.
2. **Fehlt der `config.toml`-Block zu einer Function, gilt `verify_jwt = true`**
   — das Gateway antwortet dann mit 401, bevor der Handler läuft, und kein Log
   der Function erklärt es. Alle drei brauchen je einen Block.

**Und der Lesepfad braucht wieder eine DEFINER-Funktion.** `service_role` hält
auf `ota_buendel` kein Recht; ein `.from("ota_buendel").select(...)` in einer
Edge Function läuft durch Typecheck und Tests und scheitert erst zur Laufzeit.

**Beim Hinzufügen von capgo — die Reihenfolge:** `pnpm add` →
`deno install --frozen=false` → **zwingend** `pnpm install`. Das macht
`edge-functions` rot, obwohl die Functions capgo nie importieren; der Fix sind
zwei Zeilen im selben Commit. **Vorher mit f4 abstimmen** — das ist der einzige
Punkt, an dem wir dieselben Sperrdateien anfassen wie ihre Dependabot-PRs.
Fassung `8.51.15`, **nicht** `9.x`/`10.x`.

**Weiter zu beachten:**

1. **Postgres-Regex: `{n}` höchstens 255.** `{512}` läuft beim Anlegen durch und
   fällt erst beim ersten INSERT mit `2201B`. Als `length(…) = n` schreiben.
2. **Der Drift-Gate blockt den Frontend-Deploy**, solange die zwei Migrationen
   nicht auf PROD/DEV angewendet sind. Nach dem Merge `migrate-prod`
   dispatchen — das wendet ohne Rückfrage an. **Vor** dem ersten Deploy auf
   `main`, sonst scheitert der OTA-Schritt am fehlenden Bucket.
3. **Nach JEDEM `pnpm build`, vor jedem `git add`:**
   `git checkout -- src/content/release-entries.generated.ts`.

**Migration + RLS heisst Fremdreviewer.** Für D1 liefen zwei Runden, beide in
`REVIEWS.md`. **codex braucht mehr als zehn Minuten** — im Hintergrund starten,
ein Bash-Aufruf schneidet ihn ab.

## Open questions — alle innerhalb AGE-642

- **Der Weg über das Netz ist ungeprüft:** Upload in den Bucket und RPC-Aufruf.
  Beide brauchen ein laufendes Projekt mit angewandten Migrationen und werden
  erst beim ersten Deploy auf `main` sichtbar. Alles davor — zippen,
  verschlüsseln, Längen, Schreibweg — ist belegt.
- **Vier Gerätebelege stehen aus:** C3 auf beiden Plattformen · C2 auf Android ·
  C1 auf iOS · B5 der Startbildschirm. **Für B5 muss die App gelöscht werden**
  (Launch-Screen-Zwischenspeicher), **und das kostet Donald die Anmeldung** —
  vorher ansagen.
- **B3 Signaturmaterial (4 offen):** Zertifikat, Provisioning Profile, Keystore.
  Donalds Hand. Vom OTA-Schlüsselpaar unabhängig.
- **`publicKey` in `capacitor.config.ts`** gehört zu D3, wo das Plugin dazukommt.
- **capgo-Version `8.51.15`, nicht `9.x`/`10.x`.** Reihenfolge beim Hinzufügen:
  `pnpm add` → `deno install --frozen=false` → **zwingend** `pnpm install`. Das
  macht `edge-functions` rot, obwohl die Functions capgo nie importieren.
  **Vorher mit f4 abstimmen** — einzige Stelle, an der wir dieselben Sperrdateien
  anfassen wie ihre Dependabot-PRs.
- **C3 ändert an zwei Stellen die Optik** (`WillkommenPage`, Bearbeiten-Formular
  im Feed) — gemergt, aber nie im Browser angesehen.
- **AGE-642 springt beim Merge selbst auf Done**, und die Automation geht auch
  zurück. Ein Status sagt hier weder „fertig" noch „unfertig" verlässlich.
- **Nebenbefund, nicht angefasst:** `ADR-0037` wird dreimal zitiert, existiert
  aber nicht (`docs/decisions/` führt 0001–0005).
