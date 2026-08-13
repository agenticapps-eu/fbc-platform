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

- `src/components/AppShell.tsx` — das tote `<input>` weicht der neuen
  Komponente; unter `sm` kommt das Lupensymbol dazu.
- **neu** `src/components/search/HeaderSearch.tsx` (+ Test) — Eingabe, Entprellung,
  Dropdown, Tastatur, Zustände.
- `src/components/community/MemberDirectory.tsx` — nimmt einen Suchbegriff aus
  der Adresszeile an. **Die riskanteste Stelle des Changes**, siehe design.md:
  `useState(wert)` übernimmt einen Wert nicht, der erst nach dem Mounten
  eintrifft — genau der Fall, wenn man auf `/mitglieder` steht und aus der
  Kopfzeile erneut sucht.
- `src/lib/directory.ts` — höchstens eine dünne Funktion für „die ersten N
  Treffer zu einem Begriff"; die RPC und `filtersToArgs` bleiben unangetastet.

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
