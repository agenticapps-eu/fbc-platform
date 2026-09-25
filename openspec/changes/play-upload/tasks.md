## 1. Plan-Review (Gate 2b)

- [x] 1.1 `openspec validate --all` grün, bevor Code entsteht.
- [x] 1.2 Plan-Review mit ≥2 **fremden** Anbietern, Ergebnis in `REVIEWS.md`.
      Begründung wie bei `testflight-upload`: neues Geheimnis, Auslieferung nach
      außen, fremde Action — Sicherheitsspalte.
      **Besonders vorlegen:** dass hier nichts messbar ist, und die Wahl des
      Kanals `internal`. — **Gefahren:** codex, REQUEST-CHANGES, sechs Befunde;
      fünf übernommen, einer zur Hälfte widerlegt (siehe `REVIEWS.md`).

## 2. Der Wächter zuerst (RED)

- [x] 2.1 In `scripts/android-release.workflow.test.ts` schreiben und rot sehen:
      - Es gibt **genau einen** Schritt, der an einen Store überträgt — nicht
        „mindestens einen". Ein zweiter, ungeschützter Upload-Schritt daneben
        würde jede andere Zusage erfüllen und die Zusage trotzdem brechen
        (Plan-Review, MEDIUM).
      - Dieser Schritt nennt die Action mit **SHA-Pin**.
      - Bedingung `github.event_name == 'push'` **und** Tag-Präfix
        `refs/tags/android-v` — **je eine Zusage**, gemessen an der **aktiven**
        `if:`-Zeile, nicht am Blocktext. (Beide Lehren aus `testflight-upload`:
        eine Zusage über den ganzen Ausdruck überlebt das Entfernen einer
        Hälfte, eine Zusage auf den Blocktext überlebt das Auskommentieren.)
      - Reihenfolge: „Signatur nachweisen" → `upload-artifact` → Schlüsselprobe
        → Upload.
      - Der Upload nennt **nur das AAB**, nicht das APK, und über
        `releaseFiles` (Plural) — `releaseFile` ist am gepinnten Stand
        durchgestrichen.
      - Der Kanal steht als `internal` da — gepinnt, damit eine Änderung
        sichtbar ist.
      - Das Secret wird mit `:?` geprüft, es gibt **kein** `if` auf seine
        Anwesenheit.
      - Der Schlüssel geht als **Datei** unter `$RUNNER_TEMP` an die Action
        (`serviceAccountJson`), **nicht** als Klartext über die Umgebung —
        Roh-JSON trägt Zeilenumbrüche, und ein Infisical-Wert ist nicht
        GitHub-maskiert (Plan-Review, MEDIUM).
- [x] 2.2 Gegenprobe, jede Mutation muss rot werden — einschließlich der zwei,
      die frühere Wächter überlebt hätten:
      - **auskommentieren statt entfernen** bei Bedingung und Schlüsselprobe,
      - **ein zweiter, ungeschützter Upload-Schritt** daneben.

## 3. Die Schritte (GREEN)

- [x] 3.1 Schlüsselprobe: `PLAY_SERVICE_ACCOUNT_JSON` aus Infisical `prod`
      holen, mit `:?`-Form, und als **Datei** unter `$RUNNER_TEMP/play.json`
      ablegen (`umask 077`, danach `test -s`) — wie der ASC-Schlüssel nebenan.
      Nicht ins Log, nicht in die Umgebung.
- [x] 3.2 Upload-Schritt mit `r0adkll/upload-google-play@e738b9dd…` (v1.1.5),
      `serviceAccountJson` = der Pfad, `packageName: com.effbeezee.app`,
      `releaseFiles` = das AAB, `track: internal` (Donalds Entscheidung vom
      25.09.), `status: completed`.
- [x] 3.3 Dateikopf: was der Workflow jetzt nach außen gibt, unter welcher
      Bedingung, **und dass nichts davon gemessen ist**. Dazu die drei offenen
      Fragen aus `design.md` als Warnung für den ersten Lauf.
- [x] 3.4 Alle Zusagen aus 2.1 grün.

## 4. Sicherheit (Gate `cso`)

- [x] 4.1 Belegen, dass der Service-Konto-Schlüssel **nicht ins Lauf-Log** gerät:
      kein `echo`, kein `cat`, Übergabe nur als **Dateipfad**. Ausdrücklich
      festhalten, was das NICHT belegt: was die fremde Action selbst mit dem
      Inhalt tut (Plan-Review).
- [x] 4.2 Belegen, dass der Artefaktpfad unverändert genau **zwei** Dateien
      nennt — der Keystore liegt in diesem Moment im Baum.
- [x] 4.3 `scripts/native-secrets-guard.ts` grün.
- [x] 4.4 Den SHA-Pin der fremden Action gegen GitHub prüfen (`gh api`), nicht
      abschreiben.

## 5. Verifikation (Gate 5)

- [x] 5.1 `pnpm vitest run scripts/android-release.workflow.test.ts` grün, Zahl
      notiert.
- [x] 5.2 `pnpm typecheck`, `pnpm lint` grün. **Kein `pnpm format`.**
- [x] 5.3 `openspec validate --all` grün.
- [x] 5.4 Volle Suite grün, Zahl notiert.
- [x] 5.5 **Was NICHT belegt ist, ausdrücklich:** dass der Upload funktioniert,
      dass der Kanalname stimmt, dass das Service-Konto die nötige Rolle trägt,
      dass Play das AAB annimmt. Nichts davon ist messbar, solange kein
      Service-Konto existiert. Der Wächter belegt die **Form**.

## 6. Code-Review (Gate 4)

- [x] 6.1 Unabhängiger Reviewer auf dem Diff, mit `the-pragmatic-programmer` und
      `refactoring` als Linse. **Ausdrücklich vorlegen:** die fremde Action und
      die Behandlung des Schlüssels.

## 7. Abschluss

- [ ] 7.1 Conventional Commit mit `AGE-907`, signiert.
- [ ] 7.2 PR gegen `main`. In den Text: dass nichts gemessen ist, der Kanalname
      eine Vorgabe ist, und dass jedes `android-v*`-Tag bis zum Anlegen des
      Schlüssels rot läuft.
- [ ] 7.3 In AGE-907 die drei Voraussetzungen notieren, die Donald vor dem
      ersten Tag erledigen muss: Service-Konto anlegen, Rolle vergeben,
      Schlüssel nach Infisical, Kanalnamen bestätigen.
- [ ] 7.4 Archivieren nach dem Merge, dann `pnpm release:entries`.

## 8. Belege dieses Laufs

| Was | Ergebnis |
|---|---|
| `android-release.workflow.test.ts` | **16 Zusagen grün** (5 bestanden vorher, 11 neu) |
| Gegenprobe Android | **12 Mutationen, alle rot**; Positivkontrolle grün; Datei zeichengleich (`630d2611…`) |
| Gegenprobe iOS (nachgezogen) | **9 Mutationen, alle rot**; zeichengleich (`9de31360…`) |
| Volle Suite | **252 Dateien, 2901 Zusagen** grün |
| `pnpm typecheck` · `pnpm lint` | grün · **0 Fehler**, 8 vorbestehende Warnungen |
| `openspec validate --all` | **36/36** |
| `native-secrets-guard` | 1697 Dateien, kein natives Geheimnis |
| Plan-Review (2b) | codex REQUEST-CHANGES, gemini APPROVE — 6 Befunde, 5 übernommen, 1 zur Hälfte widerlegt |
| Code-Review (4) | codex REQUEST-CHANGES — MEDIUM übernommen, HIGH begründet vertagt |

**Erster Lauf der vollen Suite: 4 rot, Wiederholung grün.** Die Namen sind
nicht mitgeschnitten — das ist eine Lücke im Beleg und wird hier als solche
genannt, nicht als „bekannte Flakes" weggeredet.

**Die drei Umgehungsformen derselben Zusage, alle an einem Tag gefunden:**
etwas **entfernen** (meine eigene Gegenprobe), etwas **auskommentieren**
(Code-Review iOS), etwas **anhängen** — `|| true` (Code-Review Android). Nur die
erste hatte ich selbst bedacht. Die Gegenproben beider Plattformen tragen jetzt
alle drei.

**Was NICHT belegt ist:** dass der Upload funktioniert, dass der Kanalname
passt, dass das Service-Konto die Rolle trägt, dass Play das AAB annimmt. Es
gibt kein Service-Konto — nichts davon ist messbar. Der Wächter belegt die
**Form**.

## 9. Offen, an Donald gemeldet

- [ ] 9.1 Service-Konto anlegen, in der Play Console verknüpfen, Release-Rolle
      geben, JSON als `PLAY_SERVICE_ACCOUNT_JSON` nach Infisical `prod`.
      **Bis dahin ist jedes `android-v*`-Tag ein roter Lauf** — gewollt.
- [ ] 9.2 **Folgepunkt aus dem Code-Review (HIGH), bewusst nicht hier gelöst:**
      `INFISICAL_TOKEN` ist ein Repository-Secret und damit aus jedem
      Same-Repo-PR erreichbar. Der Kopf von `android-release.yml` benennt das
      seit AGE-642 B3 als „eigener Vorgang". Dieser Change legt **ein Geheimnis
      mehr** in diesen Radius.
