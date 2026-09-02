# Session Handoff — 2026-08-31 (AGE-642: D5 ist vorbereitet, das Gerät fehlt)

> ## ⚠ ZUERST: Diese Sitzung macht NUR die mobile Hülle
>
> **AGE-642 (Capacitor-Hülle) gehört hierher, alles andere nicht** (Donald,
> 31.08.). Frühere Fassungen schleppten fremde Punkte mit — das war der Grund
> für drei Rebase-Konflikte auf dieser Datei in zwei Tagen. Wer den Stand
> ausserhalb AGE-642 braucht, **fragt die Sitzung `fbc-platform-f4`**.
>
> ### ⛔ Für AGE-599 gilt weiterhin: NICHT löschen
>
> Die acht Objekte in `event-covers` auf DEV stammen aus dem Spiegel DEV ← PROD
> (AGE-576); kein Skript stellt sie wieder her. Steht als SHALL NOT in
> `openspec/specs/design-system/spec.md`.

Branch `donald/age-642-capacitor-huelle`, sauber, gepusht, **7 Commits vor
`origin/main`** (vier Handoffs, zwei aus dieser Sitzung, einer der Feature-Merge
davor). Change `capacitor-huelle`: **29 offen, 89 erledigt** (war 31/87).
`openspec validate --all` 30/30. Linear steht auf *In Progress*.

**Kein Code angefasst.** Diese Sitzung hat gemessen und vorbereitet.

## Accomplished

### 1 · Der Krypto-Weg, am LEBENDEN Bündel nachgestellt

`pruefeSchluesselpaar` läuft im Deploy und vergleicht zwei Schlüssel
miteinander — **es fasst das ausgelieferte Bündel nie an.** Nichts belegte, dass
die Kette am fertigen Artefakt aufgeht. Jetzt schon, gegen PROD
(`viwntbodrtqxgmqyxluh`), Manifest `0.0.0+e8a2abcdcb21`, mit dem Schlüssel **aus
`capacitor.config.ts` gelesen** statt abgeschrieben:

1. `sessionKey` RSA-geöffnet (PKCS#1) → AES-128-CBC-Schlüssel und IV.
2. Chiffrat 2.997.808 B entschlüsselt → 2.997.792 B, beginnend mit `PK`.
3. SHA-256 des Klartext-Zips == RSA-geöffnete `checksum`, **byte-gleich**
   (`ec0737e811bd8ed2…`).

**Mit Positivkontrolle:** ein gekipptes Byte → `8d75277684dff5db…`, die Probe
rötet. Genau der Fehlschlag, der auf dem Gerät still bliebe. Steht als eigener
Punkt unter D3 in `tasks.md`.

### 2 · Zwei stehengebliebene Kästchen, beide Messungen

- **B5 Grössenzuwachs** — mit `actool` (Xcode 26.6) am **kompilierten**
  `Assets.car` gemessen: **+329.936 B**, iOS allein. Die Quelldateien hätten
  +277.162 B gesagt, **~53 KB zu niedrig**: die Capacitor-Vorgabe brachte drei
  byte-identische PNG mit (Blob `33ea6c9`), die `actool` einmal ablegt.
- **D3 `publicKey`** — stand als offen, war es seit D3 nicht mehr
  (`capacitor.config.ts:105`, testbewacht).

### 3 · Das Runbook für die Gerätesitzung

`openspec/changes/capacitor-huelle/geraetesitzung-d5.md`. Donald hat es dieser
Sitzung ausdrücklich vorgezogen, statt D5 sofort zu fahren.

**Der teuerste Fehler liegt VOR der Sitzung:**
`ota_buendel_veroeffentlichen` ist ein **Upsert auf `version`**. Das defekte
Bündel unter der Fassung des guten veröffentlicht, überschreibt dessen `url`,
`checksum` und `session_key`, während `created_at` stehen bleibt — danach gibt
es im Manifest nichts mehr, worauf zurückgerollt werden könnte. Und derselbe
Mechanismus macht einen Aufräum-Lauf unter bekannter Fassung wirkungslos.

Deshalb drei eigene Fassungen über `GITHUB_SHA`, **ohne einen einzigen Commit**:
`0.0.0+600df00d` (heil, sichtbare Marke) · `0.0.0+defec7ed` (defekt) ·
`0.0.0+c1ea4ed0` (Aufräumen). Sprechendes Hex, im Manifest ohne Nachschlagen
erkennbar.

**Beide Griffe fassen keine Quelldatei an**, sondern das gebaute `dist/` — es
gibt nichts, das jemand zurückzunehmen vergessen kann.

## Decisions

- **Der Griff für das defekte Bündel ist `#root` entfernen**, nicht ein `throw`
  in `src/`. `ota.ts` beschreibt den Fall unten selbst: ohne `#root` richtet das
  Modul planmässig nichts ein, `main.tsx` wirft, der Bildschirm bleibt leer.
  Preis, ehrlich benannt: **der Beobachter aus Runde 6 wird dabei umgangen.**
  Belegt wird die Plugin-Hälfte (Frist, `checkRevert`, ERROR bleibt liegen); die
  andere trägt `ota.test.ts` mit sieben gegengeprüften Zusagen.
- **Gemessen statt vermutet:** `<div id="root"></div>` und `</body>` stehen im
  gebauten HTML wörtlich und je genau einmal; `createRoot(null)` wirft in jsdom
  gegen das echte react-dom, mit `#root` nicht (Positivkontrolle).
- **Kein Skript ins Repo.** Die Griffe sind je vier Zeilen im Runbook. Ein
  Werkzeug für einen Lauf, der einmal stattfindet, wäre mehr Rahmen als Inhalt.

## Files modified

`openspec/changes/capacitor-huelle/tasks.md` (Krypto-Beleg unter D3;
Grössenzuwachs gemessen; `publicKey` nachgeführt; D5 zeigt aufs Runbook) ·
`openspec/changes/capacitor-huelle/geraetesitzung-d5.md` (**neu**) ·
`session-handoff.md`.

## Next session: start here

**Das Runbook fahren — `geraetesitzung-d5.md`, §0 zuerst.** Die Vorbedingung
ist die, die am leichtesten übersehen wird: die App auf dem Gerät **muss aus
`ddbd8ad` oder neuer gebaut sein**. Eine ältere Schale bestätigt ihren Start
blank im Modulrumpf, rollt nie zurück — und Probe 2 belegte dann nichts.

Danach §2, §3, §4 der Reihe nach. **§4 ist nicht optional:** `defec7ed` bleibt
sonst das neueste Bündel im Manifest, und jede Neuinstallation zieht es.

## Open questions — alle innerhalb AGE-642

- **Kein einziger Beleg stammt von einem Gerät.** Neu belegt ist die
  Krypto-Hälfte am ausgelieferten Artefakt; alles danach — installieren, neu
  starten, `notifyAppReady`, Rückfall — bleibt Gerätebeleg.
- **Vier weitere Gerätebelege**, in §6 des Runbooks gesammelt: C3 auf beiden
  Plattformen · C2 auf Android · C1 auf iOS · B5 der Startbildschirm.
  **B5 verlangt, die App zu löschen, und das kostet die Anmeldung** — deshalb
  zuletzt.
- **B3 Signaturmaterial (3 offen):** Zertifikat, Provisioning Profile, Keystore,
  plus der Workflow, der sie einspeist. Donalds Hand. **Für D5 nicht nötig** —
  ein Xcode-Lauf aufs eigene Gerät genügt (`DEVELOPMENT_TEAM` von Hand).
- **A2, Kästchen Z. 70** (`navItems`-RED-Zusage) steht offen, ist aber womöglich
  längst von `nav.test.ts` und den zwei `SidebarNav`-Tests gedeckt. Ungemessen —
  eine der vier Optionen, die Donald diese Sitzung nicht gewählt hat.
- **Der lokale Stack trägt die drei OTA-Migrationen nur von Hand.** Ein
  `supabase db reset` stellt sie korrekt her.
- **Nicht angefasst, ausserhalb AGE-642:** `docs/prod-neuaufbau-plan.md:31-32`
  nennt noch `foelowldexkcqzewvrcf` als Live-Fläche (falsch seit 24.08.) ·
  `scripts/sync-dev-auszug.test.ts` ist per Bauart flakig · `ADR-0037` wird
  dreimal zitiert, existiert aber nicht.
