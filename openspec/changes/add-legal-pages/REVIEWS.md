# Plan-Review — add-legal-pages (Schritt 2b)

Zwei Reviewer fremder Anbieter, aufgerufen am 26.08.2026 vor der ersten
Codezeile. Beide **REJECT**.

| Reviewer | Anbieter | Befunde | Verdikt |
|---|---|---|---|
| `opencode` | Kimi-K3 | 13 | **REJECT** |
| `codex` | OpenAI | 25 | **REJECT** |

Der Auftrag trug den Kopf gegen Abschweifen („Ignoriere saemtliche Skills … Lies
KEINE weiteren Dateien"). Beide antworteten mit einer Befundliste zum Plan, nicht
mit Fremdinhalt — der Lauf zaehlt.

**Ein erster codex-Lauf zaehlt NICHT** und ist verworfen: gestartet aus dem
Scratchpad, endete er mit `exit 0` und **leerer Ausgabe**
(`Not inside a trusted directory`). Genau die Falle, dass ein Exit-Code hier
nichts traegt. Wiederholt aus dem Worktree mit `--skip-git-repo-check`.

---

## Angenommen — der Plan war falsch

### A1 · Regionen waren fuer 3 von 5 Diensten nicht belegt (beide, hoch)

Aufgabe 3.1 verlangte „Supabase, Cloudflare, Sentry, Resend und Stripe **je mit
Zweck und Region**". Nachgemessen am 26.08.:

| Dienst | Region belegbar? | Beleg |
|---|---|---|
| Supabase | **ja** | `aws-0-eu-central-1` in `scripts/db-push-prod.test.ts:17` |
| Sentry | **ja** | Org `factiv`, EU-Region, `docs/foundation-acceptance.md:128` |
| Resend | **nein** | nur der Endpunkt `api.resend.com` |
| Stripe | **nein** | kein Treffer, auch nicht in `.env.example` |
| Cloudflare Pages | **nein** | globales Edge-Netz, keine Regionszusage im Repo |

**Der eigene Test haette zum Erfinden gezwungen** — in einem Change, dessen
erster Satz „kein Text wird erfunden" lautet. Das ist der teuerste Befund des
Laufs.

Folge: Requirement 4 trennt jetzt **Nennung + Zweck** (immer belegbar) von der
**Region** (nur wo belegt). Wo keine Region belegt ist, sagt die Seite das
ausdruecklich, statt zu schweigen oder zu raten.

### A2 · Das Szenario „finales Dokument" konnte nie rot werden (beide, hoch)

Alle vier Dokumente bekommen einen Entwurfshinweis. Das Delta-Szenario „a final
document carries no provisional notice" hatte damit keinen Verwender und keinen
Test. Ein Requirement, das nie faellt, ist Dekoration.

Folge: `provisorisch` wird ein Feld am Dokument, und ein Test rendert ein
Dokument mit `provisorisch: false`. Damit kann das Szenario rot werden.

### A3 · Der Footer erreicht das unbestaetigte Konto nicht (beide, hoch)

Nachgelesen in `ActivationGate.tsx:57`: `if (!isActivated) return
<ActivationScreen />`. Ein eingeloggtes, unbestaetigtes Konto sieht die
`AppShell` **nie** — also auch den Footer nie. Das Delta-Szenario „a signed-in
member sees the same footer links" war fuer diese Gruppe schlicht falsch.

Folge: das Szenario wird auf **aktivierte** Mitglieder praezisiert, und die
Rechtslinks kommen zusaetzlich auf den Aktivierungsbildschirm und die
Login-Seite. Siehe A4.

### A4 · Die zwei ausgelagerten Links hoehlten die eigene Begruendung aus (beide, hoch)

Der Plan begruendete die Routenlage ausserhalb der Shell ausdruecklich damit,
dass unbestaetigte Konten das Impressum **vor** dem Passwortsetzen sehen
muessen — und schob dann genau diese zwei Links in einen Folge-Vorgang.

Beide Reviewer nennen dieselbe rechtliche Grundlage: § 312i BGB verlangt die
Verfuegbarkeit der AGB **bei Vertragsschluss**, Art. 13 DSGVO die Information
**zum Zeitpunkt der Erhebung**. Beides passiert auf Registrierung und
Aktivierung.

Folge: **die zwei Links kommen in diesen Change.** Es sind zwei `<Link>` auf
Routen, die dieser Change ohnehin anlegt; sie draussen zu lassen haette die
Begruendung des Changes zur Behauptung gemacht.

### A5 · Aufgabe 3.3 behauptete eine Kopplung, die es nicht gibt (beide, mittel/hoch)

„Faellt das spaeter um, muss der Test brechen" war falsch: ein Test, der die
**Textseite** auf Abwesenheit von Begriffen prueft, bleibt gruen, wenn jemand
spaeter `gtag` in den **Code** einbaut. Der `grep` daneben ist Handarbeit, kein
Test.

Folge: der Negativbefund wird ein echter Test, der `src/`, `index.html` und
`public/` scannt — also die Code-Seite, auf der das Umfallen stattfaende. Damit
faellt auch codex' berechtigter Einwand weg, der Suchpfad sei zu eng.

### A6 · Die Cookie-Richtlinie beschreibt ein Verfahren, das es nicht gibt (beide, mittel/hoch)

Der Entwurfshinweis nannte nur die Video-Embeds. Die Richtlinie beschreibt aber
darueber hinaus einen **Einwilligungs- und Widerrufsweg**, den die Plattform
nicht hat.

Folge: der Hinweis der Cookie-Seite sagt beides.

### A7 · Kleinere angenommene Punkte

- Die vier Pfade standen nicht im Delta, nur in Proposal und Aufgaben
  (opencode, niedrig) — jetzt normiert.
- „Mit Rueckweg" war unbestimmt (opencode, niedrig) — jetzt: statischer Link
  auf `/`, plus Querverweise auf die drei anderen Seiten. Kein
  `history.back()`, das bricht beim Direktaufruf.
- `cn()` loest keine Tailwind-Konflikte (beide, niedrig) — als Leitplanke
  aufgenommen.
- Vier Routen koennten alle dasselbe Dokument zeigen und der Test bliebe gruen
  (codex, mittel) — der Test prueft jetzt je Route einen eigenen Titel.
- Der Footer braucht `fbc-shell-offset` (aus codex' Layout-Einwand, siehe W3).

---

## Widerlegt — am Repo nachgemessen

### W1 · „Axiom empfaengt womoeglich Daten" (opencode, hoch) — **nein**

opencode schloss aus „`grep -rn axiom` trifft 6-mal" auf einen moeglicherweise
lebenden Dienst und daraus auf einen Verstoss gegen Requirement 4.

Alle sechs Treffer sind **Kommentare, die die Entfernung dokumentieren**:

```
functions/api/log.ts:10  // Zuvor ging der Endpunkt an Axiom. ADR-0037 hat
functions/api/log.ts:11  // die Axiom-Destination entfernt: kein Ingest-Token …
src/lib/log.ts:6         // Seit ADR-0037 gibt es kein Axiom und damit kein …
```

`functions/api/log.ts` schreibt nach Workers Logs. Axiom ist **kein**
Auftragsverarbeiter dieser Plattform und gehoert nicht in die
Datenschutzerklaerung. Der Abnahmepunkt „0 Treffer" aus AGE-497 bleibt offen,
aber das ist Textpflege, kein Datenschutzbefund.

Das Proposal hat diesen Eindruck mitverursacht und ist praezisiert.

### W2 · „Verschachtelte Listen und Tabellen sprengen das Modell" (beide, mittel) — **nein**

Beide hielten drei flache Blockarten fuer zu wenig fuer 62k Zeichen AGB
(„§ 3 Abs. 2 lit. a", Tabellen). Am pandoc-Export gezaehlt:

| Muster | Treffer im AGB |
|---|---|
| eingerueckte Listenzeilen | **0** |
| Tabellenzeilen (`^\|`) | **0** |
| nummerierte Listen (`^\d+. `) | **0** |
| eingerueckte Zeilen ueberhaupt | **0** |

Die Gliederungstiefe steckt in **Ueberschriften** (10 Abschnitte, 160
Unterabschnitte, 4 Anlagen), und Absaetze tragen ihre Nummerierung als Text
(`(1)`, `(2)`). Beides bildet das Modell ab. Kein vierter Blocktyp.

### W3 · „Der Footer landet horizontal neben dem Inhalt" (codex, hoch) — **nein, aber der Nachbarbefund traegt**

codex vermutete ein Flex-/Grid-Layout an der Shell-Wurzel. Nachgelesen
(`AppShell.tsx:382`): die Wurzel ist ein schlichtes `div`
(`relative isolate min-h-screen`), die Sidebar ist `fixed`, `<main>` ist ein
Block mit `padding-left`. Ein `<footer>` als Geschwister stapelt vertikal.

**Der richtige Punkt liegt daneben und wird uebernommen:** weil die Sidebar
`fixed` ist, muss der Footer dieselbe Klasse `fbc-shell-offset` tragen wie
`<main>`, sonst liegt er ab `lg` **unter** der Sidebar.

### W4 · „`replaysSessionSampleRate: 0` heisst niemals Replay" (opencode, hoch) — **nein**

Technisch falsch: `replaysSessionSampleRate` steuert die anlasslose Aufzeichnung,
`replaysOnErrorSampleRate` die im Fehlerfall. `instrument.ts` setzt beide —
`0` bzw. `1.0`. Die Aussage „keine anlasslose Aufzeichnung, nur im Fehlerfall"
ist korrekt.

**Das Proposal war trotzdem schlampig** und ist korrigiert: es zitierte nur den
einen Wert und zog eine Folgerung, die beide braucht.

Ausserdem berechtigt und uebernommen (codex, mittel): dass im Fehlerfall
ueberhaupt ein Replay entsteht, ist eine Verarbeitung und gehoert **genannt** —
nicht als Beleg dafuer, dass nichts passiert.

### W5 · „Deep-Links liefern 404 statt der Seite" (codex, hoch) — **nein**

`public/_redirects` traegt seit dem 28.06. den SPA-Fallback
`/*    /index.html    200`, ausdruecklich kommentiert. Direktaufruf und Reload
von `/impressum` funktionieren. Ein Deploy-Test bleibt sinnvoll, aber der Befund
als solcher ist gegenstandslos.

### W6 · „Vollstaendigkeit ist unbelegt" (beide, hoch) — **war schon belegt, wird jetzt aufgeschrieben**

Beide forderten einen Abgleich Quelle ↔ Modul. Der lief bereits vor dem Review;
er stand nur nicht in den Aufgaben. Gemessen ueber die Menge aller Woerter ab
5 Buchstaben:

| Dokument | Quelle | Woerter | fehlen | Rest erklaert durch |
|---|---|---|---|---|
| Impressum | 2 570 Z | 143 | 1 | `Stand` → eigenes Feld |
| AGB | 64 832 Z | 1 543 | 7 | Titel, `Stand`, plus 3 echte (siehe unten) |
| Cookie-Richtlinie | 12 582 Z | 431 | 6 | Titel, `Stand`, `mailto` |
| Datenschutz | 12 620 Z | 519 | 6 | Titel, `Stand`, `mailto`, plus 1 echter |

**Und der Abgleich hat einen echten Konverterfehler gefunden**, den kein
Reviewer sah: fett gesetzte Zeilen ohne folgenden Fliesstext wurden zu leeren
Abschnitten und fielen aus dem Ergebnis. Betroffen waren `ANLAGE 1–4`,
`2. Registrierung und Nutzerkonto`, `6. Community, Inhalte und
Verhaltensregeln`, `2. Eingesetzte Cookies …` und — am schwersten —
`Der Landesbeauftragte fuer den Datenschutz und die Informationsfreiheit
Baden-Wuerttemberg`, also die **Beschwerdestelle** nach Art. 77 DSGVO.

Der Abgleich wird deshalb Aufgabe 2.6 und laeuft nach jeder Konvertierung.

---

## Nicht geloest, bewusst weitergereicht

Beide Reviewer verlangen Dinge, die dieser Change nicht leisten kann, weil sie
**Sachentscheidungen und anwaltliche Freigaben** sind, keine Codefragen:

- **Verantwortlicher FBC ↔ DK Real Invest eG.** codex hat recht, dass „Donald
  hat entschieden" kein Beleg fuer die datenschutzrechtlich verantwortliche
  Stelle ist. Die Entscheidung bleibt (sie macht die Seite konsistent mit drei
  von vier Dokumenten), aber sie steht als offener Punkt sichtbar auf der Seite
  und geht an den Anwalt.
- **ActivePoints in den AGB (26 Erwaehnungen, im Code nur toter `src/vision/`).**
  codex: ein Warnkasten heilt keine irrefuehrende Zusage. Richtig. Deshalb
  werden die AGB hier **nur als Information veroeffentlicht** und in **keinen**
  Vertrags- oder Registrierungsweg eingebunden — es gibt in diesem Change kein
  Zustimmungshaeckchen. Die Korrektur ist Detlevs Sache.
- **Embeds laden ohne Einwilligung.** codex: der Release der Embeds sollte an
  diesen Change gekoppelt werden. Das waere eine Funktionsaenderung an der
  Startseite und ist ein eigener Vorgang; hier wird sie dokumentiert.
- **Rolle je Dienst (Auftragsverarbeiter vs. eigener Verantwortlicher).**
  Berechtigt — Stripe und die Video-Anbieter sind vermutlich keine reinen
  Auftragsverarbeiter. Der Text nennt sie deshalb neutral als **Empfaenger**
  mit Zweck, statt eine Rolle zu behaupten, die nicht geprueft ist.
- **Art.-13-Vollstaendigkeitsmatrix, AVV/DPA, Aufbewahrungsfristen,
  Sachverhaltspruefung von USt-ID, Register und Preisen.** Das ist die finale
  Fassung 1.0 des Anwalts. Genau dafuer ist Aufgabe 8.1 die **erste** Handlung.

---

# Diff-Review (Schritt 4)

`opencode` (Kimi-K3) auf den **Code**-Anteil des Diffs, 26.08. Die vier reinen
Inhaltsmodule (~5 500 Zeilen Rechtstext) waren ausgenommen und als solche
benannt. `git add -N` vorher, sonst fehlen neue Dateien im Diff.

**10 Befunde, VERDICT: REJECT.** Acht angenommen, zwei am Repo widerlegt.

## Angenommen

### D1 · Kein `.catch` — die Seite waere dauerhaft leer geblieben (hoch)

Der schwerste Befund, und der Kommentar im Code behauptete ausdruecklich das
Gegenteil: *„faengt der Sentry-ErrorBoundary weiter oben ab"*. **Falsch.**
Error Boundaries sehen Fehler beim Rendern, nicht eine abgewiesene Zusage.

Der Fall ist real: nach einem Deploy zeigen offene Seiten auf Bündelstücke,
die es nicht mehr gibt (404). Ohne den Zweig bliebe `/impressum` **dauerhaft
leer** — und eine leere Impressumsseite sieht aus, als gaebe es die
Pflichtangabe nicht.

Jetzt: Fehlertext mit Neuladen-Knopf und E-Mail-Ausweg, plus ein Test, der
`lade` abweisen laesst.

### D2 · Der Quelltext-Scan konnte gruen sein, ohne je gesucht zu haben (mittel)

`catch { treffer = "" }` schluckte **jeden** Fehler. `grep` endet mit 1 bei
„nichts gefunden", aber mit 2, wenn es gar nicht suchen konnte — falsches
Arbeitsverzeichnis, fehlendes `public/`, `grep` nicht im PATH. In all diesen
Faellen war der Test gruen.

Ausgerechnet im Test, der verhindern soll, dass eine Zusage sich selbst
bestaetigt. Jetzt: alles ausser Status 1 fliegt weiter.

### D3 · `href` war die Luecke in „nie als Markup" (mittel)

`types.ts` verspricht, dass Text nie interpretiert wird. Fuer `href` galt das
nicht: ein `javascript:` im Inhaltsliteral waere ausgefuehrt worden — ueber
genau den Kanal, den `types.ts` selbst als Risiko benennt (Text aus einem
Word-Dokument). Jetzt: Schema-Positivliste (`https:`, `http:`, `mailto:`,
relative Pfade), alles andere wird reiner Text. Mit Test.

### D4 · Kein `document.title` (mittel)

WCAG 2.4.2. Der Tab trug den Titel der Seite, von der man kam — und beim
Direktaufruf aus der Aktivierungsmail den allgemeinen Index-Titel. Jetzt
gesetzt, mit Wiederherstellung beim Verlassen, plus Test.

### D5 · Ladezustand ohne jede Landmarke (niedrig, angenommen)

`return null` hiess: ein Dokument ohne Ueberschrift, ohne `main`. Der Titel
liegt aber ohnehin in den Metadaten und kostet nichts. Jetzt steht er sofort.

**Das hat vier Tests entlarvt** — sie warteten auf die `<h1>` und waren damit
auch dann gruen, wenn der Text nie eintrifft. Schlimmer: `findByRole` loeste
auf dem `<h1>` der Ladeansicht auf, React ersetzte den Knoten beim Eintreffen
des Textes, und das abgewartete Element war abgehaengt. Vier Tests fielen
genau so — **nur im Dateilauf, nicht einzeln**. Jetzt warten sie auf die
Abschnitts-Ueberschriften, die es nur im geladenen Dokument gibt.

### D6 · Ungescopte Abfragen (niedrig)

`getByRole("link", { name })` ohne Scope belegte nicht, dass die Rechtszeile
da ist. Jetzt `within(getByRole("navigation", { name: "Rechtliches" }))` —
wofuer das Label ja eingefuehrt wurde.

### D7 · Die untere Verweis-Navigation war unbenannt (niedrig)

Inkonsistent zu der Regel, die dieser Change selbst einfuehrt. Jetzt
`aria-label="Weitere Rechtsseiten"`.

### D8 · `set-state-in-effect` (aus D1 entstanden)

Die erste Fassung des Fehlerzustands setzte `setFehlgeschlagen(null)` direkt im
Effektkoerper — Kaskaden-Renders, und ESLint hat es gefangen. Jetzt **ein**
Zustandsobjekt mit Slug fuer beide Ausgaenge; der Reset entfaellt.

## Widerlegt — am Repo nachgemessen

### D9 · „Zwei Landmarken heissen beide Hauptnavigation" (mittel) — **nein**

Der Einwand: die angedockte Sidebar und die Off-Canvas-Schublade trugen beide
das neue Label, also sei das Problem wieder da, sobald das mobile Menue offen
ist.

Nachgelesen: die Sidebar ist `hidden … lg:flex` (`AppShell.tsx:399`), die
Schublade `lg:hidden` (`:558`). Sie schliessen einander per Breakpoint aus und
sind nie gleichzeitig im Accessibility-Baum. In jsdom stehen zwar beide im DOM
— dort gilt kein Tailwind —, aber das ist ein Artefakt der Testumgebung, kein
Befund am Produkt.

### D10 · „String-Kinder ohne `key`" (niedrig) — **nein**

React verlangt `key` fuer Elemente in Arrays, nicht fuer nackte Strings; die
`<a>` tragen ihren. Im gesamten Testlauf erscheint keine Key-Warnung.

## Nicht uebernommen, mit Grund

**Unterstreichung fuer `RechtsLinks` (niedrig).** Der Vorschlag ist als Regel
richtig, trifft hier aber eine Entwurfsentscheidung des Projekts: Footer- und
Navigationslinks unterscheiden sich im ganzen Rahmen ueber Farbe, nicht ueber
Unterstreichung. Der Kontrast ist gemessen (4,78:1 auf `bg-soft`, ueber AA),
und die Links stehen in einer benannten `<nav>`, nicht im Fliesstext — dort
sind sie in `LegalPage` sehr wohl unterstrichen. Das projektweit zu aendern
waere ein eigener Vorgang, kein Nebenprodukt der Rechtsseiten.
