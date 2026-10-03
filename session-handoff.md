# Session Handoff — 2026-10-03 (V5 FINAL: V5F-1 Rechte, V5F-2 Chatleiste)

> **Scope dieser Übergabe: AGE-1000 und AGE-1002**, beide gemergt. Dazu der
> Vorgang, den V5F-1 aufgemacht hat (**AGE-1001**), und eine Frage, die aus der
> vorigen Übergabe offen geblieben ist.
> Fremde offene Punkte stehen hier nicht.

## Accomplished

**AGE-1000 (V5F-1) — Rechte werden Konfiguration.** PR #450, gemergt `dc50198`.
`public.berechtigungen` (zehn Rechte mit Mindestrang), `darf(schluessel)`,
`meine_rechte()`, `useDarf()` im Client. Vier Schwellen sind gewandert:
Verzeichnis-Suche und Events anlegen (samt Vorlagen) auf Rang 6,
`offers`/`needs` und `matches` auf Rang 5.

**AGE-1002 (V5F-2) — Chatleiste dunkelblau.** PR #451, gemergt `0510554`. Die
rechte Leiste trägt im Modus `navy` `#002B51`, ein- und ausgeklappt. Keine
Migration.

**AGE-999** steht jetzt im Projekt „Live-Schaltung V5", In Progress, als Dach.

## Decisions

- **Die Clubschwelle Rang 4 bleibt `has_level(4)`** und ist per
  Check-Constraint aus `berechtigungen` ausgeschlossen (ADR-0008). AGE-903 hat
  sie gerade zu *einer* Zahl für *eine* Tür zusammengezogen; zwölf
  funktionierende Aufrufer für null Verhaltensänderung umzuhängen wären zwölf
  Gelegenheiten, etwas zu brechen. Preis: zwei Mechanismen, festgeschrieben in
  `access-control`.
- **Anlegen fällt, Pflegen bleibt.** Die `ALL`-Policies sind in INSERT (mit
  Recht) und UPDATE/DELETE (nur Eigentum) geteilt. Ein abgestiegener Host sagt
  seinen Termin ab.
- **Ein Ladezustand ist ein Moment, ein Fehler ist ein Zustand** (im Kopf von
  `useDarf`). Routen-Gate: laden zeigt nichts, Fehler lässt durch. Aktionsknopf:
  laden verbirgt, Fehler zeigt. Filter: beides fällt offen.
- **Der Ort entscheidet, nicht ein Argument** (Chatleiste). `ThreadList` hat
  kein Variantenargument; die Tokens werden nur innerhalb von `.fbc-chat-rail`
  überschrieben. Wer die Liste auf eine dritte dunkle Fläche stellt, setzt die
  Tokens dort.
- **Keine Fremdreviewer für V5F-2** (Donalds Regel vom 26.08.: nur bei Schema,
  Rechten, Sicherheit). Steht samt Begründung in der archivierten `REVIEWS.md`.

## Files modified

Alles auf `main`. Die Einzelheiten stehen in den beiden PR-Texten; hier nur, wo
man nachsieht:

- `supabase/migrations/20261003100000_berechtigungen.sql` — Tabelle, `darf()`,
  `meine_rechte()`
- `supabase/migrations/20261003100100_rechte_v5_schwellen.sql` — die vier
  Schwellen, `search_directory` neu
- `supabase/migrations/20261003120000_vorlagen_und_policy_kommentare.sql` —
  Vorlagen folgen den Events, Kommentare auf allen neuen Policies
- `supabase/tests/rechte_v5_test.sql` — 60 Zusagen, Rang 3/4/5/6 plus ein nicht
  aktiviertes Rang-6-Konto
- `src/config/berechtigungen.ts`, `src/hooks/useDarf.ts`,
  `src/lib/berechtigungen.ts` — der Client-Weg
- `src/index.css` + `src/index.chatleiste-tokens.test.ts` — die Leisten-Tokens
  und die gerechneten Kontraste
- `docs/decisions/0008-rechte-als-konfiguration-mit-einer-ausnahme.md`
- `docs/lastenheft.md`, `docs/technisches-handbuch.md`

## Next session: start here

**Zuerst: `migrate-prod` steht aus.** `drift-gate` blockt seit dem Merge von
#450 **jeden** Deploy, auch den von #451 (der selbst keine Migration mitbringt).
Drei Migrationen warten. Der Weg: `gh workflow run "Migrate PROD" --ref main`,
dann den blockierten Deploy-Lauf mit `gh run rerun --failed` wiederholen.
**Das braucht Donalds ausdrückliches Wort** — die stehende Merge-Freigabe deckt
es nicht.

Danach ist **V5F-3 (Navigation)** der nächste Schritt aus
`261003_Plan_GoLive_V5-FINAL.md`; der Prompt liegt daneben und setzt V5F-1 auf
`main` voraus, was erfüllt ist. V5F-4 und V5F-5 hängen ebenfalls nur an V5F-1.

Vier Worktrees sind abräumbar: `rechte-v5-final`, `chatleiste-blau`,
`stufen-nur-club`, `mitglied-anlegen`.

## Open questions

1. **AGE-1001 — der Rohzugriff ist offen.** `profiles` und `profiles_public`
   sind für jedes Clubmitglied als *Menge* lesbar. „DISCOVER darf nicht gezielt
   suchen" gilt damit an der Oberfläche und an `search_directory`, **nicht** am
   direkten Tabellenzugriff. Bestand, nicht neu — aber V5F-7 verlangt den
   Nachweis zweifach, also blockiert es die Abnahme. Umfang gemessen: 20
   Abfragestellen, alle schon kennungsgebunden. Drei pgTAP-Zusagen nageln den
   heutigen Zustand fest und **müssen dort umgedreht werden**.
2. **E2 — die echten Stufen des Bestands.** PROD trägt 74 von 78 Konten auf
   `impact`. Bis Detlev die bezahlten Stufen liefert, ist die Differenzierung
   gebaut und belegt, aber für fast niemanden spürbar. Das blockiert den
   Go-live, nicht den Bau.
3. **E7 — zieht die linke Navigation auf `#002B51` nach?** Bis dahin
   unterscheiden sich die beiden Leisten sichtbar; das steht als Anforderung so
   drin, damit es niemand für einen Fehler hält. Ein Ja ist ein Einzeiler in
   `--sidebar-surface`.
4. **Aus der vorigen Übergabe, weiter offen: AGB § 3.2.** Ein Reviewer hat
   einen HIGH-Befund erhoben, ein Anwaltsdokument gehöre vor dem Ausrollen einer
   Kanzlei vorgelegt. Soll eine Kanzlei zuerst schauen, lässt sich
   `src/content/legal/agb.ts` einzeln wieder herausnehmen.
5. **Drei Release-Beiträge warten auf Zustellung** (Artifact-Seite, Version 5)
   und sind unabhängig voneinander. Dazu gibt es jetzt zwei neue
   Neuigkeiten-Einträge aus den heutigen Changes — beide in Mitglieder-Sprache
   und zum Zustellen gedacht, nicht zum Überspringen. **Zugestellt wird nichts
   ohne ausdrückliche Ansage.**

## Fallen, die heute Zeit gekostet haben

- `git checkout -- <datei>` holt die **committete** Fassung und nimmt
  ungesicherte Arbeit mit. Hat eine fertige Änderung gelöscht, während eine
  Probe zurückgenommen wurde. Für Proben stattdessen eine Kopie im Scratchpad.
- Der lokale Stack lag mit dem Schema **vor** der Historie (eine frühere
  Sitzung hatte Rümpfe von Hand eingespielt). `supabase migration repair
  --status applied --local <version>` statt `db reset` — der Stack ist geteilt.
- Ein Test, der nur prüft, was man schon getan hat, bewacht nichts: der
  Kontrast-Test las genau die zwei Tokens, die umgelegt waren, und sah deshalb
  nicht, dass der Hover-Zustand auf 1,0:1 stand.
- `try_as(...) = 'OK'` belegt bei UPDATE/DELETE **nichts** — ein Treffer von
  null Zeilen ist kein Fehler. Immer die Wirkung nachmessen.
