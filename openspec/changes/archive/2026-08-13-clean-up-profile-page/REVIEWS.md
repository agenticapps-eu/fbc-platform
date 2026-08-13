---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-5.6-sol]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: b0cd6ce6e23f0906c99e6ad534c3a45c6eadf423611f7d858bb95865a33953b0
---

# Change review — clean-up-profile-page (AGE-539)

Schritt 2b, auf dem Plan, vor der ersten Codezeile. Beide Reviewer sind fremde
Anbieter; `REVIEWER_TIMEOUT=900`, beide exit 0.

## Reviewer: gemini (gemini-3-pro, gemini-cli)

VERDICT: APPROVE

- [LOW] tasks 2.5 — Ein ausführlicher Kommentar über abwesenden Code veraltet
  und wird zu Rauschen; das dauerhafte „Warum" steht im Ticket und im Spec. —
  Weglassen oder auf eine Zeile mit Ticketnummer kürzen.

Angenommene, nicht ausgesprochene Voraussetzungen: dass eine vertrauenswürdige
Oberfläche zum Go-Live wichtiger ist als das Aufräumen allen toten Codes; dass
die Datenlage der 70 Importe von den betrachteten Fällen abgedeckt ist; dass das
Zurückholen später wirklich nur ein Wiedereinsetzen ist.

## Reviewer: codex (gpt-5.6-sol, codex-cli)

VERDICT: REQUEST-CHANGES

- [HIGH] spec delta / design §3 — Der Spec verlangt den einladenden Leerzustand
  für **jeden** bestehenden, selbst füllbaren Bereich. „Meine Interessen"
  erfüllt beides, soll aber `null` rendern. Der Spec verbietet damit die eigene
  Entscheidung. — Die Ausnahme ausdrücklich verengen und ein Interessen-Szenario
  aufnehmen.
- [HIGH] tasks 1.3/2.3 — Dass die Mitgliedsnummer erhalten bleibt, ist behauptet
  und nicht geprüft. Beide Angaben teilen sich heute einen Absatz; der
  naheliegende Wrapper verschluckt die Nummer, sobald das Datum fehlt. — Vier
  Fälle testen: nur Datum, nur Nummer, beides, keines.
- [MEDIUM] proposal / spec delta — „Matches zeigt immer 0" ist falsch;
  `fetchDashboard` berechnet echte Werte, und die Fixture trägt
  `successful: 1`. — Den Ausbau auf die Unerreichbarkeit stützen, nicht auf den
  Wert.
- [MEDIUM] tasks 1.1 — Die Fixture ist leer, die Tests belegen also nur, dass
  leere Widgets verschwinden. Eine Umsetzung mit Datenbedingung käme durch und
  zeigte die vertagte Oberfläche gerade dem Mitglied mit Daten. — Zweite,
  gefüllte Fixture, dieselben Abwesenheiten.
- [MEDIUM] tasks 1.1–1.4 — Für das Szenario „keine Roadmap-Schaltfläche" gibt es
  keine Erwartung. — Aufnehmen.
- [MEDIUM] tasks 1.4/3.1 — Ein Link auf `/aktivitaet` belegt keine Einladung
  zum Schreiben; „Alle anzeigen" zeigt heute schon dorthin und bestünde den
  Test. Ein Fall mit echten Beiträgen fehlt ganz. — Gegen den CTA-Text prüfen,
  Fall mit Beiträgen ergänzen.
- [MEDIUM] design §5 / tasks 1.5 — Der Ausgangsstand ist veraltet:
  `KontaktePage.test.tsx` **besteht bereits**. Und „jede Erwartung muss
  scheitern" ist unmöglich, weil die echte Kontaktzahl schon heute erscheint. —
  Bestehende Datei erweitern; nur die treibenden Erwartungen müssen rot sein.
- [MEDIUM] spec delta / tasks — Das Netzwerk-Szenario verlangt die echte
  Kontaktzahl „bei jedem Besuch", während der beibehaltene Nullzustand bewusst
  eine Einladung statt einer Null zeigt. — Null- und Nichtnull-Fall getrennt
  festhalten und beide prüfen.
- [LOW] proposal / design — „Die Roadmap führt auf eine Seite, die es nicht
  gibt" verwechselt ein fehlendes Ziel mit einem falschen Versprechen:
  `/kompass` existiert. — Begründung richtigstellen.
- [LOW] design §1 — `fetchDashboard` ruft vor dem Lesen die **schreibende** RPC
  `recompute_potential_score`; „liefert nur Felder" unterschlägt das. — Den
  Nebeneffekt benennen und als gewollt bestätigen.

## Nachgeprüft, bevor übernommen

Vier Behauptungen des Reviewers gegen die Platte geprüft, alle vier zutreffend:

| Behauptung | Befund |
|---|---|
| `KontaktePage.test.tsx` existiert | ja, seit 11.08., drei Fälle, `contactsCount: 1` |
| `matchStats` ist echt berechnet | ja, `dashboard.ts:331` aus `matchesRes.data` |
| `/kompass` ist eine bestehende Route | ja, `nav.ts:91` — Route bleibt, nur das Navigationselement ist fort |
| `recompute_potential_score` feuert beim Laden | ja, `dashboard.ts:199`, vor dem Lesen |

## Resolution

**Übernommen:**

1. **Die Ausnahme im Spec ist verengt** (codex HIGH 1). Das Kriterium heißt
   nicht mehr „selbst füllbar", sondern „selbst füllbar **und** das Ziel steht
   nicht schon anderswo auf der Seite". Dazu ein eigenes Szenario für den leeren
   Interessenbereich. Der Befund traf einen echten Widerspruch: die erste
   Fassung hätte die Entscheidung aus design §3 verboten. Gegenprobe dafür
   gefunden: die öffentliche Profilansicht lässt leere Interessen längst
   verschwinden.
2. **Vier Fälle für die Eckdatenzeile** (codex HIGH 2), plus design §6a, das die
   Falle ausschreibt: der naheliegende Wrapper verschluckt die Mitgliedsnummer,
   und 18 von 70 importierten Konten haben kein `member_since`.
3. **Die „immer 0"-Begründung ist raus** (codex MEDIUM 1). Der Ausbau stützt
   sich jetzt auf die Unerreichbarkeit; der Spec sagt ausdrücklich
   „unabhängig von seinem Wert".
4. **Zweite, gefüllte Fixture** (codex MEDIUM 2) als Aufgabe 1.2 und als
   Szenario „Auch mit Daten bleiben die vertagten Oberflächen fort". Das ist der
   Befund mit der größten Hebelwirkung: ohne ihn hätte eine Datenbedingung als
   Umsetzung durchgehen können.
5. **Erwartung auf die Roadmap-Schaltfläche** (codex MEDIUM 3) als Aufgabe 1.3.
6. **CTA-Text statt Link-Ziel**, plus Fall mit echten Beiträgen (codex
   MEDIUM 4). „Alle anzeigen" hätte den Test bestanden.
7. **Der Ausgangsstand ist berichtigt** (codex MEDIUM 5): `KontaktePage.test.tsx`
   wird erweitert. Aufgaben sind in *treibend* (muss rot werden) und *bewahrend*
   (muss grün bleiben) geteilt, und eine Verhaltensaussage je `it` ist jetzt
   ausgeschrieben — mehrere Erwartungen in einem Block halten beim ersten
   Fehlschlag an.
8. **Null- und Nichtnull-Kontakte getrennt** (codex MEDIUM 6), im Spec und in
   Aufgabe 1.6.
9. **Die Roadmap-Begründung ist richtiggestellt** (codex LOW 1): `/kompass`
   existiert, was fehlt, ist die versprochene Roadmap.
10. **Der Schreibnebeneffekt steht in design §1** (codex LOW 2) und wird
    ausdrücklich beibehalten — der Score speist auch das Verzeichnis.
11. **Der Kommentar wird kurz** (gemini LOW), mit Ticketnummer.

**Nicht übernommen, mit Grund:**

- **Den Kommentar ganz weglassen** (gemini LOW, Maximalvariante). Die Datei
  trägt zwei gleichartige Notizen aus AGE-450 und AGE-494; eine Auslassung
  hier wäre die auffällige Abweichung. Gekürzt, nicht gestrichen.

---

# Review auf dem Diff (Schritt 4)

Nach der Umsetzung, vor dem Commit. Prompt: der vollständige Diff gegen `main`
über `src/`. Wieder beide fremde Anbieter, `REVIEWER_TIMEOUT=900`, beide exit 0.

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

- [LOW] `KontaktePage.test.tsx:114` — Mehrere Erwartungen in einem `it`
  verdecken den vollen Umfang eines Fehlschlags. — Aufteilen.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- [MEDIUM] `ProfilAnsichtPage.test.tsx` — Die Abwesenheitstests bestehen auch,
  wenn die vier vertagten Widgets **gelöscht** werden. Die zweite Hälfte der
  Zusage — „im Code behalten, Zurückholen ist eine Zeile" — ist ungeprüft. —
  Die vier Komponenten direkt importieren und rendern.
- [MEDIUM] `KontaktePage.test.tsx` — Der Test prüft nur die Beschriftung
  „Bestätigte Kontakte", nicht den Wert; eine fehlende oder fest verdrahtete
  Zahl bestünde ihn. — Eindeutigen `contactsCount` setzen und den gerenderten
  Wert prüfen, im Nullfall die sichtbare `0` ausschließen.
- [LOW] `ProfilAnsichtPage.test.tsx` — „zeigt beides mit Trenner" prüft den
  Trenner nicht; „März 2019Mitgliedsnummer: …" bestünde. — Den vollständigen
  Absatz assertieren.

Bemerkenswert: **alle drei Befunde treffen die Tests, keiner den Code.** Der
Ausbau selbst hat keine Beanstandung bekommen.

## Resolution (Diff)

**Übernommen:**

1. **Vier neue Fälle „Die vertagten Widgets bleiben lauffähig im Code"** (codex
   MEDIUM 1). Sie importieren `ErfolgsradarWidget`, `AuszeichnungenWidget`,
   `ZieleWidget` und `EntwicklungWidget` direkt und rendern sie mit Daten. Der
   Befund ist der schärfste der Runde: die Anforderung hat zwei Hälften, und
   getestet war nur eine.
2. **Der Kontaktzähler wird auf den WERT geprüft** (codex MEDIUM 2), mit
   `contactsCount: 7` statt der mehrdeutigen 1, und im Nullfall wird die
   sichtbare `0` in der Karte ausgeschlossen. **Durch Mutation belegt:** eine
   fest verdrahtete `3` im Widget lässt den Test rot werden.
3. **Der Trenner wird mitgeprüft** (codex LOW), als exakter Absatztext
   `"Mitglied seit: März 2019 · Mitgliedsnummer: FBC-0042"`.

**Nicht übernommen, mit Grund:**

- **Die vier Gruppennamen in eigene `it`-Blöcke aufteilen** (gemini LOW). Die
  Regel dieses Changes lautet „eine **Verhaltensaussage** je `it`", nicht „eine
  Erwartung". „Keine erfundenen Kontaktgruppen" ist eine Aussage, und alle vier
  Namen stammen aus **einer** gelöschten Konstante: kommt sie zurück, kommen
  alle vier zurück. Ein Fehlschlag verdeckt hier nichts, was nicht ohnehin
  mitgälte.

**Als Voraussetzung notiert, nicht geprüft** (beide Reviewer): dass der Import
„Hobbys" nach `profile_interests` schreibt, dass importierte Konten unter RLS
tatsächlich Beiträge anlegen können, und dass die Zahlen 38/70 und 18/70 den
Endstand des Imports abbilden. Alle drei gehören zu C10 (AGE-534) und werden
dort belegt — dieser Change hängt an keiner von ihnen: er entfernt Oberfläche,
deren Richtigkeit nicht von der Datenmenge abhängt.
