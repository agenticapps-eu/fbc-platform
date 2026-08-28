# Die rechte Leiste dockt an `xl` an — auch dort, wo die Spec noch `lg` sagt

Linear: **AGE-652**

## Why

Zwei Anforderungen in **derselben** Datei `openspec/specs/design-system/spec.md`
widersprechen einander. Beide sagen `SHALL`.

**„The application shell docks the navigation to the viewport edge"** sagt seit
dem Archivieren von AGE-639 (`:280`):

> The two bars dock at different widths, and each keeps its own. The navigation
> docks at `lg`; the right bar docks at `xl`. That is not a symmetry that was
> overlooked but one that was **measured and rejected**: at `lg` the content
> column between an expanded navigation and an 18 rem right bar left names in
> the directory truncated to a single character. Between `lg` and `xl` the
> navigation is therefore docked while the right bar is still a drawer, and
> **that band is a designed state, not a gap**.

**„The right docked bar starts collapsed and remembers its own state"** sagt im
Szenario „The first visit does not spend content width" (`:1406`):

> **WHEN** a member who has never touched the right bar opens any page at `lg`
> or wider
> **THEN** the bar is collapsed to its rail

Im Band `lg`–`xl` gibt es aber gar keinen Rail. Die zweite Zusage ist dort
unerfüllbar, und sie widerspricht der ersten in genau dem Punkt, den die erste
ausdrücklich als gemessen und entschieden ausweist.

## Am Verhalten gemessen, nicht aus der Datei übernommen

Am 28.08. im Browser (Chrome über CDP, echtes angemeldetes Konto, `/profil`):

| Viewport | rechte Leiste | linke Leiste (Gegenprobe) |
| --- | --- | --- |
| 1100 px (≥ `lg` 1024, < `xl` 1280) | `display: none`, Breite **0** | steht, **256 px** |
| 1688 px (≥ `xl` 1280) | Breite **72 px** (der Rail) | steht |

**Die Gegenprobe ist der Punkt.** „Bei 1100 px ist der rechte Rail nicht da"
belegt für sich nichts — die Messung hätte auch ins Leere laufen können, etwa
weil die Seite gar nicht geladen war. Erst die linke Leiste mit ihren 256 px in
derselben Messung macht daraus einen Befund.

Belegt ist damit: das gebaute Verhalten folgt der **ersten** Anforderung. Die
Quelle im Code ist `AppShell.tsx:713` — `hidden flex-col border-l xl:flex`.

## What Changes

Der Umfang ist grösser als die eine Zahl, mit der dieser Vorschlag anfing. Die
Plan-Review hat drei weitere Falschaussagen **im selben Szenario** gefunden, und
ein `MODIFIED`-Block stellt die Anforderung ohnehin ganz neu aus — sie stehen zu
lassen hiesse, sie unter neuem Datum zu bekräftigen.

**Im Szenario „The first visit does not spend content width":**

| war | wird | warum |
| --- | --- | --- |
| `lg` | `xl` | die eigentliche Drift, siehe oben |
| „opens **any page**" | „opens a page that **carries the right bar**" | `messaging/spec.md:259` verlangt ausdrücklich, dass die stehende Fläche auf der Gesprächsseite **nicht** rendert. Im Browser bestätigt: auf `/chat` bei 1688 px ist der Rail gar nicht im DOM. „any page" war also schon vorher falsch |
| „a member who has **never touched** the right bar" | „a member with **no stored** right-bar preference" | der Speicher ist gerätelokal und nicht kontogebunden — dieselbe Anforderung sagt das zwei Absätze höher. Ein neues Mitglied auf einem geteilten Gerät erbt den fremden Zustand, hat den Balken aber nie berührt |

**Im Rumpf derselben Anforderung, zwei neue Absätze:**

- Einer bindet die Schwelle an die Anforderung, die sie festlegt.
- Einer trennt die **gespeicherte Vorliebe** von ihrer **angedockten
  Darstellung**. Nur die zweite ist breitengebunden; Persistenz, Trennung vom
  Zustand der Navigation und die Toleranz gegenüber fehlendem Speicher gelten
  bei jeder Breite. Ohne diesen Absatz las sich der erste so, als sei unterhalb
  von `xl` auch die Vorliebe ausser Kraft — beide Reviewer haben genau das
  gelesen.

Der erste Absatz ist eine bewusste Erweiterung über die reine Korrektur hinaus,
und er braucht eine Begründung, weil „Simplicity First" dagegen spricht: **die
Drift entstand, weil eine Zahl ohne Bindung dastand.** Nichts wies darauf hin,
dass sie anderswo begründet wird, also fiel beim Korrigieren der anderen
Anforderung niemandem auf, dass hier eine zweite Kopie lag. Dieselbe Zahl ein
zweites Mal ohne Bindung hinzuschreiben, hiesse denselben Fehler wieder
einbaufähig zu machen.

Maschinell geprüft, nicht behauptet: **kein Szenario kommt hinzu, keines fällt
weg, die vier Szenario-Titel sind zeichengleich** (42 → 56 Zeilen, Abweichung an
den oben genannten Stellen).

## Warum das keine Anpassung der Spec an den Code ist

Der Workflow führt „a spec delta edited to match the code instead of the code to
match the delta" als Red Flag. Hier trifft sie nicht zu, und die Unterscheidung
ist der Kern dieses Vorschlags:

Die Autorität ist **nicht der Code**, sondern die andere Anforderung. Sie ist
neuer, sie nennt die Messung, die zu `xl` geführt hat, und sie benennt das Band
`lg`–`xl` ausdrücklich als gewollten Zustand. Der `lg`-Satz stammt aus AGE-627,
als die rechte Leiste zuerst beschrieben wurde; AGE-639 hat die Korrektur an der
Anforderung vorgenommen, die es ohnehin per `MODIFIED` neu ausstellte, und die
zweite stand nicht in seinem Umfang.

Abgeglichen wird also **Spec gegen Spec**. Dass der Code der überlebenden
Fassung folgt, ist Bestätigung, nicht Begründung.

## Eine Datei ausserhalb von `openspec/` ändert sich doch — und das ist Absicht

**Beide Reviewer haben unabhängig voneinander denselben Widerspruch gefunden**,
und sie hatten recht: die erste Fassung dieses Vorschlags behauptete „nur
OpenSpec-Markdown, kein Quelltext". Das Archivieren erzeugt aber über
`pnpm release:entries` einen Eintrag in `src/content/release-entries.generated.ts`
— eine Datei unter `src/`. Sie wegzulassen ist keine Option: `scripts/
release-entries.archiv.test.ts` prüft die Liste gegen `openspec/changes/archive/`
und würde rot.

Also ausdrücklich: **`src/content/release-entries.generated.ts` ändert sich, um
einen Eintrag.** Kein Verhaltenscode, aber Quelltext.

**Und dieser Eintrag geht NICHT automatisch an die Mitglieder.** Das ist der
Punkt, an dem beide Reviewer die Folge überschätzt haben. Ein Eintrag landet in
der **offenen Liste** unter `/admin/neuigkeiten`; zugestellt wird nur, was ein
Admin in eine Mitteilung zieht. Für genau diesen Fall — wahre Sätze, die einem
Mitglied nichts sagen — hat AGE-636 gestern das Kästchen **„nicht relevant"**
eingebaut, das den Eintrag ins Archiv räumt. Der vorgesehene Weg existiert also
schon; er ist eine Handlung des Admins, keine Änderung an diesem Vorschlag.

Den Erzeuger um einen Ausschluss zu erweitern wäre die Alternative und wird
**verworfen**: das hiesse, eine zweite Sorte Archiveintrag einzuführen
(„erscheint in der Liste" / „erscheint nicht"), damit ein Kästchen einmal nicht
angeklickt werden muss.

## Was ausdrücklich NICHT dazugehört

- **Kein Verhaltenscode.** Das gebaute Verhalten ist richtig und bleibt
  unberührt; die einzige Datei unter `src/`, die sich ändert, ist die generierte
  oben.
- **Keine weiteren `lg`-Nennungen.** Die übrigen in der Datei (`:258`, `:308`,
  `:331`, `:347`–`:358`, `:746`) betreffen die **Navigation**, die tatsächlich
  an `lg` andockt, oder das Band ausdrücklich als Band. Nachgesehen, nicht
  angenommen.
- **Kein Zusammenlegen der beiden Anforderungen.** Sie beantworten verschiedene
  Fragen — die eine, wo die Leisten andocken, die andere, in welchem Zustand die
  rechte startet und was sie sich merkt.
- **Kein Test.** Eine Spec-Zeile hat kein Laufzeitverhalten; ein Test darüber
  prüfte nur, dass die Datei den Text enthält, den man gerade hineingeschrieben
  hat. Der Beleg ist die Messung oben.
