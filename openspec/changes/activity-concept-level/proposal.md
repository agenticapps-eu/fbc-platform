## Why

**Issue: AGE-582** („Aktivität auf Konzeptstand: Reiter, Speichern, gefüllte
Sidebar, Umfragen — plus Icon-/Farbkanon für alle Karten").

Die Fläche `/aktivitaet` steht neben dem Konzeptbild und fällt an vier Stellen
ab: der Composer liegt über der vollen Breite statt über der Feed-Spalte, es gibt
keine Reiter und kein Speichern, die rechte Spalte trägt nur den Tag-Filter, und
die Karten auf Dashboard, Events und Mitgliedern tragen Text ohne Symbol.

AGE-528 hat die rechte Spalte **ausdrücklich vertagt** — „beim Bau entscheiden,
ob das in den Go-Live gehört oder ob die Spalte erst mit mehr Inhalt trägt" — und
der Bau schrieb „Beliebte Tags" und „Aktivste Mitglieder" als Non-goals in
`CommunityFeed.tsx:213` fest. Dieser Change löst jene Vertagung auf; der Kommentar
dort gehört mitgeändert, sonst widerspricht der Code seiner eigenen Begründung.

Umfragen (§5 des Issues) sind **nicht Teil dieses Changes**. Sie sind als
einziger Teil ein eigenes Datenmodell und hängen an keinem anderen Teil außer
einem Knopf im Composer — sie bekommen einen eigenen Change, damit dieser hier
fertig und abgenommen sein kann, während jener noch läuft.

## What Changes

### Unterbau: Icon-Satz und Bereichs-Kanon

Der Issue-Text sagt „eine Stelle, an der ein Gegenstandsbereich sein Icon UND
seine Farbe bekommt". Gemessen sind das **zwei** Dinge, und sie werden hier
getrennt gebaut:

- **Ein Icon-Satz** — alle **wiederverwendbaren Glyphen** in einem Stil an einer
  Stelle. Markenmarke, Kompassmarke, Avatar-Platzhalter und Diagramm-Vektoren
  bleiben ausgenommen: SVGs liegen in **14** Dateien außerhalb `src/vision`, und
  ein 48er-Logo oder ein 200×48-Diagramm kann den 24er-Glyphstil nicht treffen.
  Für die Markenmarke besteht eine eigene Anforderung. Heute liegen
  neben `NavIcon.tsx` (elf Pfad-gekeyte Menü-Icons plus elf gefüllte Fassungen)
  **neun** Einzel-SVGs in den vier vom Issue genannten Dateien, nicht sieben:
  `AppShell.tsx` allein trägt vier (`ChevronLeftIcon`, `BellIcon`, `MenuIcon`,
  `ChevronDownIcon`), dazu `FeedbackIcon`, `SearchIcon` und im Feed `HeartIcon`,
  `CalendarIcon`, `CommentIcon`. Ungenannt im Issue, aber im selben Befund:
  **`CrownIcon` steht zweimal byte-gleich im Baum** (`mein-bereich/building-blocks.tsx`
  und `profile/ProfileHero.tsx`), und `matching/CategoryIcon.tsx` ist ein
  **zweiter vollständiger Satz** mit eigenem `Record`.
- **Ein Bereichs-Kanon** — die Zuordnung `Bereich → Icon + Farbe` als eine
  Modulkonstante. Er trägt nur Gegenstandsbereiche (Events, Mitglieder,
  Nachrichten, Aktivität/Beiträge, Kontakte, Kompass, Highlights). Chevron, Menü,
  Glocke und Lupe sind **Bedien**-Symbole ohne Bereich und ohne Bereichsfarbe;
  sie gehören in den Satz, nicht in den Kanon. Ein Kanon, der sie mitträgt,
  müsste ihnen eine Farbe erfinden.

**Bereichsfarben existieren heute nicht — und sind ausdrücklich verboten.**
`src/index.css` trägt eine Blau-Rampe (`--color-blue-50` … `--color-blue-950`),
Chrome-Token und drei semantische Farben (`success`, `warning`, `danger`). Die
`design-system`-Spec sagt dazu wörtlich: *„Blue SHALL be the only accent family…
SHALL NOT define a second accent, a gold token, or a per-format accent palette"*,
mit einem prüfenden Szenario.

**BREAKING:** Diese Anforderung wird deshalb **ausdrücklich modifiziert**, nicht
umgangen (Donald, 24.08.). Die Grenze verläuft künftig zwischen zwei Aufgaben von
Farbe: der **interaktive** Akzent bleibt Blau, allein und ohne Ausnahme; eine
zweite Familie darf ausschließlich einen **Gegenstandsbereich identifizieren**
und erscheint nie an Link, Knopf, Fokusring oder aktivem Zustand.

Die Bereichs-Tokens werden **einmal** definiert, nicht je Theme: sie sind
Inhaltsschicht, und für die verlangt dieselbe Anforderung identische Werte in
beiden Themes — der navy-Block überschreibt absichtlich nur Chrome.

Farbe SHALL nirgends allein eine Bedeutung tragen — sie steht immer neben Icon
oder Wort.

**Die vier Karten aus dem Issue sind Konzept-Beschriftungen, nicht unsere.**
`MemberDashboard.tsx` trägt „Neu in der Aktivität", „Neue Mitglieder für dich"
und „Deine nächsten Schritte" (drei Kacheln). Eine Karte „Neue Nachrichten" gibt
es dort nicht. Der Kanon wird auf die Flächen angewendet, die **existieren**; ob
das Dashboard neue Karten bekommt, ist nicht Teil dieses Changes.

### Feed

- Der Composer wandert in die linke Spalte. Heute rendert `CommunityFeed.tsx:156`
  ihn **vor** dem Raster, deshalb liegt er über Feed und Sidebar; die Sidebar
  beginnt dadurch tiefer als der Feed.
- Die Medientyp-Zeile bekommt Icons aus dem Kanon. **Bild und Video-Link gibt es
  bereits** — der Screenshot zeigt den Composer zugeklappt, der Abstand ist
  kleiner, als das Bild vermuten lässt. Neu ist hier nur die Beschriftung mit
  Symbolen; „Event" und „Umfrage" bleiben diesem Change fern (Event ist
  systemverwaltet, Umfrage ist Change B).
- **Drei Reiter**: „Alle Beiträge", „Beiträge von mir", „Gespeichert".
  `fetchFeed({ autorId })` trägt den mittleren bereits.
- **Sortierung mit Umschalter**, einschließlich „Beliebteste" — siehe unten, das
  ist der teuerste Teil dieses Changes.

### Speichern

Neu: `post_saves (profile_id, post_id, created_at)`, Primärschlüssel über beide
Spalten. RLS: jeder liest und schreibt **nur eigene** Zeilen — wer etwas
speichert, geht niemanden etwas an. Grants werden ausgesprochen (AGE-312: neue
Tabellen erben hier nichts), und der Golden-Snapshot in `grants_test.sql` wird
mitgepflegt, sonst kippt der CI-Job `migrations` (AGE-455).

Ein gespeicherter Beitrag, der später unsichtbar wird — entfernter Autor,
zurückgedrehte Sichtbarkeit —, SHALL den Reiter nicht brechen: er verschwindet
aus der Liste, statt einen Fehler zu erzeugen.

### Sidebar

Beliebte Tags mit Zählern, aktivste Mitglieder, Filter nach Beitragstyp, und die
Tags als Auswahlkästchen statt als Chips.

- Beide Aggregate laufen **unter der RLS des Aufrufers** (`security invoker`) und
  kopieren das Sichtbarkeitsprädikat ausdrücklich **nicht**. Eine Zahl über
  Beiträge, die der Betrachter nicht sehen darf, verrät genau diese Beiträge —
  und unter `invoker` stimmt sie, weil die Regel wirkt, statt weil eine Abschrift
  sie nachspricht. Das Repo führt das Prädikat bereits an drei Stellen; eine
  vierte und fünfte Kopie wären Aufwand für ein Ergebnis, das ohne sie schon
  richtig ist.
- Gezählt wird über die **aktiven kuratierten Tags** aus `public.tags`, nicht über
  `unnest(posts.hashtags)` — sonst erschienen freie und stillgelegte Schlagworte.
- „Aktivste Mitglieder" zeigt **fünf** Namen, gezählt nach **Beiträgen**, und es
  gilt `profiles_public`: kein zurückgezogenes, unbestätigtes, deaktiviertes oder
  gelöschtes Profil.
- **Auswahlkästchen sind nicht Optik.** Sie versprechen Mehrfachauswahl. Der
  Filter ist heute `.contains("hashtags", [tag])` — das ist **UND** und liefert
  bei zwei Haken fast immer nichts. Entschieden (Donald, 24.08.): **ODER**, also
  `.overlaps()`.
- Beitragstyp: Video gibt es (`nurVideos`), Event über `posts.kind`, **Bild**
  braucht eine Abfrage über `post_media`.
- Heute verschwindet die ganze Spalte bei null Tags (`TagFilter` gibt `null`
  zurück). Die gefüllte Sidebar SHALL das nicht erben.

### Ohne Sitzung bleibt die Seite ein Schaufenster

`/aktivitaet` ist **ohne Anmeldung erreichbar** — der Navigationseintrag trägt
weder `requiresAuth` noch eine Mindeststufe, und `ActivationGate` gibt bei
`!user` durch. Ohne Sitzung gibt es deshalb nur „Alle Beiträge", keinen
Speichern-Knopf und keine Mitgliedernamen; `profiles_public` hält für `anon`
ohnehin kein Recht.

### **BREAKING**: `authenticated` verliert UPDATE auf `post_likes`

Ohne diesen Entzug ist der Beliebtheitszähler eine Behauptung. `likes_write_own`
ist `for all` auf die eigene Zeile, ihr `with check` verlangt vom Zielbeitrag
nur, dass er **existiert**, und das Grant erlaubt UPDATE. Wer seine Reaktion von
Beitrag A auf B umschreibt und dann zurücknimmt, lässt A dauerhaft zu hoch
stehen und treibt B ins Negative — beliebig oft, auf einem Beitrag, den er nicht
einmal sehen muss.

Eine Reaktion hat keinen Änderungsfall: sie entsteht und sie vergeht. Der Client
schreibt `post_likes` nur per `upsert` und `delete`; das Recht ist schon heute
unbenutzt.

### **BREAKING**: Das UPDATE-Recht auf `posts` wird auf Spalten eingeschränkt

Nötig geworden durch „Beliebteste". Die Zahlen kommen heute aus
`post_engagement_counts(uuid[])`, einer `security definer`-RPC, die **nach** dem
Blättern über die IDs der geladenen Seite läuft. Nach etwas zu sortieren, das
erst nach dem Blättern existiert, geht nicht — der Zähler muss materialisiert
werden.

Und genau dort sitzt ein Loch: `grant select, insert, update, delete on
public.posts to authenticated` ist **tabellenweit**, und `posts_write_own` ist
`for all` auf `author_id = auth.uid()`. Eine Zählerspalte auf `posts` wäre damit
**vom Autor selbst per SQL fälschbar**. Heute ist das folgenlos, weil es die
Spalte nicht gibt; mit ihr wäre die Sortierung eine Einladung.

Das UPDATE-Recht wird deshalb auf die vom Client beschreibbaren Spalten
eingeschränkt — derselbe Weg, den `profiles` schon geht. Der Golden-Snapshot §2
in `grants_test.sql` bekommt dadurch eine `posts.UPDATE=…`-Zeile.

## Capabilities

### New Capabilities

Keine. Speichern und Sidebar sind Verhalten des Feeds, nicht ein eigener
Gegenstandsbereich; ein eigener Spec-Ordner dafür würde eine Grenze behaupten,
die es nicht gibt.

### Modified Capabilities

- `community-feed`: Reiter und Sortierung (einschließlich einer zweiten und
  dritten Ordnung mit eigenem Keyset-Pfad), gespeicherte Beiträge als neue
  Tabelle mit eigener RLS, Mehrfachauswahl beim Tag-Filter (UND → **ODER**),
  Filter nach Beitragstyp, sichtbarkeitstreue Aggregate für Tag-Zähler und
  aktivste Mitglieder, Spalten-Einschränkung des UPDATE-Rechts auf `posts`,
  Composer in der Feed-Spalte.
- `design-system`: ein Icon-Satz als einzige Quelle für wiederverwendbare
  Glyphen, darauf ein Bereichs-Kanon `Bereich → Icon + Farbe` — und die
  **Modifikation** der Anforderung „Blue SHALL be the only accent family", die
  eine Bereichsfamilie heute ausdrücklich verbietet.

## Impact

**Datenbank** — neue Tabelle `post_saves` samt RLS und Grants; ein
materialisierter Beliebtheitszähler auf `posts` mit gehärtetem Trigger auf
`post_likes`, Index für die neue Ordnung und Nachtrag für den Bestand; Entzug des
UPDATE-Rechts auf `post_likes`; Entzug des INSERT- und Einschränkung des
UPDATE-Rechts auf `posts`; zwei aggregierende `security invoker`-Funktionen für
Tag-Zähler und aktivste Mitglieder.

**Tests, die kippen werden** — `supabase/tests/grants_test.sql` an **zwei**
Stellen (§1 Tabellen-Grants durch `post_saves`, `posts` und `post_likes`; §2
Spalten-Grants durch `posts`); `rls_test.sql` um die Policies der neuen Tabelle;
ein pgTAP, das den Verschiebe-Angriff auf `post_likes` nachstellt.

**Frontend** — `src/index.css` (Token-Familie), ein neuer Icon-Satz plus
Kanon-Modul, `NavIcon.tsx`, `AppShell.tsx`, `FeedbackButton.tsx`,
`HeaderSearch.tsx`, `CommunityFeed.tsx`, `MemberDashboard.tsx`,
`mein-bereich/building-blocks.tsx`, `profile/ProfileHero.tsx`,
`matching/CategoryIcon.tsx`, sowie `src/lib/feed.ts` (Cursor, Filter, Reiter).

**Nicht betroffen** — `src/vision/` ist toter Code und wird nicht angefasst; es
verfälscht jede grep-Zählung, die zur Abschätzung dieses Changes gemacht wird.

**Nachgelagert** — Change B (Umfragen) hängt an zwei Ergebnissen dieses Changes:
dem Icon aus dem Kanon für den Composer-Knopf und der Erkenntnis, dass eine
Umfrage ein gewöhnlicher `kind='member'`-Beitrag bleibt.
