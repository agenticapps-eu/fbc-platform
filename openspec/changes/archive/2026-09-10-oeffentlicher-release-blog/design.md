# Design

## 1 · Die Quelle

Eine neue Datei, von Hand gepflegt:

```
src/content/release-geschichten.ts     ← kuratiert, im Diff, reviewbar
src/content/release-entries.generated.ts  ← erzeugt, bei jedem Build überschrieben
```

Warum **neben** der generierten Datei und nicht darin: `pnpm release:entries`
läuft über `prebuild` und schreibt die generierte Datei bei **jedem** Build neu.
Das ist heute schon so und war in dieser Sitzung zweimal sichtbar — nach jedem
`pnpm build` stand sie unformatiert im Arbeitsbaum. Eine Datei, die
überschrieben wird, kann Handarbeit nicht aufbewahren.

Warum ein TypeScript-Modul und keine Markdown-Dateien mit Frontmatter: es gibt
keinen Frontmatter-Parser im Repo und keinen Markdown-Renderer (Proposal, D3).
Ein Modul ist typgeprüft, wird von beiden Bauwegen ohne Dateisystem-Zugriff
importiert und braucht **null** neue Abhängigkeiten. Dieselbe Trennung, die
`src/lib/release-entwurf.ts` in ihrem Kopf schon begründet: was die Oberfläche
zur Laufzeit braucht, darf nicht aus `scripts/` kommen.

### Die Form einer Geschichte

```ts
export interface ReleaseGeschichte {
  slug: string;        // zeichengleich mit dem Archiv-Slug — das ist die Verbindung
  datum: string;       // YYYY-MM-DD, aus dem Archiveintrag
  titel: string;       // eine Zeile, in Mitgliedersprache
  text: string;        // Klartext. Leerzeile trennt Absätze. KEIN Markup.
  bild: ReleaseBild;   // ein Screenshot der beschriebenen Fläche, siehe unten
  freigegeben: boolean;// nur freigegebene erscheinen öffentlich
}
```

**`thema` ist am 09.09. wieder herausgefallen**, zusammen mit `RELEASE_THEMEN`.
Es war die Gliederung der ersten Übersicht; seit dem Umbau (§2b) gliedert der
Blog nach Wochen und das Tutorial nach Etappen. Ein drittes Ordnungsmerkmal, das
keine Fläche mehr liest, wäre eine zweite Antwort auf die Frage „wo gehört das
hin" — und Donalds Befund zur thematischen Fassung war genau der: verwirrend.

`bild` ist **Pflicht und nicht optional**. Es gibt 23 Geschichten und 23
Aufnahmen; ein optionales Feld hiesse, dass die Übersicht zwei Gestalten hätte —
eine mit Bild und eine ohne — und beide müssten aussehen, als wären sie so
gemeint. Der Typ ist der bestehende `ReleaseBild` aus AGE-632 (`src`, `alt`,
`width`, `height`) und kein zweiter daneben: dieselbe Zusage, dass Breite und
Höhe mitkommen, damit der Text unter dem Bild nicht nachrutscht, sobald es lädt.

`thema` steht im Modell, weil die Übersicht nach Themen gliedert (§4). Ohne
Feld wäre die Gliederung eine Absicht im Fliesstext und keine Eigenschaft der
Daten — die Plan-Review hat genau diesen Widerspruch gefunden: `design.md`
versprach thematisch, die Anforderung schrieb chronologisch, und im Modell stand
nichts davon.

`freigegeben` trennt **im Repository liegen** von **öffentlich sein**. Ohne diese
Trennung wäre der Commit die Veröffentlichung, und ein Entwurf könnte vor der
redaktionellen Abnahme live gehen — der zweite Befund derselben Review.

`slug` ist der Schlüssel: er verbindet die Geschichte mit dem Archiveintrag, aus
dem sie übersetzt wurde. Über ihn findet der Admin-Entwurf sie wieder.

**`text` trägt kein Markup**, und das ist eine Zusage, kein Stil. Begründung im
Proposal unter D3: dieselbe Zeichenkette landet in `release_notes.body` und wird
von `ReleaseNoteModal.tsx:74` als Klartext gerendert. Markdown-Syntax wäre dort
sichtbar. Ein Test hält das fest, statt sich darauf zu verlassen, dass niemand
`**` tippt.

## 2 · Der Blog

Ein eigenes Cloudflare-Pages-Projekt. Der bestehende Deploy fährt

```
pnpm exec wrangler pages deploy ./dist --project-name=fbc-platform
```

(`deploy.yml:685`). Der Blog bekommt denselben Befehl mit eigenem Ausgabeordner
und eigenem `--project-name`.

### Kein Framework

Der Erzeuger ist ein `tsx`-Script, das das Modul importiert und statisches HTML
schreibt — eine Übersichtsseite und eine Seite je Geschichte, mit eingebettetem
CSS. Kein React, kein Bundler, **kein JavaScript im Ergebnis**.

Das ist nicht Sparsamkeit, sondern die Umsetzung von D2. „Die öffentliche Seite
kann keine Mitgliederdaten lesen“ ist als Sorgfaltsregel wertlos und als
Baueigenschaft belastbar: wo kein Supabase-Client im Bündel liegt und überhaupt
kein Skript ausgeliefert wird, gibt es nichts, was jemand später versehentlich
verdrahtet.

### Der Wächter ist eine Erlaubnisliste, keine Verbotsliste

Der erste Entwurf liess den Test nach `supabase` und `<script>` suchen. Die
Plan-Review hat das zu Recht verworfen: eine Suche nach Zeichenfolgen benennt,
was verboten ist, und übersieht jede Gestalt, an die niemand gedacht hat —
`onclick=`, `javascript:`, ein `<iframe>`, ein `<link>` auf eine fremde Schrift.

Der Wächter zählt deshalb auf, was **erlaubt** ist, und rötet alles andere. Die
Menge ist klein, weil die Seite klein ist:

```
html head meta title style body aside header main footer
h1 h2 h3 p a time nav article img
```

Attribute: `lang`, `charset`, `name`, `content`, `href`, `datetime`, `class`,
`src`, `alt`, `width`, `height`, `loading`.

**`href` und `src` gehen durch dieselbe Regel:** nur mit `/`-Anfang, also kein
Schema und keine fremde Herkunft. Das ist die Stelle, an der das Bild
hinzukommt, ohne die Zusage zu verwässern — ein Bild von aussen wäre eine
Anfrage nach dem Laden und damit ein Weg, auf dem jemand mitliest. Der Stil
steht weiterhin **inline** in `<style>`; keine externe Datei, keine Schrift von
aussen.

`loading` steht in der Menge, weil die Übersicht 23 Aufnahmen trägt; die unteren
sollen nicht geladen werden, bevor jemand dort ist. Es ist ein Attribut ohne
Verhalten, das Skript brauchte — genau deshalb ist es erlaubbar.

Er misst das am **Artefakt**, nicht an der Absicht: er liest die erzeugten
Dateien. Ein Wächter, der die Eingaben prüft statt des Ergebnisses, belegt die
Zusage nicht — und ein Wächter, der nur Verbotenes sucht, belegt sie auch nicht.

### Die Absätze, und was sonst noch maskiert wird

`text` wird an Leerzeilen getrennt, jeder Teil in `<p>` gelegt. **Jedes
eingesetzte Feld wird maskiert** — Titel und Datum ebenso wie der Text, nicht
nur der Text. Auch das kam aus der Review: der erste Entwurf sprach nur vom
Rumpf, und ein Titel ist genauso ein Einsetzpunkt.

Der `slug` wird zusätzlich gegen `^[a-z0-9-]+$` geprüft, **bevor** aus ihm ein
Dateiname wird. Er kommt aus einem Verzeichnisnamen im Repository und ist damit
nicht feindlich — aber er wird zu einem Pfad, und ein Pfadbestandteil, der
ungeprüft aus Daten entsteht, ist der Punkt, an dem man später nicht mehr
nachsehen will.

## 2b · Zwei Flächen: Blog und Tutorial

Nachgetragen am 09.09. nach Donalds Befund. Die thematische Übersicht war
**verwirrend**: sie beantwortet „wo steht etwas über X" und nicht „was ist neu",
und für jemanden, der die Anwendung kennenlernen will, ist sie überhaupt keine
Ordnung — Themen sind keine Reihenfolge.

Daraus wurden zwei Flächen mit je einer eigenen Frage:

| Fläche | Frage | Ordnung | Quelle |
|---|---|---|---|
| **Blog** (`index.html`) | Was ist neu? | Wochen, jüngste zuerst | `release-ausgaben.ts` |
| **Tutorial** (`tutorial.html`) | Wie geht das? | ein Weg in Etappen | `release-tutorial.ts` |

Beide zeigen auf **dieselbe** Kapitelseite (`<slug>.html`). Die Geschichte wird
einmal geschrieben und zweimal erreicht — über die Ausgabe, in der sie
erschienen ist, und über die Stelle im Weg, an der sie gelernt wird.

**Die Wochen sind gesetzt, nicht gemessen.** Der Blog beginnt am 1. August 2026
und erscheint wöchentlich; die Bündelung von je drei bis fünf Funktionen ist
redaktionell. Die Daten der Archiveinträge taugen dafür nicht: sie liegen dicht
beieinander und sagen, wann etwas gebaut wurde. Vor dem Live-Gang gehört
entschieden, ob die gesetzten Daten so bleiben — die Funktionen selbst sind echt
und gegen die Anwendung geprüft.

**Nur die Einleitung einer Ausgabe darf „neu" sagen.** Sie ist eine Meldung über
einen Zeitraum. Der Text der Geschichte bleibt zeitlos, weil er auch im Tutorial
steht, und dort hat niemand ein Vorher — das ist dieselbe Anforderung wie in §1,
nur jetzt mit einer benannten Ausnahme daneben.

**Der Weg überspringt Entwürfe, ohne abzureissen.** Ist ein Kapitel nicht
freigegeben, zeigt der „Weiter"-Verweis des vorherigen auf das nächste
freigegebene. Sonst führte der Weg für Leser in eine 404, sobald die Redaktion
eine Geschichte zurückhält.

### Die Leiste und die Kopfbereiche

Jede Seite trägt links eine Leiste mit der Marke und den zwei Flächen, die
aktuelle ausgezeichnet. Auf schmalen Fenstern wird daraus eine Zeile über dem
Inhalt: ohne JavaScript gibt es keine Schublade, und eine Schublade ohne
Schalter wäre keine.

Der Kopfbereich ist der der Anwendung — ein Motiv aus `public/images/` mit Titel
und Unterzeile darüber. Das Motiv steht als **`<img>`** und nicht als
`background-image`: der Artefakt-Wächter liest Elemente und Attribute, und eine
Adresse, die nur im Stil steht, entzöge sich ihm. Genau deshalb ist die
Erlaubnisliste hier belastbar und wäre es mit einem CSS-Hintergrund nicht.

Übersicht und Tutorial bekommen je ein eigenes Motiv (`hero-see`, `hero-compass`),
jede Etappe ihres, und eine Kapitelseite erbt das ihrer Etappe. Damit sieht man
an der Seite, wo im Weg man steht.

### Die Übersicht ist eine Blog-Übersicht, keine Linkliste

Der erste Stand führte je Geschichte eine Zeile aus Titel und Datum. Das ist ein
Inhaltsverzeichnis: wer den Titel nicht schon versteht, hat keinen Grund zu
klicken.

Je Geschichte steht deshalb ein `<article>` mit dem Bild, dem Titel als Verweis,
dem Datum, dem **Anriss** und einem ausgeschriebenen „Weiterlesen“. Der Anriss
ist der **erste Absatz des Textes** und kein eigenes Feld — ein zweites Feld
wäre eine zweite Pflegestelle für denselben Gedanken, und die beiden liefen
auseinander, sobald einer geändert wird. Die Texte sind dafür gebaut: jeder
beginnt mit einem Einstieg, der für sich steht.

Zwei Wege in dieselbe Geschichte, Titel und „Weiterlesen“, sind Absicht und
keine Doppelung — der Titel ist das, was man anklickt, wenn man den Gegenstand
kennt, „Weiterlesen“ das, was man anklickt, wenn der Anriss einen geholt hat.

Auf der Einzelseite steht dasselbe Bild oben über dem Text.

### Wo die Bilder liegen

Die Aufnahmen liegen unter `blog/bilder/` und **nicht** unter `public/`. `public/`
ist das Verzeichnis der Anwendung; Vite kopiert es unverändert in deren Bündel,
und die 23 Aufnahmen des Blogs hätten dort nichts zu suchen — sie würden mit
jeder App-Auslieferung mitgehen, ohne dass die App sie je zeigt. `public/release/`
bleibt davon unberührt: dort liegen die drei Bilder, die das Modal **in** der
Anwendung zeigt (AGE-632).

Der Erzeuger kopiert `blog/bilder/` nach `dist-blog/bilder/`. Damit ist das Bild
Teil desselben Artefakts wie die Seite, die es zeigt — und die Zusage „nichts
von fremder Herkunft“ hält ohne weitere Absprache.

**Die Aufnahmen entstehen gegen einen lokalen Stand mit erfundenen Konten.** Das
Repository ist öffentlich; ein Screenshot von DEV — und DEV *ist* PROD — legte
Mitgliederdaten mit dem Commit offen, nicht erst mit der Auslieferung.

## 3 · Der Admin-Entwurf

Heute (`AdminNeuigkeitenPage.tsx:147`):

```ts
const entwurf = entwurfAus(offen.filter((e) => auswahl.includes(e.slug)));
```

Künftig entscheidet der Slug: für jeden ausgewählten Eintrag wird die kuratierte
Geschichte genommen, wenn eine mit diesem Slug vorliegt — sonst der generierte
Entwicklertext von heute.

Der Rückfall ist **nicht** Bequemlichkeit. 75 Archiveinträge stehen 23
kuratierten gegenüber, und jeder künftige Change legt einen neuen Archiveintrag
an, für den noch keine Geschichte geschrieben ist. Ohne Rückfall wäre die Fläche
für genau diesen Eintrag leer — und die bestehende Zusage „der vorgeschlagene
Text ist ein Entwurf“ bliebe unerfüllbar.

### Wie mehrere Einträge zu einer Nachricht werden

Die Plan-Review hat zu Recht bemängelt, dass „welcher Rumpf gewinnt“ nicht
festlegt, was bei mehreren Einträgen passiert — die drei vorgeschlagenen Tests
wären auch dann grün, wenn die Umsetzung Entwicklertitel behielte oder ganze
Geschichten in die Aufzählungsvorlage presste. Also ausdrücklich:

- **Ein** kuratierter Eintrag: sein Titel wird der Titel, sein Text der Text.
  Keine zusätzliche Überschrift, keine Aufzählungsvorlage.
- **Mehrere**: in der Reihenfolge der Liste, jeder mit eigener Überschrift, die
  Absatztrennung jedes Textes bleibt erhalten.

### Und was `release_notes` danach ist

`release_notes` wird nicht angefasst. Die Zeile ist danach die **Abschrift eines
Versands**: was zu diesem Zeitpunkt zugestellt wurde. Ändert sich die Geschichte
im Repo später, ändert sich die Abschrift nicht — das ist richtig so, eine
zugestellte Nachricht ist ein Ereignis, kein Dokument.

**Die Fläche bleibt überschreibbar**, und das ist kein Rückfall in zwei Quellen.
Die Review hat hier einen echten Selbstwiderspruch im ersten Entwurf gefunden:
er verlangte „nur eine Pflegestelle“ und behielt gleichzeitig die Zusage, dass
der Admin frei umschreiben darf. Aufgelöst wird er durch die Unterscheidung, die
vorher fehlte — **der Blog liest die Datei, die Zustellung ist ein Ereignis.**
Eine vor dem Versand geänderte Fassung gilt für diesen Versand und erscheint nie
im Blog. Wer die Geschichte dauerhaft ändern will, ändert die Datei.

## 4 · Die Auswahl: 23 Geschichten in 7 Themen

Aus 75 Archiveinträgen. Thematisch gebündelt, nicht chronologisch — 75
Datumszeilen sind keine Leseordnung. Das Thema steht als Feld im Modell (§1),
damit die Gliederung eine Eigenschaft der Daten ist und nicht eine Absicht im
Fliesstext.

**Der Archiveintrag ist der Anlass, nicht die Vorlage.** Die Plan-Review hat
gezeigt, dass der erste Entwurf das verwechselte: seine Titel lasen sich als
Änderungsmeldungen — „ohne Doppelungen“, „der Umbau“, „läuft jetzt mit“ — und
setzten damit eine Erfahrung voraus, die kein Mitglied gemacht hat. Genau das
war Donalds Ausgangspunkt: niemand kennt ein Vorher.

Jede Geschichte beantwortet deshalb drei Fragen: **wozu brauche ich das, wie
geht es heute, ab welcher Stufe.** Die Stichpunkte des Archiveintrags sind
Rohstoff dafür und kein Beleg, dass das Verhalten heute noch so besteht — das
wird gegen Anforderung und Anwendung geprüft.

| Thema | Anlass | Geschichte |
| --- | --- | --- |
| Nachrichten | AGE-627 | Wo die Nachrichten liegen: die Leiste am rechten Rand |
| Nachrichten | AGE-639 | Mehrere Gespräche nebeneinander führen |
| Nachrichten | AGE-645 | Emoji und Zeitstempel im Gespräch |
| Nachrichten | AGE-655 | Weit zurückliegende Nachrichten wiederfinden |
| Nachrichten | AGE-583 | Woran man sieht, dass etwas Ungelesenes da ist ⚠ |
| Aktivität | 25.08. | Die Aktivität: Reiter, Sortierung und die Seitenspalte |
| Aktivität | AGE-590 | Den Feed auf die Beitragsarten eingrenzen, die einen interessieren |
| Aktivität | AGE-667 | Einen Beitrag vorbereiten und zu einer festen Zeit zeigen |
| Aktivität | AGE-670 | Einen angefangenen Beitrag wieder loswerden |
| Aktivität | AGE-629 | Suche und Filter bleiben beim Blättern in Reichweite |
| Events | AGE-630 | Eine Terminreihe aus einer Vorlage anlegen |
| Events | AGE-594 | Warum eine Anmeldung manchmal eine Stufe verlangt |
| Verzeichnis | AGE-598 | Das Mitgliederverzeichnis: ab Connect, und was darin steht |
| Verzeichnis | AGE-595 | Die zwei Reiter im Verzeichnis und das Titelbild |
| Verzeichnis | AGE-597 | Das eigene Profil: was darauf steht |
| Hinweise | AGE-620 | Die Glocke: welche vier Dinge sie meldet |
| Hinweise | AGE-592 | Wo eingegangene Kontaktanfragen auftauchen |
| Bedienung | AGE-638 | Beide Seitenleisten wegklappen, wenn man Platz braucht |
| Bedienung | AGE-584 | Die App auf dem Telefon |
| Bedienung | AGE-621 | Videos: einmal freigeben statt jedes Mal |
| Bedienung | AGE-611 | Warum ein Video erst auf Klick lädt ⚠ |
| Konto | AGE-505 | Das Passwort zurücksetzen |
| Konto | AGE-628 | Feedback geben — und was damit passiert |

⚠ = der Archiveintrag ist leer (`aenderungen: []`). Diese zwei haben keinen
Rohstoff; sie entstehen aus der Anwendung. Das gilt aber **nicht nur** für sie:
jede Geschichte wird gegen die Anwendung geprüft, weil ein Archiveintrag nur
sagt, was einmal gebaut wurde.

**Die Auswahl ist nicht Teil der Zusagen.** Sie ist eine redaktionelle
Entscheidung und darf sich ändern, ohne dass eine Anforderung bricht. Was
zugesichert wird, ist der Mechanismus: eine Quelle, Klartext, kein
Datenbankzugriff aus dem öffentlichen Pfad.

## 5 · Verworfene Alternativen

**`release_notes` als Quelle.** Hätte den öffentlichen Blog einen
`anon`-Lesepfad in die Tabelle gekostet — Policy, Grant und pgTAP-Zusage, an
drei Stellen nachgezogen, nach dem Muster von `profiles_public`. Dafür wäre
Redigieren ohne Deploy möglich gewesen. Donald hat am 08.09. die Repo-Variante
gewählt; sie löscht die Sicherheitsentscheidung, statt sie zu treffen.

**Blog als Route in der bestehenden App.** Eine Route weniger Infrastruktur,
aber öffentliche Seiten und Mitgliederflächen lägen im selben Bündel hinter
demselben Supabase-Client. Ausserdem müssten die Erstlast-Wächter
(`scripts/entry-chunk-guard.ts`) die neuen Seiten mittragen. Verworfen mit D2.

**Markdown als Textformat.** Verworfen mit Messung, siehe Proposal D3.

**Die generierte Datei um eine Handspalte erweitern.** Sie wird bei jedem Build
überschrieben. Verworfen in Abschnitt 1.
