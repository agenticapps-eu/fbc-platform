# Tasks — Archiv der Neuigkeiten-Fläche (AGE-636)

Reihenfolge: **Datenbank vor Rechnung vor Fläche.** Ein Archiv-Kästchen, das
nirgends hinschreibt, ist eine Attrappe.

## 1. Migration: `release_entry_skips`

- [ ] **RED**: pgTAP — die Tabelle existiert, RLS ist an; ein aktiviertes
      Mitglied **ohne** Adminrolle bekommt beim Lesen null Zeilen und kommt
      weder mit `insert` noch mit `delete` durch (Löschversuch **am Bestand**
      gemessen, nicht am Fehlercode — `try_as()` meldet alles als `DENIED:`).
- [ ] **RED**: pgTAP — ein Admin kann `skipped_by` **nicht** auf eine fremde
      `uuid` setzen; die Policy verlangt `skipped_by = auth.uid()`.
- [ ] **RED**: pgTAP — die Positivkontrolle: derselbe Admin darf anlegen,
      lesen und löschen. Ohne sie belegt jede Verneinung oben nichts.
- [ ] `supabase/migrations/<ts>_release_entry_skips.sql`: `slug` als
      Primärschlüssel, `skipped_by uuid default auth.uid() references
      profiles(id) on delete set null` (nullable — `set null` verlangt es),
      `skipped_at timestamptz not null default now()`. RLS an, drei Policies
      (select/insert/delete) auf `is_activated() and is_admin()`, die
      Insert-Policy zusätzlich auf `skipped_by = auth.uid()`.
- [ ] Grants **ausdrücklich** aussprechen (AGE-312):
      `grant select, insert, delete … to authenticated`.
- [ ] Golden-Snapshot in `supabase/tests/grants_test.sql` mitpflegen — sonst
      bricht der `migrations`-Job, auch ohne dass der Tabellenname dort steht.
- [ ] Testdatei in `ci.yml` eintragen (`supabase test db` ohne Dateiliste lügt).

## 2. Datenschicht

- [ ] `database.types.ts` **von Hand** um die Tabelle ergänzen —
      `supabase gen types` NIE darüberlaufen lassen.
- [ ] **RED**: Test — `fetchUebersprungene` liest `release_entry_skips`;
      `markiereUebersprungen` ruft `.upsert({ slug }, { onConflict: "slug",
      ignoreDuplicates: true })` (nicht `.insert()` — die Klausel ist damit
      nicht ausdrückbar); `holeZurueck` löscht über den Slug.
- [ ] **RED**: Test — `fetchAngekuendigt` fragt **ohne** `range()` ab und
      liest `body` **nicht** mit.
- [ ] Die vier Funktionen in `src/lib/release-notes.ts`.

## 3. Die Rechnung: `teileAuf()`

- [ ] **RED**: Die vier Zusagen von `nochNichtAngekuendigt` ziehen um und
      bleiben grün: Zugestelltes fällt raus, ein **Entwurf** versteckt nichts,
      mehrere Notes summieren sich, ohne Notes ist alles offen.
- [ ] **RED**: die neuen Zusagen — Übersprungenes fällt aus `offen` und steht
      mit Grund `nicht-relevant` im Archiv; trifft beides zu, ist der Grund
      `zugestellt`; decken **zwei** zugestellte Notes denselben Eintrag ab,
      nennt das Archiv die **frühere** (Reihenfolge der Eingabe umgedreht
      gegengeprüft, sonst misst der Test `find()`).
- [ ] `teileAuf()` schreiben, `nochNichtAngekuendigt()` entfernen (danach ohne
      Aufrufer).

## 4. Die Fläche

- [ ] **RED**: Seitentest — ein zweites Kästchen „nicht relevant" je Zeile;
      Klick ruft `markiereUebersprungen` **und** nimmt den Eintrag aus der
      Auswahl (ein vorangehakter Eintrag darf nicht im Entwurf landen).
- [ ] **RED**: Seitentest, der Regressionsfall aus der Fremd-Review —
      **speichern → markieren → zustellen**: der Zustellknopf ist danach
      gesperrt, `stelleZu` wird nicht gerufen.
- [ ] **RED**: Seitentest — scheitert die Markierungs-Abfrage, gibt es weder
      Liste noch Entwurfsknopf (fail-closed, nicht „leer").
- [ ] **RED**: Seitentest — das Archiv beginnt zugeklappt, trägt die Zahl,
      nennt je Zeile den Grund; bei „zugestellt" **Titel der Note und Datum**
      und **keinen** Rückhol-Knopf, bei „nicht relevant" einen.
- [ ] **RED**: Seitentest — schlägt `markiereUebersprungen` fehl, bleibt der
      Eintrag stehen und es erscheint eine Fehlermeldung (kein optimistisches
      Umschalten).
- [ ] `AdminNeuigkeitenPage.tsx`: Kästchen, `<details>`-Archiv, Rückhol-Knopf,
      Abgleich gegen den gespeicherten Stand, Invalidierung nach beiden
      Mutationen, `fetchAngekuendigt` statt `fetchZugestellte`.

## 5. Belege

- [ ] Sichtprobe im laufenden lokalen Stack — markieren, aufklappen,
      zurückholen, neu laden. jsdom sieht `<details>` und Fokuswege nicht.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build`, `supabase test db` mit Dateiliste.
