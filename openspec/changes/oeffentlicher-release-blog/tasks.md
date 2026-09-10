# Aufgaben

Reihenfolge ist Absicht: die Quelle und ihre Zusagen zuerst, weil sie das
einzige Stück sind, das ohne Auslieferungsziel beweisbar ist. Dann der Erzeuger,
dann die Texte — und **erst zuletzt** die Auslieferung.

> Fassung 2, nach der Plan-Review. Die Auslieferung stand vorher **vor** dem
> Schreiben und der Freigabe; damit hätte ein Commit einen unfertigen Entwurf
> veröffentlicht. Neu sind ausserdem 1.6, 2.6, 3.5 und 5.4.

Aufgaben mit **[Donald]** kann diese Sitzung nicht abschliessen — sie brauchen
Zugänge, die hier nicht liegen.

## 1 · Die kuratierte Quelle

- [x] **1.1 RED** — `src/content/release-geschichten.test.ts`: eine Geschichte
      hat Slug, Datum, Thema, Titel, Klartext und Freigabe-Merker; Slugs sind
      eindeutig; jeder Slug zeigt auf einen existierenden Archiv-Eintrag und
      passt auf `^[a-z0-9-]+$`. Erster Lauf rot am fehlenden Modul.
- [x] **1.2 GREEN** — `src/types/release.ts` um `ReleaseGeschichte` und
      `ReleaseThema` erweitern, `src/content/release-geschichten.ts` mit
      **einer** echten Geschichte anlegen.
- [x] **1.3 RED** — Der Klartext-Wächter: ein Text mit `**Betonung**`, mit
      `<b>` oder mit einem Markdown-Link SHALL die Prüfung röten. Zuerst als
      roter Test gegen eine absichtlich verdorbene Beispiel-Geschichte.
- [x] **1.4 GREEN** — Wächter grün, echte Geschichten unberührt.
- [x] **1.5** Jede Zusage aus 1.1/1.3 durch eine Mutation belegen. Besonders:
      röten die Slug-Zusagen wirklich, wenn ein Slug auf kein Archiv zeigt?
      Ein Test, den keine Mutation rötet, belegt nichts.
- [x] **1.6 RED → GREEN** — Der PII-Wächter. Er rötet eine Geschichte, die eine
      E-Mail-Adresse, eine Telefonnummer oder eine Anschrift enthält.
      **Er ist ein Netz, keine Zusage:** einen Klarnamen erkennt er nicht, und
      genau deshalb steht 5.4 daneben. Das Repository ist öffentlich — ein
      solcher Text ist mit dem Commit offengelegt, nicht erst mit dem Deploy.

## 2 · Der Blog-Erzeuger

- [x] **2.1 RED** — `scripts/build-blog.test.ts`: aus Geschichten zweier Themen
      entstehen eine Übersicht und je eine Seite; die Übersicht gliedert nach
      Thema und führt **innerhalb** eines Themas die jüngste zuerst; eine
      Leerzeile im Text wird zu zwei `<p>`.
- [x] **2.2 RED** — Die Maskierungs-Zusage **zuerst als roter Test**, und zwar
      für **jedes** eingesetzte Feld: eine Geschichte, deren **Titel** und deren
      **Text** je `<script>` als Zeichenfolge enthalten, darf im Ergebnis kein
      `<script>`-Element erzeugen.
- [x] **2.3 GREEN** — `scripts/build-blog.ts`: importiert das Modul, schreibt
      statisches HTML mit eingebettetem CSS. Kein React, kein Bundler, **kein
      Skript im Ergebnis**.
- [x] **2.4 RED → GREEN** — Der Artefakt-Wächter als **Erlaubnisliste**
      (`design.md` §2). Er liest die erzeugten Dateien, zerlegt sie und rötet
      jedes Element und jedes Attribut ausserhalb der erlaubten Menge. Zuerst
      rot gegen vier untergeschobene Gestalten: ein `<script>`, ein
      `onclick=`, ein `href="javascript:"` und ein `<link>` auf eine fremde
      Herkunft. Eine Suche nach Zeichenfolgen genügt **nicht** — sie hätte drei
      dieser vier durchgelassen.
- [x] **2.5 RED → GREEN** — Nur Freigegebenes wird erzeugt: eine Geschichte mit
      `freigegeben: false` erscheint weder in der Übersicht noch als Seite.
- [x] **2.6** Die Seite in beiden Themes und auf einem schmalen Gerät ansehen.
      Sie trägt kein JavaScript, also ist `prefers-color-scheme` der einzige
      Weg — das gehört gesehen, nicht angenommen.

## 3 · Der Admin-Entwurf zieht aus der Quelle

- [x] **3.1 RED** — `src/lib/release-entwurf.test.ts` um die Zusagen aus den
      neuen Szenarien im Admin-Delta erweitern: kuratiert → Geschichte; nicht
      kuratiert → erzeugter Text; gemischt → beides im selben Entwurf.
- [x] **3.2 RED** — Die Zusammensetzung, die 3.1 **nicht** abdeckt: bei genau
      einem kuratierten Eintrag ist dessen Titel der Titel und sein Text der
      Text — ohne zusätzliche Überschrift und ohne Aufzählungsvorlage; bei
      mehreren bleibt die Reihenfolge der Liste und jede Absatztrennung
      erhalten. Ohne diese Zusagen wäre 3.1 auch dann grün, wenn die Umsetzung
      Entwicklertitel behielte oder Geschichten in die Vorlage presste.
- [x] **3.3 GREEN** — `entwurfAus()` nimmt die kuratierten Geschichten
      entgegen und entscheidet je Slug. Der Aufrufer bleibt
      `AdminNeuigkeitenPage.tsx:147`.
- [x] **3.4** Die fünf bestehenden Zusagen an `entwurfAus()` laufen unverändert
      grün. Läuft eine nicht mehr, ist das ein Befund und keine
      Anpassungsgelegenheit.
- [x] **3.5** `release_notes` wird **nicht** angefasst — keine Migration im
      Diff. Gegenprobe: `git diff --stat supabase/` ist leer.

## 4 · Die 23 Geschichten

- [x] **4.1** Entwurf aller 23 nach der Tabelle in `design.md` §4. Jede
      beantwortet drei Fragen: **wozu, wie heute, ab welcher Stufe** — und
      setzt kein Vorher voraus. Der Archiveintrag ist der Anlass, nicht die
      Vorlage.
- [x] **4.2** Jede Geschichte gegen die geltende Anforderung in
      `openspec/specs/` **und** gegen die Anwendung prüfen. Ein Archiveintrag
      belegt nur, was einmal gebaut wurde — nicht, dass es heute noch so ist
      und für welche Stufe.
- [x] **4.3** Die **zwei leeren** Einträge (AGE-583, AGE-611) haben keinen
      Rohstoff (`aenderungen: []`) und entstehen ganz aus der Anwendung.
- [x] **4.4** PII-Durchgang **vor dem Commit**, von Hand, über alle 23 plus
      alle Testdaten: keine Namen, Anschriften, Adressen, Telefonnummern, keine
      Profil-, Beitrags- oder Nachrichteninhalte einzelner Mitglieder. Beispiele
      sind erfunden. Das Repository ist öffentlich, und der Wächter aus 1.6
      erkennt keinen Klarnamen.
- [ ] **4.5 [Donald]** Redaktionelle Abnahme, danach `freigegeben: true`. Bis
      dahin liegen die Geschichten im Repository, ohne öffentlich zu sein.
      Die Auswahl ist eine redaktionelle Entscheidung und keine Zusage — sie
      darf sich ändern, ohne dass eine Anforderung bricht.

## 5 · Auslieferung — erst nach der Freigabe

- [x] **5.1** Cloudflare-Pages-Projekt für den Blog anlegen. **Erledigt am
      10.09.:** `fbc-blog`, Produktionszweig `main`, Adresse
      `fbc-blog.pages.dev`. Auf Donalds Zuruf „baue alles und deploye" von
      dieser Sitzung angelegt statt von Hand.
- [ ] **5.2** Deploy-Schritt nach dem Muster von `deploy.yml:685`
      (`wrangler pages deploy` mit eigenem Ordner und eigenem
      `--project-name`). Er läuft **unabhängig** vom Deploy der Anwendung: ein
      Fehlschlag des einen lässt das andere unverändert.
- [ ] **5.3 [Donald]** `www.effbeezee.com` bei Strato als CNAME auf das
      Pages-Projekt. `www` ist eine Subdomain und geht denselben Weg wie
      `app.effbeezee.com` seit dem 01.09.; der nackte Apex kann das **nicht**
      (AGE-256) und ist hier ausdrücklich nicht Gegenstand.
- [ ] **5.4** Ein Aufruf der Live-Adresse belegt die Auslieferung. Ein grüner
      Workflow belegt sie nicht. Dabei gegenprüfen, dass keine nicht
      freigegebene Geschichte erreichbar ist.

## 6 · Abnahme

- [ ] **6.1** `openspec validate --all` grün.
- [ ] **6.2** `pnpm lint` (Exit-Code, nicht die Ausgabe — die 14 Fehler aus dem
      gitignorierten `.gstack/` sind nicht Teil dieses Diffs), `pnpm typecheck`,
      `pnpm test`, `pnpm build`, beide Erstlast-Wächter.
- [x] **6.3** Plan-Review (2b) vor der ersten Codezeile — `REVIEWS.md`,
      gemini + codex, 2 HIGH und 6 MEDIUM eingearbeitet.
- [ ] **6.4** Code-Review auf dem **Diff**, nicht auf dem Plan.
- [ ] **6.5** Archivieren, danach `pnpm release:entries` — das Archivieren legt
      einen neuen Eintrag an, und der Erzeuger muss ihn sehen.

## 7 · Der Blog liest sich wie ein Blog

Nachgezogen am 09.09., nachdem der erste Stand stand: die Übersicht war eine
Linkliste, und der Erzeuger kannte keine Bilder. Die Abnahme in Block 6 läuft
danach erneut — sie deckt diesen Block mit ab.

- [x] **7.1 RED** — `src/types/release.ts`: `ReleaseGeschichte` trägt `bild:
      ReleaseBild` (Pflichtfeld, bestehender Typ aus AGE-632). Der Test der
      Quelle rötet, solange eine Geschichte kein Bild trägt.
- [x] **7.2 RED** — Die Bilddatei existiert wirklich. Eine Geschichte, die auf
      eine Datei zeigt, die es unter `blog/bilder/` nicht gibt, rötet. Ohne
      diese Zusage belegt der Typ nur, dass eine Zeichenkette dasteht.
- [x] **7.3 RED** — `scripts/build-blog.test.ts`: die Übersicht führt je
      Geschichte den ersten Absatz als Anriss und **keinen** der folgenden;
      Titel und „Weiterlesen“ zeigen auf dieselbe Seite; Übersicht und
      Einzelseite tragen das Bild mit `alt`, `width` und `height`.
- [x] **7.4 RED** — Der Artefakt-Wächter rötet ein `<img>` mit fremder Herkunft
      (`src="https://…"`) und ein `<img>` mit `onerror=`. Erst danach kommen
      `img` und seine Attribute in die Erlaubnisliste — sonst belegt die
      Erweiterung nichts.
- [x] **7.5 GREEN** — Erzeuger: `<article>` je Geschichte, Hero auf der
      Einzelseite, `blog/bilder/` → `dist-blog/bilder/` kopiert.
- [x] **7.6** Die 23 Aufnahmen ins Repository übernehmen — **jede einzeln
      angesehen** vor dem Commit. Das Repository ist öffentlich, und ein Bild
      trägt mehr Text, als sein Dateiname verrät.
- [x] **7.7** Übersicht und eine Einzelseite in beiden Themes und auf 390 px
      ansehen. Wie 2.6: die Seite trägt kein JavaScript, also ist
      `prefers-color-scheme` der einzige Weg.

## 8 · Zwei Flächen: Blog und Tutorial

Nachgezogen am 09.09. auf Donalds Befund: die thematische Gliederung war
verwirrend. Der Blog stellt jetzt **wöchentliche Ausgaben** vor, das Tutorial
führt in einer festen Reihenfolge durch die Anwendung. Block 6 läuft danach
erneut.

- [x] **8.1** Spec-Delta zuerst: die Zusage „nach Themen gegliedert" ist
      ersetzt, drei Anforderungen sind neu (Ausgaben, Tutorial-Weg, Navigation
      und Kopfbereich). `openspec validate --all` grün, bevor Code entsteht.
- [x] **8.2 RED → GREEN** — `release-ausgaben.ts` und `release-tutorial.ts` mit
      ihren Zusagen in `release-flaechen.test.ts`: jeder Slug zeigt auf eine
      Geschichte, jede Geschichte steht in genau einer Ausgabe und in genau
      einer Etappe, jedes Motiv auf eine Datei. **Durch Mutation belegt** —
      einen Slug entfernt, ein Kapitel verdoppelt, beides rötet.
- [x] **8.3 GREEN** — Erzeuger: Blog-Übersicht, Ausgabeseite, Tutorial-Übersicht,
      Kapitelseite mit „Weiter", Leiste auf jeder Seite, Kopfbereich mit Motiv.
- [x] **8.4** `thema` und `RELEASE_THEMEN` entfernt — keine Fläche liest sie
      mehr, und ein drittes Ordnungsmerkmal wäre eine zweite Antwort auf
      dieselbe Frage.
- [x] **8.5** Wächter: `aside` in die Erlaubnisliste, `ul`/`li` heraus. Das
      Motiv geht als `<img>` und NICHT als `background-image` — sonst stünde
      eine Adresse im Stil, an die der Wächter nicht herankommt.
- [x] **8.6** Sichtprobe beider Flächen und einer Kapitelseite in hell und
      dunkel, breit und auf 390 px.
- [x] **8.7 [Donald]** Entscheiden, ob die **gesetzten** Ausgabedaten (ab
      1. August, wöchentlich) so bleiben. Die Funktionen sind echt, die
      Bündelung in Wochen ist redaktionell erfunden.
      **Entschieden am 10.09. (Donald): so lassen.** Sechs Wochenausgaben ab
      dem 1. August bleiben unverändert; `release-ausgaben.ts` wird nicht
      angefasst. Die Daten bleiben damit redaktionell gesetzt und sind
      ausdrücklich keine Messung.

## 9 · Ein Blogeintrag pro Woche

Nachgezogen am 10.09. auf Donalds Befund an der Abnahmefläche: der Blog hatte
**drei** Ebenen. Übersicht → Ausgabe (nur Anrisse) → 23 einzelne Kapitelseiten.
Für die Details einer Woche klickte man viermal und las auf vier Seiten.

- [x] **9.1** Die Ausgabenseite trägt die **vollen** Texte, je Geschichte ein
      Abschnitt mit Bild und Titel. Kein Anriss, kein „Weiterlesen“ je
      Geschichte — von der Übersicht führt **ein** Verweis in die Woche.
- [x] **9.2** Die Kapitelseiten bleiben, aber nur noch fürs **Tutorial**. Dort
      geht man einen Weg entlang, und eine Seite je Schritt ist die richtige
      Form. `anrissArtikel` bedient nur noch das Tutorial; der Bildparameter,
      den 9.1 verwaiste, ist entfallen.
- [x] **9.3 [Donald]** Das Datum aus der öffentlichen Adresse nehmen
      (`/2026-08-26-password-reset-flow.html` → `/password-reset-flow.html`).
      **Der Slug bleibt unverändert** — er ist der Schlüssel zum Archiveintrag,
      und ein Test pinnt das. Der Pfad wird abgeleitet, statt als zweites Feld
      gepflegt zu werden: 23 Slugs ergeben 23 eindeutige Namen, gemessen.
- [x] **9.4** Wächter gegen Pfadkollision: zwei Slugs, die sich nur im Datum
      unterscheiden, ergäben eine Seite, die die andere lautlos überschreibt.
      Der Erzeuger bricht jetzt ab.
- [x] **9.5** Tests nachgezogen. Der eine rote Test hielt die alten
      Kapitelverweise fest; er prüft jetzt den vollen Text, und ein zweiter
      schliesst die dritte Ebene aktiv aus. Die Ableitung ist mit **echtem**
      Datumspräfix gepinnt — die Fixtures benutzen datumsfreie Slugs, dort
      belegte sie nichts. **Durch Mutation belegt:** Ableitung abgeschaltet,
      genau die drei neuen Tests röten.
- [x] **9.6** Spec-Delta nachgezogen: „Eine Ausgabe ist ein Blogeintrag“ und
      „Die öffentliche Adresse trägt kein Datum“ neu, die Anriss-Anforderung
      gilt ausdrücklich nur noch für die beiden Übersichten.
- [ ] **9.7 [Donald]** Die redaktionelle Abnahme (4.5) läuft **an der
      Vorschau**, nicht mehr am Fahnenabzug — sie zeigt genau das, was
      ausgeliefert würde. Entschieden am 10.09.

- [x] **9.8** `404.html` — **gemessen am Live-Stand**, nicht angenommen: ohne
      sie lieferte Cloudflare Pages bei JEDER unbekannten Adresse die
      Startseite mit Status 200. Damit wäre 5.4 („keine nicht freigegebene
      Geschichte ist erreichbar") unprüfbar gewesen, weil jede Adresse
      antwortet. Jetzt 404, auch wenn nichts freigegeben ist.
- [x] **9.9** Vorschau-Deploy auf `vorschau.fbc-blog.pages.dev` — Freigabe nur
      im Build erzwungen, **die Quelle bleibt bei 23× `freigegeben: false`**;
      Vorschau-Zweig statt Produktionsadresse; `robots.txt` mit `Disallow: /`
      im Bündel. Das redaktionelle Urteil steht damit weiter aus.
      **Falle:** die Alias-Adresse liefert den Zwischenspeicher des
      VORGÄNGER-Deploys. `/2026-08-26-…` gab dort noch 200 mit dem Rumpf der
      404-Seite; mit Cache-Umgehung und auf der Deployment-Adresse sauber 404.
      Nach einem Deploy also mit `?cb=…` oder auf `<hash>.pages.dev` messen.
