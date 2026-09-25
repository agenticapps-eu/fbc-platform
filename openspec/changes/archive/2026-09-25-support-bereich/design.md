## Context

Die Tutorial-Texte liegen seit AGE-705 in zwei von Hand gepflegten Dateien
(`src/content/release-tutorial.ts` — der Weg in sieben Etappen;
`release-geschichten.ts` — 23 Geschichten, alle freigegeben). Gelesen werden sie
heute von genau einem Erzeuger, `scripts/build-blog.ts`, der daraus den
öffentlichen Blog auf `www.effbeezee.com` baut. Die Anwendung selbst rendert
diese Texte nirgends: `NeuesPage` liest `release_notes` aus der Datenbank, nicht
die Dateien.

Drei Dinge sind vor dem Entwurf gemessen worden (25.09., auf `main` 44c4f70):

1. **Die Kapitelbilder liegen absichtlich ausserhalb des App-Bündels.**
   `blog/bilder/` (23 PNG, 5,0 MB) wird erst beim Blog-Bau nach `/bilder/`
   kopiert; der Kommentar an `ReleaseGeschichte.bild` sagt ausdrücklich, `src`
   zeige „in den Ausgabeordner des Blogs (`/bilder/…`), nicht in das Bündel der
   Anwendung". Die Etappen-**Motive** dagegen (`public/images/hero-*.webp`,
   1,4 MB) liegen längst in der Anwendung.
2. **Dieselben 23 Bilder als WebP sind 884 KB** (`cwebp -q 82`, grösste Datei
   97 KB, Abmessungen unverändert — die `width`/`height` in den Daten gelten
   weiter).
3. **Die Navigation ist streng verriegelt.** `src/config/nav.test.ts` nagelt
   sieben sichtbare Einträge fest *und* alle vierzehn Routen namentlich, weil
   drei stille Mutationen (`/chat` umbenannt, `/neues` samt Route entfernt)
   vorher grün durchliefen.

Nebenan läuft AGE-907 (`kaufweg-ruhend`) in derselben Datei: Profilmenü
`AppShell.tsx` 239–253 und der `navItem`-Block `/mitgliedschaft` in `nav.ts`
163–170. Abgestimmt am 25.09., keine Überschneidung.

## Goals / Non-Goals

**Goals:**

- Ein Abschnitt „Support" am Fuss der Leiste mit „Tutorials" und „Feedback",
  erreichbar offen, eingeklappt und in der Schublade.
- Eine Tutorial-Fläche in der Anwendung, gespeist aus derselben Quelle wie der
  Blog.
- Bilder, die den Tag überleben, an dem `www.effbeezee.com` abgeschaltet wird.
- Der Blog bleibt bis AGE-906 vollständig baubar und auslieferbar.

**Non-Goals:**

- Den Blog abschalten, Verweise auf `www` entfernen, die Spec `release-blog`
  zurücknehmen — das ist AGE-906.
- Die Hauptnavigation anfassen. Die sieben Menüeinträge aus AGE-494 bleiben.
- Tutorial-Inhalte schreiben oder umsortieren. Der Weg steht seit AGE-705.
- Einen Deep Link auf die Tutorial-Fläche.
- `FeedbackButton.tsx` selbst ändern. Der Abschnitt entsteht *um* ihn herum.

## Decisions

### D1 — Eine Seite mit Sprungmarken, keine Kapitel-Unterseiten

Entschieden von Donald am 25.09. aus drei vorgelegten Formen.

`/hilfe/tutorials` trägt oben die sieben Etappen als Sprungmarken, darunter
Etappe für Etappe die Kapitel mit Bild und vollem Text.

*Alternative A (verworfen): Übersicht + `/hilfe/tutorials/:slug` wie im Blog.*
Sie spiegelt den Blog 1:1, kostet aber Slug-Routing, eine Antwort auf unbekannte
Slugs und den Schlüssel im Zustand gegen das bekannte Muster „Routenwechsel ohne
Remount zeigt das alte Dokument". *Alternative B (verworfen): eine Seite je
Etappe.* Dieselben Routing-Kosten für sieben statt 23 Unterseiten.

Der Blog hat Kapitelseiten, weil er ein Dokumentbaum ist. In der Anwendung ist
die Hilfe ein Ort, an dem man sucht — eine Seite, die man einmal durchsieht oder
durchsucht, ist dafür das kleinere und das bessere Ding. Wird sie zu lang, ist
das Aufteilen später eine Route.

### D2 — Die Bilder wandern als WebP nach `public/tutorial/`

Entschieden von Donald am 25.09., gegen zwei Alternativen.

`blog/bilder/*.png` → `public/tutorial/*.webp`, einmalig gewandelt; `bild.src`
in `release-geschichten.ts` zeigt danach auf `/tutorial/<name>.webp`.

*Alternative A (verworfen): die PNG unverändert nach `public/bilder/`
verschieben.* Kleinster Diff — eine Konstante, ein `git mv` —, aber 5,0 MB in
jedem OTA-Bündel. *Alternative B (verworfen): Supabase Storage.* Das Bündel
wüchse gar nicht, aber es bräuchte Bucket, Policies und einen Upload-Weg, und
im Flugzeugmodus bliebe die Hilfeseite bildlos — bei einer Hilfeseite der
schlechteste Moment.

884 KB ist der Preis, und er wird **am gebauten Artefakt** nachgemessen, nicht
an den Quelldateien: ein Bau ohne Secrets hat das Bündel hier schon einmal um
369 KB unterschätzt.

### D3 — Der Blog liefert die Bilder danach aus `public/` aus, unter `/tutorial/`

`bild.src` ist **eine** Zeichenkette für zwei Flächen. Wandert sie auf
`/tutorial/…`, muss der Blog unter derselben Adresse ausliefern — sonst zeigt
eine der beiden Flächen ins Leere.

Also: `BILDER_QUELLE` wird `public/tutorial`, der Ausgabeordner heisst
`tutorial` statt `bilder`, und `bilderZumAusliefern` schneidet das neue Präfix
ab. Die **Motive** der Kopfbereiche bleiben, wie sie sind (`public/images` →
`/bilder/<motiv>`): sie werden im Erzeuger verlinkt, nicht in den Daten, und
teilen die Zeichenkette mit niemandem.

`blog-artefakt-waechter.ts` bleibt unberührt — er prüft Ursprünge („jede Adresse
beginnt mit `/`"), keine Verzeichnisse.

### D4 — Die Route entsteht als `navItem` mit `section: "sub"`, am Ende der Liste

Wie `/neues` und `/chat`: geroutet, kein Menüeintrag, `requiresAuth: true`, kein
`minTier`. Damit entsteht die Route aus derselben einen Quelle wie alle anderen,
und `App.tsx` wird nicht angefasst — insbesondere **nicht** die Redirect-Traube,
in die AGE-907 gerade schreibt.

Der Eintrag kommt ans **Ende** der Liste, hinter `/neues`, und nicht in die Nähe
von Zeile 163–170, wo AGE-907 den `/mitgliedschaft`-Block entfernt. Im Wächter
wächst `ALLE_ROUTEN` um eine Zeile; die sortierte Liste nimmt beide Änderungen
nebeneinander auf.

### D5 — Kein Deep Link, und das steht hier, damit es niemand für einen Fehler hält

`src/lib/deep-links.ts` spricht die Menge einmal aus:
`["/aktivierung", "/chat/", "/events/", "/p/"]`; AndroidManifest und AASA halten
sich daran, `deep-links.native.test.ts` hält die Dateien gegeneinander.
`/hilfe/tutorials` kommt **nicht** dazu. Von aussen angeklickt öffnet die
Adresse den Browser, nicht die App. Für eine Hilfeseite ist das richtig, und die
Menge zu erweitern kostet drei Dateien, einen Deploy und eine Gegenprobe am
Gerät.

### D6 — Der Support-Abschnitt entsteht UM den Feedback-Knopf herum, nicht IN ihm

Aus dem heutigen `<div>` mit dem `FeedbackButton` wird ein Abschnitt mit
Überschrift und zwei Einträgen. `FeedbackButton.tsx` selbst bleibt unverändert,
insbesondere seine beiden Zusagen:

- `onOffenChange={setFeedbackInSchublade}` bleibt in der Schublade am
  Feedback-Eintrag (AGE-688: sonst tragen Schublade und portalisiertes Formular
  gleichzeitig `aria-modal`).
- Escape bleibt beim Formular in der Capture-Phase (AGE-697: erstes Escape
  schliesst das Formular, zweites die Schublade).

„Tutorials" ist ein `Link` und geht in der Schublade über den bestehenden
`onNavigate`-Weg, der sie schliesst. Ein Auslöser **im** Overlay nimmt seinen
Zustand mit — deshalb darf der Feedback-Eintrag dort gerade nicht über
`onNavigate` laufen.

Die Überschrift „Support" ist in der eingeklappten Leiste verborgen (das Rail
ist 1 Symbol breit), die Einträge behalten dort ihren zugänglichen Namen über
`aria-label`/`title` — dasselbe Muster, das `FeedbackButton` für `collapsed`
schon fährt.

### D7 — Absätze als `<p>`, nicht als `whitespace-pre-line`

Der Text der Geschichten ist Klartext, Leerzeile trennt Absätze.
`ReleaseNoteModal` rendert ihn mit `whitespace-pre-line` in **einem** `<p>` —
richtig für ein kurzes Modal, zu eng für eine Fläche, auf der 23 Kapitel
hintereinander gelesen werden. Die Tutorial-Fläche teilt am Leerzeilenpaar und
setzt echte Absätze, wie `absaetze()` im Blog. Das ist eine Zeile Code und der
Unterschied zwischen einer Hilfeseite und einer Textwand.

### D8 — Bilder unterhalb des ersten Bildschirms werden verzögert geladen

`loading="lazy"` an jedem Kapitelbild ausser dem ersten. Zu beachten: ein
`<img>` in `display:none` wird **trotzdem** geladen — die Fläche darf Kapitel
also nicht per CSS verstecken und sich für sparsam halten. Sie versteckt nichts;
die Sprungmarken springen, sie filtern nicht.

## Risks / Trade-offs

- **Das OTA-Bündel wächst um ~884 KB** → Am gebauten Artefakt messen (`dist`),
  die Zahl in den PR schreiben, damit AGE-907 einen belegten Wert hat statt
  einer Schätzung.
- **`bild.src` ist eine Zeichenkette für zwei Flächen** → Der Blog muss in
  derselben Runde auf `/tutorial/` umgestellt werden (D3). Gegenprobe: Blog
  bauen und eine Seite auf ein geladenes Bild prüfen, nicht nur `pnpm test`.
- **23 geänderte Datenzeilen plus zwei Wächter** (Pfadmuster im Test, Quelle im
  Erzeuger) → Die Wächter sind der Grund, warum das auffällt, wenn eine Zeile
  vergessen wird; der Test prüft Muster *und* Existenz der Datei.
- **`release-entries.generated.ts` wird bei jedem `pnpm build` neu geschrieben**
  → Nach jedem Bau `git checkout -- src/content/release-entries.generated.ts`,
  sonst landet ein fremder Diff im PR.
- **Zwei Sitzungen in `AppShell.tsx`** → Abgestimmt, Abstand gross (239–253
  gegen 899–906/1211–1214). Wenn AGE-907 zuerst landet, wird rebased, nicht
  gemergt.
- **Die Spec `feedback-qm` beschreibt einen schwebenden Knopf, den es seit
  AGE-566 nicht gibt** → Die Drift wird hier korrigiert (MODIFIED + RENAMED),
  weil die neue Zusage ihr sonst offen widerspräche. Sie wird korrigiert, nicht
  erweitert: die Sache, die sie schützt, bleibt Wort für Wort erhalten.
