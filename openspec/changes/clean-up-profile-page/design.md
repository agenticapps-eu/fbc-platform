# Design — Profil aufräumen (AGE-539)

## 1 · Was hier tatsächlich gebaut wird

Kein neues Verhalten. Der Change **entfernt** Oberfläche und lässt alles
darunter stehen: keine Migration, keine Spalte, keine Policy, keine Abfrage.
`fetchDashboard` liefert weiterhin `themeScores`, `badges`, `goals`,
`matchStats` — sie werden nur nicht mehr gezeigt. Das ist Absicht: das
Zurückholen einer vertagten Fähigkeit soll das Wiedereinsetzen einer Zeile sein,
nicht eine Ausgrabung.

**VERWORFEN: die Dashboard-Abfrage mitschneiden.** Naheliegend, weil vier ihrer
Felder unbenutzt werden. Aber `fetchDashboard` bedient auch `/kontakte` und die
Startseite, die Felder sind billig, und ein schmalerer Rückgabetyp wäre ein
Diff quer durch `lib/dashboard.ts` samt Tests — für null sichtbaren Gewinn und
gegen die Regel „nur ausbauen, nichts löschen".

**Ausdrücklich in Kauf genommen:** `fetchDashboard` ruft vor dem Lesen
`recompute_potential_score` (`dashboard.ts:199`) — eine **schreibende** RPC, die
bei jedem Laden von `/profil` und `/kontakte` feuert. Der Impact Score wird
damit weiter fortgeschrieben, obwohl seine Oberfläche vertagt ist. Das bleibt
so: der Wert speist auch das Verzeichnis, und ihn hier abzuschalten hieße, eine
zweite Fähigkeit mit auszubauen, die niemand genannt hat. Aufgedeckt vom
Fremd-Review (codex, LOW) — vorher stand hier „liefert nur Felder", was den
Nebeneffekt unterschlug.

## 2 · Entscheidung: Demo-Daten werden gelöscht, Widgets nicht

Die Issue trägt beide Anweisungen: §1 sagt „nichts löschen, nur ausbauen", §3
sagt „ersatzlos entfernen". Sie widersprechen sich nicht, sie betreffen
verschiedene Dinge:

| Ding | Behandlung | Warum |
|---|---|---|
| `ErfolgsradarWidget`, `AuszeichnungenWidget`, `ZieleWidget`, `EntwicklungWidget` | bleiben im Code, werden nicht gerendert | vertagt, nicht verworfen — dieselbe Bauweise wie bei Matching (AGE-450) |
| `DEMO_POSTS`, `DEMO_NETWORK` | gelöscht | sie sind der Schaden selbst; sie „auszubauen" hieße, sie für den nächsten Einbau bereitzulegen |

Es gibt hier ohnehin keine dritte Möglichkeit: `noUnusedLocals` lässt eine
Konstante nicht stehen, deren einziger Leser entfernt wurde. Der Ausbau des
Demo-Zweigs **erzwingt** die Löschung der Konstante.

## 3 · Entscheidung: nur „Meine Beiträge" lädt ein, „Meine Interessen" nicht

Beide Bereiche erfüllen die Ausnahme aus §4 dem Wortlaut nach — beide kann das
Mitglied selbst füllen, beide Fähigkeiten existieren. Trotzdem bekommt nur einer
den einladenden Leerzustand.

*Warum:* Über den Kacheln steht bereits eine Einladung — der `EmptyState`
„Dein Profil ist noch ein leeres Blatt" (`ProfilAnsichtPage.tsx:79`), der bei
fehlender Kurzvorstellung **und** fehlender Schlagzeile erscheint und in den
Profil-Editor führt. „Meine Interessen" führt in **denselben** Editor. Eine
zweite Einladung mit demselben Ziel eine Bildschirmhöhe darunter ist keine
Hilfe, sondern Wiederholung — und drei Einladungen untereinander wären genau die
tote Seite, die §4 verhindern soll, nur in einem freundlicheren Ton.

„Meine Beiträge" führt dagegen auf `/aktivität`, ein anderes Ziel, für das oben
nichts steht. Deshalb: Interessen entfällt bei Leere, Beiträge lädt ein.

**Das Kriterium ist damit nicht „selbst füllbar", sondern „eigenes Ziel, das
oben noch nicht steht"** — und genau so steht es jetzt als Bedingung im Spec.
Der Fremd-Review (codex, HIGH) traf hier einen echten Widerspruch: die erste
Fassung der Anforderung hätte „selbst füllbar" verlangt und damit die eigene
Entscheidung verboten.

*Gegenprobe, die für die Regel spricht:* Die durable Anforderung „Die
Profilansicht folgt dem Mockup" trägt für die **öffentliche** Ansicht bereits das
Szenario „Ein leerer Abschnitt verschwindet — WHEN ein Mitglied keine Interessen
gepflegt hat". Interessen verschwinden dort also längst bei Leere. Die eigene
Ansicht zieht damit nach, statt eine zweite Regel aufzumachen.

## 4 · Das Raster

Nach dem Ausbau bleiben zwei Kacheln. Das heutige
`grid-cols-1 md:grid-cols-2 xl:grid-cols-3` ließe „Meine Interessen" auf großen
Schirmen als Drittel mit zwei Dritteln Loch daneben stehen. Der Bereich wird
deshalb zur einfachen Spalte (`flex flex-col gap-5`), beide Kacheln über die
volle Breite.

**VERWORFEN: das Raster behalten und Interessen spannen lassen.** Ein Raster mit
einer Spalte ist ein Raster, das lügt — es kündigt eine zweite Kachel an, die
nicht kommt. Wenn C11 (AGE-538) etwas hinzufügt, ist das Raster eine Zeile
Arbeit.

## 5 · Wie das rot wird, bevor es grün wird

`ProfilAnsichtPage.test.tsx` trägt bereits die Fixture des importierten
Mitglieds: `posts: []`, `member_since: null`, `badges: []`, `goals: []`,
`themeScores: []`, `matchStats.successful: 1`. Sie beweist heute das falsche
Verhalten — Zeile 81 verlangt ausdrücklich die Überschrift „Mein Erfolgsradar".

Die Umkehr dieser Erwartungen ist der RED-Schritt, und sie misst echtes
Rendering, keine Attrappe: gemockt sind nur `fetchDashboard` (Datenweg) und
`ErfolgsradarChart` (Recharts, das in jsdom nichts zeichnet). Der Chart-Mock
wird nach dem Ausbau überflüssig und geht mit raus.

**Eine leere Fixture allein reicht nicht.** Sie belegt nur, dass leere Widgets
verschwinden — eine Umsetzung, die `themeScores.length > 0` abfragt statt
auszubauen, käme damit durch und zeigte dem Mitglied mit Daten weiterhin die
vertagte Oberfläche. Es braucht deshalb eine **zweite, gefüllte Fixture**
(Themen-Scores, Auszeichnung, Ziel, `dev_focus`), gegen die dieselben vier
Abwesenheiten geprüft werden. (Fremd-Review, codex, MEDIUM.)

**Für `/kontakte` gibt es sehr wohl schon einen Test.**
`src/pages/KontaktePage.test.tsx` besteht seit dem 11.08. mit drei Fällen und
`contactsCount: 1`. Er wird **erweitert**, nicht angelegt — die erste Fassung
dieses Designs hatte einen veralteten Ausgangsstand und hätte die Datei
überschrieben. (Fremd-Review, codex, MEDIUM.)

Die Datei gibt auch die Form vor: **eine Verhaltensaussage je `it`.** Das ist
hier keine Stilfrage — mehrere Erwartungen in einem Block halten beim ersten
Fehlschlag an, und ein RED-Schritt, der nach der ersten Zeile abbricht, sagt
nichts über die übrigen.

**Nicht jede Erwartung muss rot werden.** Rot müssen die sein, die den Change
treiben. Die bewahrenden — die echte Kontaktzahl steht weiterhin, gefüllte
Interessen stehen weiterhin, echte Beiträge stehen weiterhin — sind von Anfang
an grün und sollen es bleiben; sie sind die Absicherung gegen ein Entfernen, das
zu weit greift.

**Keine dieser Prüfungen ersetzt die Sichtprobe.** jsdom sieht kein Layout: dass
zwei volle Kacheln in einer Spalte tragen und dass in beiden Themes nichts
zerfällt, wird lokal am laufenden Server geprüft, bevor committet wird — mit
einem Konto ohne Daten **und** einem mit Daten.

## 6 · Was der Change bewusst stehen lässt

| Fund | Warum nicht hier |
|---|---|
| `MatchingWidget` (`kontakte-widgets.tsx:198`) trägt „Aktive Matches" | wird von keiner Seite gerendert — AGE-450 nahm es aus `KontaktePage`, der Kommentar steht dort in Zeile 32 |
| `MeineChancenPage.tsx:195` trägt „Aktive Matches" | die Datei wird von **nichts** importiert; `/meine-chancen` leitet zusätzlich auf `/` um (`App.tsx:85`) |
| `ImpactWidget` (`profil-widgets.tsx:189-209`) trägt eine erfundene Verlaufskurve | von nichts importiert. Entscheidung Donald, 13.08.: unerreichbar heißt ignorieren |
| `OnboardingPage.tsx:300` zeigt „Dein Erfolgsradar" | eigene Seite, eigener Fluss — gehört zu C11 (AGE-538), nicht hierher |

Die ersten drei sind **toter Code, der gepflegt wird** — AGE-537 hat
`MeineChancenPage.tsx` gestern noch angefasst. Das ist eine Beobachtung für eine
eigene Entscheidung, kein Teil dieses Changes.

## 6a · Die Falle in der Eckdatenzeile

`ProfilAnsichtPage.tsx:61-64` trägt Beitrittsdatum **und** Mitgliedsnummer in
einem einzigen Absatz:

```tsx
<p className="text-xs text-muted">
  Mitglied seit: {formatDate(p.member_since, monthFmt)}
  {p.member_number && <> · Mitgliedsnummer: {p.member_number}</>}
</p>
```

Der naheliegende Griff — den Absatz in `p.member_since && (…)` wickeln — würde
die **Mitgliedsnummer mit verschlucken**, sobald kein Datum vorliegt. Nach dem
Import ist das kein Randfall: 18 von 70 haben kein `member_since`, und die
Mitgliedsnummer ist für einen Verein die härtere Angabe von beiden.

Beide Angaben werden deshalb **einzeln** bedingt, der Trenner `·` hängt an der
Nummer, und der Absatz entfällt nur, wenn beide fehlen. Vier Fälle, vier Tests.
(Fremd-Review, codex, HIGH.)

## 7 · Risiken

- **Eine Kachel zu viel entfernt.** „Meine Interessen" steht auf der Kippe (§2
  der Issue behält sie ausdrücklich, §4 könnte sie bei Leere verschwinden
  lassen) — deshalb ist die Regel oben ausgeschrieben und im Spec als Szenario
  festgehalten, nicht dem Blick überlassen.
- **Ein Test, der nichts prüft.** Die Gefahr an einem Entfernen-Change ist die
  Assertion auf einen Namen, den es nie gab. Jede negative Erwartung wird
  deshalb gegen den Namen geschrieben, der **heute im Diff steht**, und einmal
  gegen den Stand vor der Änderung laufen gelassen — sie muss dort scheitern.
