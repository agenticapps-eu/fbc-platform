# Session Handoff — 2026-09-29 (AGE-969 Stufen nur noch Club)

> **Scope dieser Übergabe: AGE-969.** Fremde offene Punkte stehen hier nicht.
> AGE-927 ist ebenfalls abgeschlossen und auf PROD (PR #440, #442).

> ## ✅ ABGESCHLOSSEN UND AUF PROD
>
> PR #443 gemergt (`10c86ff`), Deploy grün, keine Migration nötig.
> **Es ist nichts offen.** Wer hier weiterarbeitet, fängt bei einem neuen
> Vorgang an — und darf diesen Worktree mit `wt remove` abräumen, ebenso
> `mitglied-anlegen` und `stufen-v5`.

## ⚠ Eine Sache braucht noch deine Entscheidung

**Die AGB § 3.2 ist mitgeändert.** Ein Reviewer hat dagegen einen HIGH-Befund
erhoben: ein Anwaltsdokument gehöre vor dem Ausrollen einer Kanzlei vorgelegt.
Der Einwand ist berechtigt; die Entscheidung war deine vom 29.09., deshalb ist
sie drin. **Soll eine Kanzlei zuerst schauen, nehme ich `src/content/legal/agb.ts`
einzeln wieder heraus** — der Rest des Change hängt nicht daran.

Was dort steht: die Aufzählung nennt Discover · Focus · Impact statt der sechs.
Das ist eine **Berichtigung** (sie führte noch *Basic* und *Exchange*, die es
seit AGE-903 nicht gibt) **und** eine Kürzung. Getragen wird sie vom Text
selbst: „derzeit insbesondere folgende" plus Einführungsvorbehalt.

## Accomplished

| | |
|---|---|
| Vitest | **256 Dateien, 2996 Zusagen** |
| `tsc --noEmit` · `eslint` · `pnpm build` | sauber |
| `openspec validate --all` | 35/0 |
| CI auf `8279154` | verify, migrations, edge-functions, pr-title grün |
| Deploy `36565950210` | alle vier Jobs grün |
| Ausgeliefertes Bündel | `10c86ff…` = Kopf von `main` |

**Vorher der Bestand:** drei Konten auf ACTIVE über `admin_set_tier` mit
Begründung auf DISCOVER gehoben (Spur dreimal `active → discover`). PROD danach:
**5 × discover, 73 × impact.** Ohne das wäre das Ausblenden Kaschierung gewesen.

**Live nachgemessen:** „Sechs Stufen" ist weg, „Der Club beginnt bei" steht da,
`Boost` kommt im Hauptbündel nicht vor. Die fünf `Connect`-Treffer dort sind
Bibliothekscode (`secureConnection`, `connectEnd`) — kein Stufenname. Im
`levels`-Chunk stehen `Active` und `Boost` weiterhin, **und das ist richtig so**:
`levels.ts` behält alle sechs Labels, `genannterName` gibt sie nur nie zurück.

## Decisions

**Sichtbarkeit und Recht bekommen zwei Konstanten.** `GENANNTE_STUFEN` wird
NICHT aus `CLUB_RANK` abgeleitet, obwohl beide heute dieselbe Menge ergeben.
*Warum:* jene Zahl steht als `has_level(4)` in den SQL-Policies. Wer BOOST
später wieder nennen will, müsste sie senken — dann liefen Oberfläche und RLS
auseinander, das Verzeichnis sähe erreichbar aus und die Datenbank verweigerte.

**Kein Ersatzname unterhalb des Clubs**, sondern ein Satz, der die Sackgasse
benennt und einen Weg nennt (Support › Feedback). *Warum:* das ist die einzige
Gruppe, die wächst — Selbstregistrierungen landen dort, der Kaufweg ruht.

**Der Bündel-Wächter wurde verworfen, bevor er gebaut war.** Die drei Namen
müssen im Bündel bleiben; ein Test darüber wäre ab dem ersten Bau rot gewesen.

## Files modified

`src/config/levels.ts` (+`GENANNTE_STUFEN`, `genannterName`, `waehlbareStufen`,
`KEIN_CLUBZUGANG_SATZ`) · `TierBadge` · `MembershipSummary` · `ProfileHero` ·
`MemberDirectory` · `MemberDashboard` · `AppShell` · `MemberLookup` ·
`EinstellungenPage` · `HomePage` · `PublicProfilePage` · `AdminMitglied(er)Page` ·
`MitgliedschaftPage` · `agb.ts` · `release-geschichten.ts` · `lastenheft.md` ·
zwei neue Testdateien.

## Next session: start here

**Nichts aus AGE-969.** Zwei Dinge liegen bereit:

1. **Die drei Neuigkeiten-Entwürfe** vom 29.09. (Artifact, privat) — Tutorials,
   Konto löschen, Stufen. Sie sind noch **nicht zugestellt**. Der Entwurf zu den
   Stufen sollte jetzt die AGB-Änderung erwähnen.
2. **AGE-928** — `/mitgliedschaft` als reine Anzeige. Sie liest dann
   `GENANNTE_STUFEN`; die Naht steht.

## Fallen, die diese Sitzung gekostet haben

* **Ein Wächter kann den eigenen Anforderungen widersprechen.** Ich schrieb im
  selben Entwurf, dass `levels.ts` alle Labels behält — und zwei Abschnitte
  später, dass die Wörter im Bündel nicht vorkommen. opencode hat es gefunden,
  nicht ich.
* **Eine Begründung, die ins Delta wandert, muss stimmen.** Meine zu `CLUB_RANK`
  war falsch (das Gating bliebe hart; auseinander liefen UI und RLS).
* **Ein `{tier}` in JSX rutscht durch jede Wortsuche.** Zwei Fundstellen, beide
  erst vom Quelltext-Wächter gefunden — nicht vom Lesen, nicht von drei
  Reviewern.
* **Ein Wächter über generiertem Inhalt fällt an der eigenen Erklärung:** der
  Archiveintrag zu AGE-969 nennt `LEVEL_ORDER`, weil er erklärt, dass die Leiter
  bleibt. Ausnahme mit Grund.
* **opencode kann ins Rate-Limit laufen** („Too Many Requests"). Dann zählt der
  Reviewer nicht — codex nehmen, der bei kleineren Artefaktsätzen durchläuft.
* **Eine ausgenommene, unerreichbare Seite ist eine Zeitbombe.** Besser die eine
  Zeile ändern als eine Ausnahme führen.

## Zustand der Umgebung

* **Lokaler Stack:** 28 Profile, 0 Tokens — Stand vor der Sichtprobe.
  `.env.local` gelöscht, vite beendet, Browser freigegeben.
* `20260925120000_release_backfill.sql` (AGE-905) fehlt lokal und bricht ab —
  **fremde Migration, nicht anfassen**.
* Im **Haupt-Checkout** liegt fremde ungesicherte Arbeit (AGE-907).
* Screenshots: `.gstack/age969/` und `.gstack/neuigkeiten/` (gitignored).

## Open questions

* **Die AGB** — siehe oben, deine Entscheidung.
* **Die Selbstregistrierung bleibt offen.** Wer sich registriert, landet weiter
  unterhalb des Clubs und kommt von dort nicht hoch, solange Stripe ruht. Ob der
  Knopf „Noch kein Konto? Registrieren" bleiben soll, ist eine Produktfrage und
  ein eigener Vorgang.
* **Diese Änderung ist Oberflächenkosmetik.** Das Repo ist öffentlich; alle
  sechs Stufen stehen weiterhin in `levels.ts` und in der Historie.
