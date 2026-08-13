# Profil aufräumen: vertagte Kompass-Widgets und Demo-Daten raus (AGE-539)

## Why

Am 17.08. loggen sich rund 70 importierte Mitglieder zum ersten Mal ein. Was
sie auf ihrer eigenen Profilseite finden, ist heute zum Teil erfunden:

- **`/profil`** zeigt unter „Meine Beiträge" zwei Artikel, die sie nie
  geschrieben haben, mit erfundenen Reichweiten — „Warum Ökosysteme die Zukunft
  des Mittelstands sind · Artikel · 1,2k Views · 84 Likes"
  (`profil-widgets.tsx:33`, gerendert sobald `posts` leer ist — also bei allen
  70).
- **`/kontakte`** zeigt eine Netzwerk-Aufschlüsselung mit 24 Freunden, 8
  Preferred Partnern, 3 Mentoren und 5 Mentees (`kontakte-widgets.tsx:21`, fest
  verdrahtet, unabhängig von den echten Kontakten).

Ein Mitglied, das auf seiner eigenen Seite Zahlen über sich selbst liest, die
nicht stimmen, hat keinen Grund, dem Rest der Seite zu glauben. Das ist der
Go-Live-Blocker an dieser Stelle, nicht die Optik.

**Die Anforderung dagegen steht bereits im Spec.** `member-profiles` trägt seit
AGE-494 „A member's own profile shows no invented data about them", ausdrücklich
samt der Feststellung, dass ein „Demo"-Abzeichen nicht genügt. Beide Blöcke
tragen genau dieses Abzeichen. Der größere Teil dieses Changes ist damit
**Konformitätsarbeit an einer bestehenden Anforderung**, kein neuer Begriff.

Dazu kommt der zweite Teil: C2 (AGE-494) hat den Kompass aus der Navigation
genommen, **die Profil-Widgets aber stehen gelassen**. Die vertagte
Kompass-Oberfläche ist deshalb weiterhin die halbe Profilseite — Erfolgsradar,
Auszeichnungen, Ziele, Entwicklung, bei einem importierten Mitglied alle vier
leer, dazu ein Matches-Zähler auf eine unerreichbare Fähigkeit und ein Knopf
„Zur persönlichen Roadmap". Vier Kacheln nebeneinander, die alle „Noch keine …"
sagen, lassen ein frisches Profil tot wirken — und nach dem Import sind fast
alle frisch.

Zwei Genauigkeiten dazu, weil die Issue an beiden Stellen kürzt:

- **Der Matches-Zähler zeigt nicht „immer 0".** `matchStats` wird aus echten
  Zeilen berechnet (`dashboard.ts:331`), und selbst die Testfixture trägt
  `successful: 1`. Der Grund für den Ausbau ist deshalb nicht der Wert, sondern
  das Ziel: Matching ist bewusst unerreichbar, der Zähler verweist also auf eine
  Oberfläche, die niemand öffnen kann.
- **Die Roadmap-Schaltfläche führt nicht ins Leere.** `/kompass` ist eine
  bestehende Route und bleibt es. Was es nicht gibt, ist die *persönliche
  Roadmap*, die der Knopf verspricht — ein falsches Versprechen, kein toter Link.

## What Changes

- **Die zwei Demo-Datensätze werden ersatzlos entfernt.** `DEMO_POSTS` und
  `DEMO_NETWORK` verschwinden samt der Zweige, die sie rendern, und samt der
  „Demo"-Abzeichen daneben.
- **Vier Kompass-Widgets werden aus `/profil` ausgebaut**: „Mein Erfolgsradar",
  „Meine Auszeichnungen", „Meine Ziele", „Meine Entwicklung". Die Komponenten
  **bleiben im Code** und werden nur nicht mehr gerendert — dieselbe Bauweise
  wie bei Matching (AGE-450). Keine Spalte, keine Migration, kein Datenverlust:
  `potential_score`, `dev_focus`, `goals` bleiben unangetastet.
- **Die MATCHES-Kachel im Profilkopf entfällt** (`ProfilAnsichtPage.tsx:68`).
  Matching ist bewusst unerreichbar; ein Zähler, der immer 0 zeigt, macht die
  Abwesenheit sichtbar, statt sie zu verbergen.
- **„Meine Interessen" bleibt** — begründet in der Datenlage: `interests` wird
  aus dem WordPress-Feld „Hobbys" befüllt, 38 von 70 Mitgliedern haben etwas
  eingetragen. Hobbys sind die einzige nicht-geschäftliche Ebene im Profil.
- **„Meine Beiträge" bleibt mit einladendem Leerzustand.** Beiträge gibt es
  wirklich (`posts`, C8) — der Leerzustand verspricht also keine Funktion, die
  niemand gebaut hat, und deckt sich mit dem bestehenden Szenario „Present
  capability renders an empty state".
- **Leere Widgets rendern gar nicht** — neue Leitregel für die eigene
  Profilseite, mit genau einer Ausnahme: Bereiche, die zum Ausfüllen einladen.
- **„Mitglied seit" erscheint nur mit Datum.** Heute steht dort bei fehlendem
  `member_since` ein Gedankenstrich (`formatDate` liefert „—"); nach dem Import
  träfe das 18 von 70.

**Nicht in diesem Change**, bewusst:

- `MatchingWidget` (`kontakte-widgets.tsx:198`) und `MeineChancenPage.tsx` —
  beide sind **bereits unerreichbar**. `MatchingWidget` wird von keiner Seite
  gerendert (AGE-450 nahm es aus `KontaktePage`), und `MeineChancenPage` wird
  von **nichts** importiert. Die Issue vermutet „Aktive Matches" auf
  `/kontakte`; dort steht in Wahrheit der `DEMO_NETWORK`-Block, den dieser
  Change entfernt.
- `ImpactWidget` (`profil-widgets.tsx:160`) mit seiner erfundenen
  Verlaufskurve — ebenfalls von nichts importiert. Entscheidung Donald, 13.08.:
  unerreichbar heißt ignorieren.

## Capabilities

### New Capabilities

_Keine._ Der Change schneidet eine bestehende Oberfläche zurück.

### Modified Capabilities

- `member-profiles`: Die bestehende Anforderung, dass die eigene Profilseite
  nichts Erfundenes über ihren Inhaber zeigt, bekommt die zwei konkreten
  Verstöße als prüfbare Szenarien. Neu daneben: vertagte Fähigkeiten erscheinen
  gar nicht, ein Widget ohne Inhalt rendert nicht (mit der Einladungs-Ausnahme),
  und eine Eckdatenzeile ohne Wert entfällt.

## Impact

**Code**

- `src/components/mein-bereich/profil-widgets.tsx` — `DEMO_POSTS` gelöscht,
  Demo-Zweig in `BeitraegeWidget` durch einladenden Leerzustand ersetzt.
- `src/components/mein-bereich/kontakte-widgets.tsx` — `DEMO_NETWORK` und der
  Aufschlüsselungs-Block in `NetzwerkWidget` gelöscht.
- `src/pages/ProfilAnsichtPage.tsx` — vier Widgets und die MATCHES-Kachel
  ausgebaut, „Mitglied seit" bedingt, Rasterbreite an zwei Kacheln angepasst.
- `src/pages/ProfilAnsichtPage.test.tsx` — Erwartungen umgekehrt (die Fixture
  trägt bereits `posts: []` und `member_since: null`, also genau den Fall des
  importierten Mitglieds), plus eine **zweite, gefüllte** Fixture.
- `src/pages/KontaktePage.test.tsx` — **besteht bereits** (drei Fälle seit
  AGE-494/AGE-450) und wird erweitert, nicht angelegt.

**Nicht betroffen**

- Datenbank: keine Migration, keine Spalte, keine Policy.
- `ErfolgsradarChart`, `ErfolgsradarWidget`, `AuszeichnungenWidget`,
  `ZieleWidget`, `EntwicklungWidget` bleiben als Komponenten bestehen.
- `/kompass` selbst, `PublicProfilePage` (dort ist die Eckdatenzeile bereits
  bedingt gerendert) und die Onboarding-Seite.

**Linear:** AGE-539.
