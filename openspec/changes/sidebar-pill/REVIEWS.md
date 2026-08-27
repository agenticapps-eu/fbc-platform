---
reviewers: [gemini, codex]
models: [gemini-cli-default, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
---

# Change review — sidebar-pill (AGE-638)

Beide Reviewer lasen proposal, design, tasks und Spec-Delta **vor** der ersten
Codezeile, über `~/.agenticapps/bin/reviewer-cli.sh`; keiner ist mein eigener
Vendor. codex brauchte wie schon bei AGE-636 den Zusatz „lies keine Dateien" —
ohne ihn durchsucht der Arm das Repository und gibt kein Urteil ab.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- **[HIGH]** Stapelkontext — der Pill könnte unter dem klebenden Kopf
  verschwinden, „falls dieser z-50 ist".
- **[HIGH]** Umbruchpunkte — der Pill könnte unterhalb von `lg` als Rest
  stehenbleiben; ein automatisierter Test statt nur der Handprobe.
- **[MEDIUM]** `aria-expanded` und `aria-controls` sind für ein Bauteil, dessen
  ganzer Zweck das Auf- und Zuklappen ist, Pflicht, nicht Kür.
- **[MEDIUM]** Der Überhang ist nirgends beziffert; bei 1024–1280 px könnte er
  Inhalt verdecken.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- **[HIGH]** Aufgaben §3 — der **alte** Einklapp-Knopf der rechten Leiste wird
  nirgends entfernt, und der geplante Test bestünde auch mit beiden. Das
  verfehlt den Zweck des Vorgangs vollständig.
- **[HIGH]** Design §3/§5 — Pill und beibehaltene Sprechblase teilen sich
  dieselbe `h-16`-Zeile in einem Rail von 4,5 rem. Kein Wort zu Lage, Abstand,
  Trefferfläche; sie überlappen oder werden zu zwei mehrdeutigen Schaltern.
- **[HIGH]** Design §2 — `absolute` löst die Breitenfrage, nicht den
  Stapelkontext; Sichtbarkeit **und Klickbarkeit** des überhängenden Teils
  gehören gemessen.
- **[MEDIUM]** Die Anforderung sagt „ein Bedienelement" und behält zugleich
  einen zweiten — „gleiche Komponente" und „nur ein Schalter" werden vermischt.
- **[MEDIUM]** Die Farben des Pills sind nirgends festgelegt; eine gemeinsame
  Komponente kann trotzdem von zwei Eltern zwei Farben erben.
- **[MEDIUM]** „sagt seinen Zustand an" erfüllt auch „Navigation offen" — das
  nennt keine Handlung. `aria-expanded` und ein handlungsbenennender Name
  gehören gefordert.
- **[MEDIUM]** Die Spiegelung ist unterbestimmt: Seite × Zustand ergibt **vier**
  Pfeilrichtungen, und ein Namenstest sieht einen umgedrehten Pfeil nicht.
- **[MEDIUM]** Nur bei 1024 und 1280 px zu messen prüft keine der beiden Seiten
  der Grenze; und dass in den Schubladen **kein** Pill steht, prüft niemand.
- **[MEDIUM]** Aufgaben §4 ist als RED ausgezeichnet, benutzt aber bestehende,
  heute grüne Tests. Die können den Umbau nicht treiben.
- **[LOW]** „beide Themes" ist als Zustandsmatrix zu dünn — eingeklappte Rails,
  mehrstellige Zähler, Tastaturfokus, Überlappung mit der Topbar.

## Resolution

**Der schärfste Befund hat eine Entscheidung gekippt.** Der erste Entwurf liess
die Sprechblase im eingeklappten Rail klickbar, mit dem Argument „eine grosse
Fläche, die aussieht wie ein Knopf und nicht reagiert, ist schlechter als eine
Redundanz". Das stimmt für sich — übersieht aber, **wo** die beiden stünden:
in derselben Kopfzeile eines 4,5 rem schmalen Rails. Zwei Schalter mit
derselben Wirkung auf 40 px sind keine Redundanz mehr. Die Sprechblase wird zur
**Anzeige**; der Pill ist der einzige Schalter. `design-system/spec.md:1372`
verlangt vom Rail, dass er Ungelesenes **meldet** — nicht, dass er es
anklickbar macht.

| Befund | Was sich geändert hat |
| --- | --- |
| Alter Knopf bleibt stehen (codex, HIGH) | Spec-Klausel „SHALL entfallen", eigenes Szenario, und in §3 ein Test auf seine **Abwesenheit**. |
| Kollision im Rail (codex, HIGH) | Design §5 gekippt, Spec-Klausel und Szenario umgeschrieben. |
| Stapelkontext messen (codex, HIGH) | Aufgabe §5: Sichtbarkeit **und** Klickbarkeit des Überhangs, dazu Glocke und Profilmenü im Kopf. |
| „ein Bedienelement" vs. zweiter Schalter (codex, MEDIUM) | Durch die gekippte Entscheidung aufgelöst — jetzt stimmt beides. |
| Farben (codex, MEDIUM) | Design §5c und Spec-Klausel: der Pill setzt seine Farben selbst. |
| Handlungsname + `aria-expanded` (beide, MEDIUM) | Spec-Klausel verlangt `button`, handlungsbenennenden Namen, `aria-expanded`, `aria-controls` wo umsetzbar. Test in §1. |
| Vier Pfeilrichtungen (codex, MEDIUM) | Design §5b mit Matrix, Spec-Klausel, Szenario, Test in §1. |
| Grenzen beidseitig (codex, MEDIUM) | Aufgabe §5: 1023/1024 und 1279/1280, plus „kein Pill in den Schubladen". |
| §4 falsch als RED (codex, MEDIUM) | Umbenannt in „Regression", mit dem Grund. |
| Zustandsmatrix (codex, LOW) | Aufgabe §5: beide Leisten × beide Zustände × beide Themes, Tastaturfokus, mehrstelliger Zähler. |
| Überhang beziffern (gemini, MEDIUM) | Teil derselben Aufgabe; die Zahl entsteht bei der Messung, nicht davor. |

**Zurückgewiesen, gemessen statt gehofft:**

- **z-index (gemini, HIGH).** Der Befund steht auf „falls der Kopf z-50 ist".
  Er ist es nicht. Gemessen in `AppShell.tsx`: `<header>` (`:711`) ist **z-30**,
  beide `<aside>` (`:575`, `:643`) sind **z-40**. Der Kopf liegt darunter, der
  Pill malt darüber, und `backdrop-filter` wirkt auf das, was **hinter** dem
  Kopf liegt. Was der Befund richtig streift — ob der rechte Pill Glocke oder
  Profilmenü verdeckt — ist als Messung in §5 aufgenommen.
- **Automatisierter Test „kein Pill unter `lg`" (gemini, HIGH).** So nicht
  schreibbar. Die linke `<aside>` ist **immer** im DOM und wird per CSS
  (`hidden lg:flex`) verborgen; jsdom wertet keine Media Queries aus. Ein Test,
  der dort Abwesenheit behauptet, fiele bei korrektem Code durch. Der bestehende
  Test bei 1152 px prüft genau deshalb **Anwesenheit**. Die Frage gehört in den
  Browser und steht dort in §5.

**Eigener Fund, den keiner der beiden hatte:** die zugänglichen Namen sind
**Testanker** (`AppShell.chatleiste.test.tsx:112,178,188`). Erbt der Pill sie —
und das soll er, sie benennen die Handlung —, dann trifft
`/^Nachrichten ausklappen/` plötzlich **zwei** Elemente, und der bestehende Test
fällt an einer Mehrdeutigkeit statt an einem Fehler. Aufgelöst über den Namen
der Sprechblase, die ab jetzt mit ihrer Zahl führt. Siehe Design §6.
