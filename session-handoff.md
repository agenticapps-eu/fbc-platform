# Session Handoff — 2026-09-04 (AGE-542: fertig, gemerged, archiviert)

> ## ⚠ ZUERST — Scope dieser Datei
>
> **Diese Übergabe führt AUSSCHLIESSLICH AGE-542.** Die Datei ist für alle
> parallelen fbc-platform-Sitzungen dieselbe und kollidiert bei jedem Rebase.
> **Nicht zusammenführen** — fremde Punkte gehören der Sitzung, die sie
> bearbeitet. Frühere Fassungen: `git log --oneline -- session-handoff.md`.
>
> **Was hier NICHT hineingehört und wem es gehört:**
> - **AGE-642** (Capacitor-Hülle) — läuft parallel im Worktree
>   `fbc-platform.donald-age-642-capacitor-huelle`. **Nicht anfassen.** Hat am
>   04.09. selbst #330 und #331 nach `main` gebracht.
> - **Der Push-Absturz am Gerät** (`AppShell.tsx:662` → Firebase FATAL) — von
>   Donald am 04.09. entschieden: **bleibt bei AGE-642.** Diese Sitzung hat
>   `AppShell.tsx` nicht angefasst.
> - **AGE-688 / AGE-697** — abgeschlossen, PRs #326–#329.
>
> **Die Merge-Sperre ist erledigt.** Sie galt, solange AGE-642 Geräteprobe 2
> fuhr. Diese Sitzung hat inzwischen selbst nach `main` gemerged; Donald hat den
> Merge am 04.09. ausdrücklich freigegeben.

## Accomplished

**AGE-542 ist gebaut, fremdreviewt, gemerged und archiviert.** 44 von 44
Aufgaben erledigt.

| | |
|---|---|
| Code-PR | **#332**, squash-gemerged als `a725be2` |
| Archiv-PR | siehe unten — Zweig `donald/age-542-archiv` |
| Tests | **2517/2517** in 221 Dateien |
| Tore | `lint`, `typecheck`, `build` je Exit 0 · `openspec validate --all` 31/31 |
| Spec | Delta gefaltet nach `openspec/specs/directory-search/spec.md` |
| Neuigkeiten | ein Eintrag, in Mitglieder-Sprache, **noch nicht freigegeben** |

### Was der Change tut

Der anon-Wächter **leitet seine Prüffläche ab, statt sie abzuschreiben**: aus
`navItems` (ohne `requiresAuth`/`minTier`), aus der importierten
`rechtsseiten`-Registry und aus einer namentlich geführten Restliste. Jede Route
wird **montiert**, samt echtem `AuthProvider`; `src/test/anon-sonde.ts` hält jede
Relation und jeden Funktionsnamen fest. Der Rand ist über den TypeScript-AST auf
`App.tsx` selbst zugesichert und fällt geschlossen aus.

### Die vier Funde, die nicht geplant waren

1. **Das Repo war blind, nicht nur der Wächter.** Mit allen drei Eingriffen im
   Baum blieb die VOLLSTÄNDIGE Suite grün — 2478/2478.
2. **Der Prüfstand war zweimal still grün**, bevor er stand: zwischen Hülle und
   Seite liegen ~295 ms, weil die Seiten seit AGE-642 `lazy()` sind. Vorwärmen
   der Module hilft nicht (71 Module, `import` danach 0 ms, Zeitachse
   unverändert). Steht als Gedächtniseintrag unter [[vitest-und-jsdom-fallen]].
3. **`pnpm build` schreibt `release-entries.generated.ts` unformatiert um.** Vom
   Diff-Review gefunden, wäre sonst mitgewandert.
4. **Der Neuigkeiten-Eintrag hätte einen verworfenen Namen ausgeliefert.** Das
   Proposal nannte in „What Changes" noch `ANON_DARF_AUSFUEHREN`, den `design.md`
   D4 längst durch `ANON_RUFT_AUF` ersetzt hatte. Die Vorschau **vor** dem
   Archivieren hat es gefangen.

## Decisions

- **Der Bestandsfehler wird an der Abfrage behoben, nicht am Recht.**
  `enabled: Boolean(user)` am `FeedbackButton`; `feedback_themes` bleibt für
  `anon` gesperrt. Einziger Eingriff in Produktivcode.
- **Die Sonde liegt in `src/test/`**, nicht in `src/lib/__proben__/` wie geplant
  — dort liegt schon `auth-fixtures.tsx`, eine zweite Konvention wäre gegen
  „match the existing style".
- **Die Rüstung übernimmt den Provider-STAPEL aus `App.test.tsx`, nicht dessen
  Auth-Weg.** D7 und D2 widersprechen sich wörtlich: `App.test.tsx` umgeht über
  `AuthFixture` gerade den `AuthProvider`, den D2 mitlaufen sehen will.
- **Die Kette der Sonde ist ein Proxy, keine Aufzählung** — sonst bräche sie beim
  ersten neuen Kettenglied mit einem Absturz, der wie ein Fund aussieht.
- **Die Sicherheit liegt in der Positivkontrolle, nicht im Ruhefenster.**
  Gegengeprüft: Fenster auf 10 ms → rot, zurück auf 450 ms → grün.
- **Der Neuigkeiten-Eintrag sagt ehrlich, dass sich nichts Sichtbares ändert.**
  Es gibt keinen Weg, einen archivierten Change von den Neuigkeiten
  auszunehmen — jeder erzeugt einen Eintrag, das Tor ist die Admin-Freigabe.
  Die technischen Punkte stehen jetzt unter einer eigenen `##`-Überschrift, wo
  der Parser sie nicht mehr liest.

## Files modified

`src/components/feedback/FeedbackButton.tsx` (eine `enabled`-Zeile),
`src/lib/anon-anreicherung.test.ts` (Flächen-Wächter ausgezogen, 301 → 148
Zeilen), **neu** `src/lib/anon-flaeche.test.tsx` (33 Zusagen) und
`src/test/anon-sonde.ts`. Archiv:
`openspec/changes/archive/2026-09-04-anon-waechter-reichweite/`.
Gefaltet: `openspec/specs/directory-search/spec.md`. Nachgezogen:
`src/content/release-entries.generated.ts`.

### Was im Worktree liegt und nicht eingecheckt ist

`.gstack/eingriff.py` — schaltet die drei Abnahme-Eingriffe einzeln ein und aus
(`python3 .gstack/eingriff.py A|B|C on|off`, `status`), Bauteile in
`.gstack/eingriffe/`. `.gstack/probe-eintrag.mts` — zeigt den
Neuigkeiten-Eintrag, den der Parser aus einem Proposal machen würde, **vor** dem
Archivieren (`pnpm tsx .gstack/probe-eintrag.mts <change-id>`). Beides
gitignoriert.

## Next session: start here

**Für AGE-542 gibt es keinen nächsten Handgriff**, sobald der Archiv-PR gemerged
ist. Danach `wt remove` für diesen Worktree.

Wer hier weitermacht, nimmt einen neuen Vorgang. Offene Kandidaten im Go-Live-
Projekt, alle noch ungeplant: **AGE-618** (Wächter gegen Einbettung am
VideoEmbed vorbei), **AGE-605** (`event_registrations`: direkte Schreibzugriffe
umgehen die DEFINER-RPCs), **AGE-607** (Überlauf im Browser messen statt im
Quelltext), **AGE-630** (Events: Vorlagen und wiederkehrende Termine).

## Open questions

- **Der Neuigkeiten-Eintrag ist nicht freigegeben** und sollte es vielleicht
  nicht werden: für Mitglieder ändert sich nichts Sichtbares. Donalds Entscheid
  in der Redaktion. Mehrere ältere Einträge stehen dort ebenfalls offen.
- **Gehört die Anforderung noch unter `directory-search`?** Sie regelt jetzt
  Feed, Events, Anmeldung, Hülle und Funktionsaufrufe; codex schlug
  `access-control` vor. Bewusst **nicht** in diesem Change — der Umzug ist ein
  `REMOVED` plus `ADDED` über zwei Capabilities, also genau die Archiv-Mechanik,
  an der AGE-598 Zeit verloren hat. Eigener, rein ordnender Vorgang.
- **`/styleguide` ist eine namentliche Ausnahme** in `NUR_IM_DEV_BUENDEL`, statt
  ihre DEV-Bedingung im AST nachzuweisen. Die weichste Stelle des Prüfstands:
  wer die Liste missbraucht, umgeht die Randzusage.
- **Edge Functions sind nicht erfasst**, bewusst — sie gehen nicht über die
  Grants der Datenbankrolle. Als Grenze in der Spec benannt.
- **Zwei Escape-Lauscher derselben Bauart sind weiterhin ungemessen**
  (`AppShell.tsx`, Profilmenü und Nachrichten-Schublade) — offen aus AGE-697,
  kein Vorgang dafür angelegt.
