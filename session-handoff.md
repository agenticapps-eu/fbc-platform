# Session Handoff — 2026-08-20 (sechste Sitzung)

**AGE-576 ist fertig und liegt als PR #194.** Gruppe 6 vollständig, der Change
ist archiviert. Der Diff-Review hat vier echte Löcher gefunden — alle behoben,
alle gemessen.

## Accomplished

**5.5 auf der ausgelieferten Fläche** (`7cd2de1`). Der einzige Teil des
Spiegels, den noch niemand angesehen hatte. `fbc-platform.pages.dev` liest gegen
DEV — im Bundle nachgelesen, nicht aus der Konfiguration geschlossen.
Verzeichnis 36 Mitglieder, Profile vollständig, Aktivität mit echten
Autorennamen, 7 kommende Events mit Anmeldezahlen, Admin-Liste mit Paging,
**Konsole über alle Seiten leer**. Dafür trug `vorschau@fbc.invalid` (TLD
existiert nicht) kurz ein Wegwerf-Passwort; zurückgenommen und dreiteilig belegt
(1/72 → 0/72 und „Invalid login credentials" an der Fläche).

**6.1** — Exit 0, 1326 → nach den Behebungen 1333 Tests, typecheck sauber,
lint 0 Fehler. **Prettier ist kein Gate**: kein Workflow ruft es auf, und
`prettier --check .` meldet auf HEAD 139 Bestandsdateien.

**6.2** (`e8d90fa`). Beide Dokumente nachgezogen, Schritt 0 des Neuaufbau-Plans
geschlossen (Weg A).

**6.3** (`5a9e705`, `4fbafd7`, `6693679`). gemini APPROVE, codex
REQUEST-CHANGES mit 10 Befunden. **Keiner übernommen, alle zehn am Code
nachgeprüft.** Vier behoben (Donalds Entscheidung), vier folgenlos, zwei
Bauform.

**6.4/6.5** (`63bb1b7`). `openspec archive` gelaufen, `validate --all` 31/31.
PR #194 offen, Linear steht durch die Automation auf In Progress.

## Decisions

- **Alle vier tragenden Befunde behoben, nicht nur die billigen.** Donalds
  Entscheidung. Der schwerste: **4.13 stand am Ende des Laufs** — dazwischen
  lagen `public.sql`, zwei Prüfschritte, der Drift-Scan und 125 Uploads über das
  Netz. Jedes `ende()` darin liess DEV mit gültigen PROD-Hashes zurück, bei
  offener Selbstregistrierung. *Warum das mehr wiegt als ein Ablauffehler:* die
  Neutralisierung ist einer der zwei Ausgleiche für „keine Anonymisierung".
- **`dateien` im Manifest ist Pflicht, ohne Toleranzpfad.** *Warum:* ein
  fehlendes Feld durchzuwinken liesse die Lücke für genau die Auszüge offen, die
  sie haben. **Folge: der gespeicherte Auszug vom 20.08. ist nicht mehr
  einspielbar.** Die Prüfsummen nachträglich zu ergänzen wäre unehrlich — sie
  beschrieben die Datei von heute, nicht die vom Erzeugungszeitpunkt.
- **Bucket-Vergleich in beide Richtungen.** *Warum:* dieselbe Regel wie beim
  Migrations-Drift; ein Gate, das nur eine Richtung sieht, ist die Hälfte eines
  Gates.
- **Die Demo-Dokumente wurden als historisch gekennzeichnet, nicht angepasst.**
  *Warum:* eine neue Demo zu erfinden war nicht Aufgabe. Auf DEV nachgezählt:
  **0** Konten auf `@fbcdemo.com`, **0** auf `@demo.fbc.invalid`, von 72.
- **Der „drei Werte"-Widerspruch wurde NICHT gefixt.** Die MODIFIED-Anforderung
  nennt `SUPABASE_DB_PASSWORD` beim Wechsel des Frontend-Routings, das Runbook
  sagt „zwei Werte, nicht drei". *Warum nicht:* der Fehler steht schon im
  Hauptspec, ist Bestand und gehört nicht in diesen Diff. **Eigenes Issue wert.**

## Files modified

- `scripts/sync-dev-ruecklauf.ts` — 4.13 hinter den auth-Rücklauf, pgcrypto aus
  dem Katalog, `pruefeSqlDateien` und `vergleicheBuckets` vor dem Löschen, alle
  56 Tabellen einzeln nachgezählt
- `scripts/sync-dev-ruecklauf.logic.ts` — `pruefeSqlDateien`, `vergleicheBuckets`,
  `Manifest.dateien`
- `scripts/sync-dev-auszug.ts` / `.logic.ts` — Prüfsummen beider Dumps ins
  Manifest, `SQL_DATEIEN`
- `scripts/sync-dev-ruecklauf.test.ts` — 7 neue Tests, alle erst rot
- `docs/supabase-environments.md` — Abschnitt „Der Spiegel DEV ← PROD"; **vier
  Bestandsaussagen korrigiert**, die durch den Spiegel falsch geworden waren
- `docs/prod-neuaufbau-plan.md` — Schritt 0 geschlossen, Schritt 1 auf das
  Werkzeug, **neuer Schritt 3b** für die Bild-URLs
- `docs/demo-zugang.md`, `docs/demo-script.md` — HISTORISCH
- `docs/foundation-acceptance.md`, `docs/w4-acceptance.md` — Nachtrag
- `openspec/changes/archive/2026-08-20-sync-dev-from-prod/` — archiviert
- `openspec/specs/environment-sync/` (neu), `deployment-environments/`

## Next session: start here

**PR #194, CI-Stand prüfen** — `gh api repos/agenticapps-eu/fbc-platform/commits/<HEAD-SHA>/check-runs`,
nur die HEAD-SHA zählt. Bei grün mergen (Freigabe steht generell), danach
`gh pr view 194 --json state` gegenprüfen — `gh pr merge` kann still
fehlschlagen. Linear schaltet beim Merge selbst auf Done.

Der Change hat **keine Migrationen**, also kein `drift-gate`-Problem und kein
`migrate-prod`.

Danach ist der PROD-Neuaufbau dran (`docs/prod-neuaufbau-plan.md`, jetzt mit
geschlossenem Schritt 0 und Schritt 3b). **Erster Handgriff dort ist ein neuer
Auszug aus PROD** — der alte ist mit diesem Code nicht mehr einspielbar, und
beides fällt beim Klassifikator, gehört also an Donalds Terminal mit `!`.

## Open questions

- **`avatar_url`/`cover_url` sind absolute PROD-URLs** (56 bzw. 53 Zeilen, keine
  einzige relativ). Der Spiegel kopiert die 111 Objekte korrekt — dasselbe
  Objekt liefert auf beiden Seiten 35364 Bytes — sie werden nur nie gelesen. Für
  Weg (A) folgenlos; unter neuer Kennung zeigen 109 Bild-URLs ins Leere. Steht
  als Schritt 3b im Plan. **Dauerhaft wäre die Umstellung auf relative Pfade —
  Anwendungscode, eigenes Issue.**
- **DEV trägt 72 echte Adressen und einen lebenden E-Mail-Webhook** mit
  PROD-identischem Resend-Zugang. Heute verstellt durch neutralisierte Hashes und
  `contact_requests = 0`, aber die Selbstregistrierung ist offen. Rücknahmeliste
  vor Go-Live.
- **Zwei Befunde bewusst offen** (`REVIEWS.md`): eine deklarierte Abweichung
  entschuldigt die **ganze** Tabelle, und Katalognamen wie `a"b` werden nicht als
  SQL-Identifier quotiert.
- **`socials` ist auf keiner öffentlichen Fläche sichtbar** — 34 Profile tragen
  Netzwerke, `profiles_public` führt die Spalte nicht. Bestandscode.
- **4.7 ist nur zu einem Drittel gemessen** — die Post- und
  Benachrichtigungshälften liefen leer (`contact_requests = 0`,
  `notifications = 0`).
- Unverändert offen: Detlevs Zahlungsliste (AGE-534) · Downgrade (AGE-516) ·
  `admin_list_feedback()` ohne Paging · AGE-497 · AGE-541 · AGE-512 · AGE-256 ·
  AGE-513 · AGE-258 · eigenes Issue für `send-activation` (2xx trotz
  Resend-401) · `demo_personas.sql` scheitert lokal an einem Fremdschlüssel
  (vorbestehend).
