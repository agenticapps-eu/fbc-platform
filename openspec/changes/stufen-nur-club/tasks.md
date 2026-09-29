# Aufgaben — stufen-nur-club (AGE-969)

## 0 · Vor der ersten Codezeile

- [x] Bestand auf PROD bereinigt: drei Konten auf ACTIVE über `admin_set_tier`
      mit Begründung auf DISCOVER gehoben. Nachher **5 × discover, 73 × impact**,
      Spur dreimal `active → discover` in `admin_audit`. Ohne das wäre alles
      Folgende Kaschierung
- [x] Fundstellen gezählt statt vermutet: `LEVEL_ORDER`/`levelLabel`/`LEVELS[`
      in 15 Dateien, davon 9 anzeigend
- [x] Gemessen, dass **alle** `minTier` im Baum `discover` lauten — die
      Schwellen-Texte sind nicht betroffen
- [x] Gemessen, dass `release-entries.generated.ts` **kein Mitglied** erreicht
      (nur `AdminNeuigkeitenPage` und `lib/release-notes.ts`; die beiden anderen
      Fundstellen sind Kommentare) — und dass es für den Admin-Vorrat mit
      `release_entry_skips` (AGE-636) längst eine Markierung gibt
- [x] Gemessen, dass `/mitgliedschaft` seit AGE-907 auf `/` umgeleitet ist —
      die Seite gehört zu AGE-928 und wird hier nicht angefasst
- [x] Gemessen, dass `StyleguidePage` hinter `import.meta.env.DEV` liegt

## 1 · Plan-Review (Gate, vor jeder Codezeile)

- [ ] `openspec validate --all` grün
- [ ] `openspec-change-review` mit **zwei** Modellen anderer Anbieter;
      `REVIEWS.md` mit signiertem Trailer
- [ ] Schwerpunkt für die Fremdreviewer: die Trennung von `CLUB_RANK` und der
      genannten Menge — ist sie wirklich nötig, oder ist sie eine Abstraktion
      für einen Aufrufer, den es nicht gibt?

## 2 · Die Festlegung

- [ ] RED: Zusage, dass `levels.ts` **sechs** Einträge führt und dass die
      genannte Menge genau `discover, focus, impact` ist
- [ ] `GENANNTE_STUFEN` in `src/config/levels.ts` — eigene Liste, nicht aus
      `CLUB_RANK` abgeleitet, mit der Begründung im Kopf
- [ ] Zusage, die die heutige Deckungsgleichheit mit den Clubstufen als
      **Stand** festhält, nicht als Gesetz — sie soll fallen, wenn jemand die
      Liste ändert, und erklären warum
- [ ] Ein Helfer „wird diese Stufe genannt?" — eine Stelle, nicht sechs
      Bedingungen

## 3 · Die eigene Stufe eines Mitglieds

- [ ] RED je Aufrufstelle: unterhalb des Clubs keine Plakette, im Club eine —
      beide Hälften
- [ ] `TierBadge` liefert `null` statt einer leeren Plakette
- [ ] **Je Aufrufstelle prüfen, dass das Layout ohne Plakette trägt**
      (`ProfileHero`, `MemberDirectory`, `MemberDashboard`, Einstellungen,
      `AdminMitgliederPage`, `AdminMitgliedPage`) — nicht annehmen
- [ ] Einstellungen: `{levelLabel(tier)}-Mitglied` → Aussage über den Zugang
- [ ] `ProfileHero`: `{levelLabel(tier)} Member` → nichts
- [ ] `MemberDashboard`: die Kachel „Stufe" und der Rückfall in der
      Mitgliederspalte
- [ ] `MembershipSummary`: kein Stufenname, kein „Nächster Schritt" auf eine
      verborgene Stufe

## 4 · Aufzählende Flächen

- [ ] RED: die Startseite zeigt drei Karten, und der Text nennt keine Sechs
- [ ] `HomePage`: Stufenschiene über `GENANNTE_STUFEN`, Satz „Sechs Stufen,
      aufsteigend" ersetzt. **Preise bleiben unberührt** — ob sie dort stehen
      dürfen, ist die Apple-Frage aus AGE-928
- [ ] RED: die Admin-Einzelbearbeitung bietet drei Stufen **plus** die am Konto
      gesetzte, falls sie darunter liegt
- [ ] `AdminMitgliedPage`: dieselbe Regel wie in `AdminMitgliederPage` seit
      AGE-903 — und die Regel steht dann an **einer** Stelle, nicht an zweien

## 5 · Texte

- [ ] AGB §3.2: Aufzählung auf Discover · Focus · Impact. **Keine andere Zeile
      der Datei anfassen**; der Kopf hält fest, dass der Text von einer Kanzlei
      stammt
- [ ] Im Dateikopf der AGB festhalten, was geändert wurde und auf wessen
      Entscheidung — der Kopf behauptet heute, §3.2 sei aktuell
- [ ] `release-geschichten.ts`: „Das Verzeichnis beginnt bei Connect" → Discover,
      in Titel und Text

## 6 · Der Wächter über dem Artefakt

- [ ] RED: eine Zusage, die im **gebauten** Bündel nach den drei Namen sucht
      und sie nicht finden darf
- [ ] Sie muss den Unterschied zwischen Stufenname und Wortbestandteil
      aushalten — „Connect" steckt in „Connection", „Active" in „Aktivität"
      nicht, aber in englischem Beiwerk schon. Die Zusage ist erst fertig, wenn
      sie an einer künstlich eingebauten Fundstelle **fällt**
- [ ] Sie gehört zu den Wächtern in `scripts/`, damit sie in CI läuft

## 7 · Abnahme

- [ ] Code-Review auf den **Diff** (zwei Anbieter, in `REVIEWS.md` aufgelöst)
- [ ] Sichtprobe gegen den lokalen Stack: ein Konto auf `active` und eines auf
      `discover` nebeneinander, in Profil, Verzeichnis, Dashboard und
      Einstellungen
- [ ] Sichtprobe der Startseite **ohne Konto**
- [ ] `pnpm build`, danach `git checkout -- src/content/release-entries.generated.ts`
- [ ] pgTAP unverändert grün — das Gating ist nicht berührt, und genau das soll
      die Zusage zeigen
- [ ] `docs/lastenheft.md` nachziehen

## 8 · Nach dem Merge

- [ ] Kein `migrate-prod` nötig — dieser Change trägt keine Migration
- [ ] Der Neuigkeiten-Eintrag dieses Change ist **für Mitglieder gedacht**: die
      Stufen heissen an der Oberfläche anders, das merkt jeder. Er gehört in den
      nächsten Beitrag (siehe die Entwürfe vom 29.09.)

## Bewusst NICHT in diesem Change

- [ ] `/mitgliedschaft` — gehört zu AGE-928, Route ist umgeleitet
- [ ] Preise, Kaufweg, Stripe — ruhend (AGE-907, AGE-908)
- [ ] Die Selbstregistrierung schliessen — eigene Produktfrage
- [ ] `profiles.tier` auf einen anderen Vorgabewert setzen — eine Migration für
      eine Anzeigefrage wäre der falsche Hebel
- [ ] `release-entries.generated.ts` umschreiben — erreicht kein Mitglied, und
      die Markierung dafür besteht bereits
