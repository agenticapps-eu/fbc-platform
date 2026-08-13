# Tasks — Profil aufräumen (AGE-539)

Reihenfolge ist verbindlich: zuerst die Erwartungen, dann der Ausbau.

**Eine Verhaltensaussage je `it`** — die Form, die `KontaktePage.test.tsx` schon
hat. Mehrere Erwartungen in einem Block halten beim ersten Fehlschlag an, und
ein RED-Schritt, der nach der ersten Zeile abbricht, sagt nichts über die
übrigen.

**Nicht jede Erwartung wird rot.** Rot müssen die *treibenden* sein (1.1–1.6).
Die *bewahrenden* (1.7) sind von Anfang an grün und sollen es bleiben — sie
sichern gegen ein Entfernen, das zu weit greift.

## 1 · Die Erwartungen schreiben

### Treibend — müssen scheitern

- [x] 1.1 `src/pages/ProfilAnsichtPage.test.tsx`: die Erwartung „Mein
      Erfolgsradar ist da" (Zeile 81) durch ihr Gegenteil ersetzen, und
      „Meine Auszeichnungen", „Meine Ziele", „Meine Entwicklung" sowie die
      Kachel „Matches" ebenso als **abwesend** erwarten.
- [x] 1.2 **Zweite Fixture mit Inhalt** anlegen — `themeScores` gefüllt, ein
      `badges`-Eintrag, ein `goals`-Eintrag, `dev_focus` gesetzt,
      `matchStats.successful > 0` — und gegen sie **dieselben fünf
      Abwesenheiten** prüfen. Ohne diesen Fall käme eine Umsetzung durch, die
      nur bei leeren Daten ausblendet, und zeigte die vertagte Oberfläche genau
      dem Mitglied, das etwas darin hat.
- [x] 1.3 Erwarten, dass keine Schaltfläche und kein Link „Zur persönlichen
      Roadmap" auf der Seite steht.
- [x] 1.4 Die Eckdatenzeile in **vier** Fällen (design §6a): nur Datum, nur
      Nummer, beides, keines von beiden. Geprüft wird jeweils, was **steht** und
      was **nicht** steht — inklusive: kein Gedankenstrich, und kein Trenner `·`
      vor einer fehlenden Nummer.
- [x] 1.5 Beiträge und Interessen im leeren Zustand: kein Titel aus `DEMO_POSTS`
      („Warum Ökosysteme …", „Deal-Keeping im Family Office …"), keine
      Zeichenkette „1,2k Views · 84 Likes", kein Element mit dem Text „Demo";
      der Beitragsbereich fordert **ausdrücklich zum Schreiben auf** (gegen den
      CTA-Text prüfen, nicht gegen den Link auf `/aktivitaet` — „Alle anzeigen"
      zeigt heute schon dorthin und käme sonst durch); der Interessenbereich ist
      **abwesend**.
- [x] 1.6 `src/pages/KontaktePage.test.tsx` **erweitern** (die Datei besteht
      seit dem 11.08. mit drei Fällen — nicht überschreiben): „Freunde",
      „Preferred Partner", „Mentoren", „Mentees", „Aufschlüsselung" und „Demo"
      erscheinen nicht. Zweiter Fall mit `contactsCount: 0`: weder eine
      Aufschlüsselung noch die Zahl null, stattdessen die bestehende Einladung
      „Mitglieder entdecken".

### Bewahrend — müssen grün sein und bleiben

- [x] 1.7 Mit gefüllten `interests` steht „Meine Interessen"; mit gefüllten
      `posts` stehen die echten Beiträge **und keine Einladung**; auf
      `/kontakte` steht bei `contactsCount: 1` die echte Zahl. Die drei
      bestehenden Fälle in `KontaktePage.test.tsx` bleiben unverändert.

- [x] 1.8 `pnpm test` laufen lassen und die **Fehlermeldungen lesen**. Jede
      Erwartung aus 1.1–1.6 muss scheitern, jede aus 1.7 bestehen. Eine
      treibende, die schon grün ist, prüft einen Namen, den es nicht gibt —
      Namen gegen den Quelltext korrigieren, nicht die Erwartung abschwächen.

## 2 · `/profil` ausbauen

- [x] 2.1 `src/pages/ProfilAnsichtPage.tsx`: `ErfolgsradarWidget`,
      `AuszeichnungenWidget`, `ZieleWidget`, `EntwicklungWidget` aus Import und
      Rendering entfernen. Die Komponenten selbst bleiben, wo sie sind.
- [x] 2.2 Die Kachel `<StatTile label="Matches" …>` (Zeile 68) entfernen;
      „Netzwerk" und „Events" bleiben.
- [x] 2.3 Beitrittsdatum und Mitgliedsnummer **einzeln** bedingt rendern, der
      Trenner `·` an der Nummer; der Absatz entfällt nur, wenn beide fehlen
      (design §6a). Nicht den ganzen Absatz an `member_since` hängen — das
      verschluckt die Nummer.
- [x] 2.4 Das Kachelraster durch eine einfache Spalte ersetzen (design §4);
      `InteressenWidget` und `BeitraegeWidget` bleiben, in dieser Reihenfolge.
- [x] 2.5 Einen **kurzen** Kommentar hinterlassen, der `AGE-539` nennt und sagt,
      was ausgebaut wurde und dass die Komponenten stehen bleiben — Form wie die
      bestehenden AGE-450/AGE-494-Notizen in derselben Datei, aber ohne deren
      Länge (gemini, LOW: das dauerhafte „Warum" steht im Spec und im Ticket).

## 3 · Die Demo-Daten entfernen

- [x] 3.1 `profil-widgets.tsx`: `DEMO_POSTS` löschen; `BeitraegeWidget` zeigt bei
      leerem `data.posts` einen Leerzustand, der **zum Schreiben auffordert**
      und auf `/aktivitaet` führt, und setzt `demo` nicht mehr.
- [x] 3.2 `InteressenWidget` rendert `null`, wenn `data.interests` leer ist
      (design §3).
- [x] 3.3 `kontakte-widgets.tsx`: `DEMO_NETWORK` und den Block „Aufschlüsselung"
      samt `DemoBadge` aus `NetzwerkWidget` löschen. Der bestehende Leerzustand
      bei null Kontakten bleibt **unverändert** — er zeigt bewusst keine Null.
- [x] 3.4 Verwaiste Importe aufräumen — nur die eigenen. `DemoBadge` bleibt in
      `building-blocks.tsx` stehen, es hat andere Leser.
- [x] 3.5 `pnpm test` — alles aus Gruppe 1 grün, auch 1.7.

## 4 · Belegen, dass nichts Erfundenes übrig ist

- [x] 4.1 `grep -rn "DEMO_POSTS\|DEMO_NETWORK" src/` liefert **keine** Zeile
      mehr. Ausgabe in die Zusammenfassung übernehmen.
- [x] 4.2 `grep -rn "DemoBadge" src/` prüfen: keine Verwendung auf einer
      **erreichbaren** Seite. Treffer in unerreichbarem Code (`ImpactWidget`)
      benennen statt anfassen.
- [x] 4.3 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — vier grüne
      Ausgaben, jede gelesen. **Nie `pnpm format`.**

## 5 · Sichtprobe am laufenden Server (nicht verhandelbar)

jsdom sieht kein Layout. Was hier geprüft wird, kann kein Test aus Gruppe 1
sehen.

- [x] 5.1 `/profil` mit einem Konto **ohne** Daten: keine erfundenen Beiträge,
      keine leeren Kacheln, kein „—", die Seite wirkt nicht abgeschnitten.
- [x] 5.2 `/profil` mit einem Konto **mit** Daten: Interessen und Beiträge
      stehen, die Spalte trägt.
- [x] 5.3 `/kontakte` in beiden Zuständen: keine Aufschlüsselung; bei Kontakten
      die echte Zahl, ohne Kontakte die Einladung.
- [x] 5.4 Beide Design-Varianten für 5.1–5.3. **Beim Prüfen richtiggestellt:**
      einen Dark-Reading-Mode gibt es seit AGE-499 nicht mehr (Entscheidung
      Donald, 04.08.). `navy` färbt nur noch Sidebar und Topbar; alle
      Inhalts-Tokens stehen ausdrücklich nicht mehr im `html[data-variant]`-Block
      (`index.css:154-178`). Die geänderten Karten sind damit in beiden
      Varianten identisch — einmal am Rahmen belegt, nicht dreimal.
- [x] 5.5 Ergebnis mit Screenshot belegen, **vor** dem Commit — nicht „sieht gut
      aus". Donald bekommt die laufende Fassung zu sehen.

## 6 · Abschluss

- [x] 6.1 `openspec validate --all` grün.
- [x] 6.2 Fremd-Review auf dem **Diff** (Schritt 4), zwei fremde Anbieter,
      `REVIEWER_TIMEOUT=900`. Befunde in `REVIEWS.md` beantworten. Ergebnis:
      beide REQUEST-CHANGES, vier Befunde — **alle vier auf die Tests, keiner
      auf den Code**. Drei übernommen (Widgets-bleiben-im-Code-Fälle,
      Zählerwert statt Beschriftung, Trenner), einer begründet abgelehnt.
- [x] 6.3 Commit mit `AGE-539`, PR gegen `main`. Linear-Status erst **lesen** —
      die Automation schaltet selbst. Erledigt: PR #177, gemergt als `4444a17`,
      alle fünf Pflichtchecks grün.
