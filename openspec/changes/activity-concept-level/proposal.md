## Why

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

- **Ein Icon-Satz** — alle Glyphen in einem Stil an einer Stelle. Heute liegen
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

**Bereichsfarben existieren heute nicht.** `src/index.css` trägt eine Blau-Rampe
(`--color-blue-50` … `--color-blue-950`), Chrome-Token und drei semantische Farben
(`success`, `warning`, `danger`) — keine einzige bereichsbezogene. Der Kanon
bringt eine neue Token-Familie mit, die in **beiden** Themes definiert sein muss;
ein Token, das nur im hellen Block steht, ist im dunklen zufällig richtig.

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

- Beide Aggregate SHALL die Sichtbarkeit **mitzählen**. Eine Zahl über Beiträge,
  die der Betrachter nicht sehen darf, verrät genau diese Beiträge.
  `former_member_entries` (20260823160000) macht vor, wie das Prädikat aus
  `posts_select_by_visibility` sauber kopiert und per pgTAP festgehalten wird.
- „Aktivste Mitglieder" zeigt Namen, es gilt also `profiles_public`: kein
  zurückgezogenes, unbestätigtes, deaktiviertes oder gelöschtes Profil.
- **Auswahlkästchen sind nicht Optik.** Sie versprechen Mehrfachauswahl. Der
  Filter ist heute `.contains("hashtags", [tag])` — das ist **UND** und liefert
  bei zwei Haken fast immer nichts. Entschieden (Donald, 24.08.): **ODER**, also
  `.overlaps()`.
- Beitragstyp: Video gibt es (`nurVideos`), Event über `posts.kind`, **Bild**
  braucht eine Abfrage über `post_media`.
- Heute verschwindet die ganze Spalte bei null Tags (`TagFilter` gibt `null`
  zurück). Die gefüllte Sidebar SHALL das nicht erben.

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
- `design-system`: ein Icon-Satz als einzige Quelle, darauf ein Bereichs-Kanon
  `Bereich → Icon + Farbe`, und eine Token-Familie für Bereichsfarben in beiden
  Themes.

## Impact

**Datenbank** — neue Tabelle `post_saves` samt RLS und Grants; ein
materialisierter Beliebtheitszähler auf `posts` mit Trigger auf `post_likes`
und Nachtrag für den Bestand; Einschränkung des UPDATE-Rechts auf `posts`;
aggregierende RPCs für Tag-Zähler und aktivste Mitglieder, beide mit der
kopierten Sichtbarkeitsregel.

**Tests, die kippen werden** — `supabase/tests/grants_test.sql` an **zwei**
Stellen (§1 Tabellen-Grants durch `post_saves`, §2 Spalten-Grants durch `posts`);
`rls_test.sql` um die Policies der neuen Tabelle; pgTAP-Zusagen, die die
Prädikat-Kopien in den neuen RPCs festhalten.

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
