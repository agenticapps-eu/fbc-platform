# Verzeichnis: zwei Reiter, Cover auf der Karte, Kompass-Chips raus

Linear: AGE-595

## Why

Drei Beobachtungen an `/mitglieder`, gemeldet am 25.08. mit Screenshot.

**Kontakte haben keine Liste.** Wer eine Kontaktanfrage annimmt, bekommt heute
eine **Zahl** (`NetzwerkWidget contactsCount` auf `/kontakte`) und sonst nichts.
Es gibt in der ganzen Anwendung keine Stelle, die die eigenen Kontakte als
Mitglieder auflistet. Die Annahme einer Anfrage führt damit ins Leere — sie
schaltet Kontaktdaten und Chat frei, aber der Weg zurück zu „mit wem bin ich
eigentlich verbunden" fehlt.

**Die Karte trägt zu viele Marken.** Ein Mitglied mit gepflegtem Kompass zeigt
zehn Chips; seine Karte wird doppelt so hoch wie die der Nachbarn und das
Raster liest sich als Unordnung. Das war der Zweck von AGE-494 und ist als
Absicht richtig — an dieser Stelle trägt es nicht.

**Das Cover fehlt in der Karte.** Das Hintergrundbild ist gepflegt und steht auf
jedem öffentlichen Profil, aber die Galerie zeigt nur den Avatar.

## What Changes

- `/mitglieder` bekommt zwei dauerhaft sichtbare Reiter mit Zählern: „Alle
  Mitglieder" und „Meine Kontakte".
- Die Karte verliert die Kompass-Marken und gewinnt das Cover. Die Branche
  bleibt.
- `search_directory` liefert `cover_url` mit.

## Impact

- `openspec/specs/directory-search/` — eine geänderte, zwei neue Anforderungen
- `supabase/migrations/` — eine Migration, die **zwei** Funktionen neu anlegt:
  `search_directory` und `admin_list_members`. Die Admin-Spec fordert
  Spalten-Parität zwischen beiden; `cover_url` nur in einer bricht sie.
- `supabase/tests/directory_search_test.sql`,
  `supabase/tests/admin_member_list_test.sql`
- `src/components/community/MemberDirectory.tsx`, `src/pages/MitgliederPage.tsx`
- `src/pages/AdminMitgliederPage.tsx` — speist dieselbe `MemberCard`
- `src/lib/directory.ts`, `src/lib/database.types.ts`

## Entscheidungen und ihre Kosten

**Beide Reiter stehen immer** (Donald, 25.08.), obwohl der Auslöser „wenn ich
eine Anfrage angenommen habe" lautete. Ein Reiter ist ein Ort, kein Vorgang;
ein Ort, der erscheint und verschwindet, macht die Navigation unvorhersehbar.
Preis: ein neues Mitglied sieht einen Reiter mit einer Null.

**Gefiltert wird im Client, nicht in der Datenbank.** `search_directory` hat
kein Paging und liefert alle Zeilen; eine zweite Abfrage auf `contact_requests`
genügt. Preis: sobald das Verzeichnis Paging bekommt — und das sollte es
([[listen-immer-mit-paging]]) —, muss der Filter serverseitig nachgezogen
werden. Das ist bewusst aufgeschoben und nicht übersehen.

**Der Rückgabetyp ändert sich, also `drop` + `create`.** `create or replace`
kann den Rückgabetyp einer Funktion nicht ändern (`42P13`). Zweiter, von der
Argumentliste unabhängiger Grund für dieselbe Vorgehensweise wie bei AGE-494.

## Non-goals

- Die Kompass-Kategorien aus Filter oder Profil zu entfernen. Nur die Karte.
- Eine eigene Seite „Meine Kontakte". Der Ort ist das Verzeichnis.
- Paging für das Verzeichnis. Eigener Vorgang, hier nur benannt.
