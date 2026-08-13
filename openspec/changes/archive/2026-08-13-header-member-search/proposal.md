## Why

Das Suchfeld in der Kopfzeile (`AppShell.tsx:407-419`) ist ein nacktes
`<input type="search">` — ohne `value`, ohne `onChange`, ohne Formular. Es nimmt
Eingaben entgegen und tut nichts.

Ein prominentes Suchfeld, das nichts tut, ist schlimmer als keins: es ist das
Erste, was viele ausprobieren. Ab dem 17.08. stehen 70 echte Mitglieder in der
Datenbank, mit Namen, Firma, Beruf und Kurzbeschreibung — ohne Suche findet man
sie nur über Filter im Verzeichnis.

Entscheidung Donald: **einbauen, nicht entfernen.**

## What Changes

Bewusst rudimentär. Die Volltextsuche existiert bereits — `profiles.search_doc`
mit GIN-Index und die RPC `search_directory` mit Facetten, beides vom
Mitgliederverzeichnis genutzt. Die Kopfzeilen-Suche erfindet nichts Neues; sie
ist ein **schneller Weg dorthin**.

- Ab 2 Zeichen, entprellt (300 ms), erscheint ein Dropdown mit den ersten 5
  Treffern: Avatarbild, Name, Berufsbezeichnung.
- Klick auf einen Treffer öffnet dessen Profil.
- Enter oder „Alle Ergebnisse" führt auf `/mitglieder` mit **übernommenem**
  Suchbegriff.
- Vollständig mit der Tastatur bedienbar: ↑ ↓ Enter Escape.
- Auf dem Telefon öffnet ein Lupensymbol die Suche.

**Vier Entscheidungen, die dieser Change festlegt** (Donald, 2026-08-13):

1. **Ausgeloggt entfällt das Feld.** Es steht heute außerhalb des
   `user ? … :`-Zweigs, ein Gast sieht es also. `search_directory` ist
   `SECURITY INVOKER` und für `anon` **nicht ausführbar** (`grant execute … to
   authenticated`, aus `public` widerrufen) — ausgeloggt käme `42501`. Der
   einzige Weg zu einer funktionierenden anon-Suche wäre eine neue, für `anon`
   lesbare `SECURITY DEFINER`-Funktion, also das Verzeichnis im offenen Netz.
   Das ist eine eigene Sicherheitsentscheidung und nicht die Nebenwirkung eines
   Oberflächen-Changes (Geländer: AGE-291).
2. **Unterhalb von `discover` erscheint ein Aufstiegs-Hinweis, kein
   Nulltreffer.** Die Policy ist `id = auth.uid() or has_level(3)`: ein
   eingeloggtes `basic`/`connect`-Konto bekommt keinen Fehler, sondern höchstens
   die **eigene** Zeile. „Keine Mitglieder gefunden" wäre dort schlicht
   unwahr — es gibt Treffer, das Konto darf sie nur nicht sehen.
3. **Das Lupensymbol fürs Telefon gehört dazu.** Nicht als Verkleinerung: der
   Wrapper ist `hidden … sm:block`, unter 640 px wird das Feld heute **gar nicht
   gerendert**. Es fehlt dort, es drängt nicht.
4. **Nur Mitglieder.** Events, Beiträge und Academy mitzudurchsuchen wäre die
   richtige Endausbaustufe, kostet aber eine übergreifende Suche über vier
   Tabellen. Für den Go-Live reicht die Mitgliedersuche.

**Was der Plan-Review hinzugefügt hat.** Beide Reviewer gaben
REQUEST-CHANGES; fünf HIGH-Befunde wurden an der Platte nachgeprüft und
bestätigt. Sie machen den Change nicht größer im Umfang, aber vollständiger im
Vertrag:

5. **Enter unterhalb `discover` führt auf die Aufstiegsseite, nicht ins
   Verzeichnis.** `/mitglieder` liegt hinter `MembershipGate min="discover"`
   (`nav.ts:78`, `App.tsx:31`) — die Verzeichnisoberfläche entsteht dort gar
   nicht, der Begriff verschwände in einer Wand. Das ursprüngliche Versprechen
   war baulich unhaltbar.
6. **Der leere Fall zerfällt in drei Zustände**, nicht zwei: Fehler ·
   Stufe zu niedrig · echter Nulltreffer. Ohne den ersten erschiene ein
   `42501` oder eine abgelaufene Sitzung als „nichts gefunden".
7. **Suchergebnisse werden an die Identität gebunden.** Es gibt **einen**
   globalen `QueryClient` (`main.tsx:14`), der nie geleert wird, und
   `directoryQueryKey` trägt **keine** Nutzerkennung. Als `discover` geholte
   Treffer könnten einem später angemeldeten `basic`-Konto gezeigt werden. Das
   Feld auszublenden genügt nicht.
8. **Das Zustandsmodell der Adresszeile wird ausgeschrieben** — ein Eigentümer,
   kein Zurückschreiben beim Tippen, Übernahme am Navigationsereignis statt am
   bloßen Wert, und beim Aufbau mit Parameter **keine** ungefilterte Erstabfrage.
9. **Escape, Anfangsfokus und Schließen an der Umbruchbreite** gehören
   ausdrücklich in den Vertrag: `useOverlay` sperrt den Scroll und fängt `Tab` —
   **mehr nicht** (`useOverlay.ts:113`).

Zwei stille Annahmen sind dabei zu ausgesprochenen Aussagen geworden: es gibt
**kein Feld für eine Berufsbezeichnung** im Rückgabetyp der RPC (die
Trefferzeile bildet ihre Einordnung aus `company`/`roles`/`branche`/`short_bio`),
und es gibt **kein serverseitiges Limit** — „die ersten fünf" heißt
alphabetisch die ersten fünf aller geladenen Treffer.

**Kein BREAKING**, keine Migration, keine neue RPC.

## Capabilities

### New Capabilities

Keine — die Fähigkeit „Mitglieder suchen" existiert, sie bekommt einen zweiten
Einstieg.

### Modified Capabilities

- `directory-search`: Die Suche bekommt einen globalen Einstieg aus der
  Kopfzeile, mit Regeln für Ausgeloggte, für Konten unterhalb von `discover`,
  für die Übergabe des Suchbegriffs an `/mitglieder` und für die Bedienung mit
  der Tastatur.

## Impact

**Betroffener Code:**

- `src/components/AppShell.tsx` — das tote `<input>` entfällt; `HeaderSearch`
  entsteht **innerhalb** des `user ? … :`-Zweigs, nicht an der Stelle des toten
  Feldes. Ein reines „ersetzen" hätte die Komponente dort gelassen, wo das tote
  Feld steht — außerhalb dieses Zweigs, also für Ausgeloggte sichtbar und im
  Widerspruch zur eigenen Anforderung dieses Changes. Unter `sm` kommt das
  Lupensymbol dazu.
- **neu** `src/components/search/HeaderSearch.tsx` (+ Test) — Eingabe, Entprellung,
  Dropdown, Tastatur, Zustände.
- `src/components/community/MemberDirectory.tsx` — nimmt einen Suchbegriff aus
  der Adresszeile an. **Die riskanteste Stelle des Changes**, siehe design.md:
  `useState(wert)` übernimmt einen Wert nicht, der erst nach dem Mounten
  eintrifft — genau der Fall, wenn man auf `/mitglieder` steht und aus der
  Kopfzeile erneut sucht.
- `src/lib/directory.ts` — eine dünne Funktion für „die ersten N Treffer zu
  einem Begriff" **mit eigenem, nach Konto getrenntem Zwischenspeicher-Schlüssel**;
  die RPC und `filtersToArgs` bleiben unangetastet. Ein gekürztes Ergebnis unter
  `directoryQueryKey` abzulegen vergiftete den Zwischenspeicher des vollen
  Verzeichnisses.

**Nicht betroffen:** keine Migration, keine RPC, keine Policy, keine Edge
Function. Die Sichtbarkeitsgrenze bleibt exakt, wo sie ist.

**Wiederverwendet statt neu gebaut:** `searchDirectory` (`lib/directory.ts`),
die 300-ms-Entprellung nach dem Muster in `MemberDirectory`, `useOverlay`
(AGE-529) für die Telefon-Fassung, `useAuth().levelRank` und `levelLabel` für
den Aufstiegs-Hinweis, `Avatar` und `TierBadge`.

**Sicherheit:** Der Change vergrößert die **Erreichbarkeit** der Suche, nicht
ihre **Preisgabe** — dieselbe RPC, dieselbe RLS, dieselben Zeilen. Das
Aktivierungs-Gate (`20260806080100`) trägt bereits über alle drei Flächen; was
fehlt, ist der Nachweis, nicht die Sperre. Er gehört in die Abnahme.

Mit **einer** Ausnahme, die der Plan-Review gefunden hat: der Zwischenspeicher
ist heute kontenübergreifend. Das ist eine bestehende Lücke (AGE-258, geführt in
`finish-ui-polish`), aber dieser Change legt einen neuen Weg hinein und schließt
sie deshalb **für den hier gebauten Einstieg**. Für das übrige Verzeichnis bleibt
sie offen — benannt, nicht stillschweigend mitgenommen.

**Eigener Nachweis statt geerbter Zusage:** Ein früherer Stand berief sich für
„ausgeloggt findet niemand etwas" auf `anon-anreicherung.test.ts`. Dessen
Positivliste erfasst nur die dort aufgerufenen Lesepfade und **keine
Funktionsaufrufe** — dieser Change bringt seinen eigenen negativen Test mit.
