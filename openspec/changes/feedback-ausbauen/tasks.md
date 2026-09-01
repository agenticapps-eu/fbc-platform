> **Reihenfolge ist hier nicht Geschmack.** Die Datenbank kommt vor der
> Oberfläche, und der Golden-Snapshot kommt im selben Change wie die neue
> Tabelle — sonst steht CI rot und der nächste Leser sucht am falschen Ende.
>
> **Vor dem ersten Code:** Plan-Review nach Schritt 2b des Workflows
> (`openspec-change-review`, ≥2 Prüfer anderer Anbieter, `REVIEWS.md` mit
> signiertem Trailer). Die zwei offenen Fragen aus `design.md` gehören vorher
> zu Donald.

## 0. Vorbedingungen

- [ ] 0.1 Donald die Themenliste vorlegen (Vorschlag: `generell`, `fehler`,
      `bedienung`, `inhalte`, `idee`) und die Frage zum Löschrecht des Admins
      am Bild stellen. Beides steht in `design.md` unter Open Questions.
- [ ] 0.2 `pnpm install --frozen-lockfile` in diesem Worktree — er ist frisch
      und hat noch kein `node_modules`.
- [ ] 0.3 Plan-Review fahren und `REVIEWS.md` ablegen. Ohne signierten Trailer
      zählt sie nicht, auch wenn sie niemanden blockt.

## 1. Themen: Tabelle, Spalte, Bestand

- [ ] 1.1 Migration: `feedback_themes (key text primary key, label text not
      null, sort int not null)` anlegen, mit den abgestimmten Zeilen füllen.
      Grants **ausdrücklich** aussprechen — neue Tabellen erben hier nichts.
- [ ] 1.2 In derselben Migration: `feedback.theme` nullable anlegen, Bestand auf
      `generell` setzen, **dann** `set not null`, dann Fremdschlüssel auf
      `feedback_themes`. Die Reihenfolge ist zwingend; andersherum scheitert es
      an der ersten vorhandenen Zeile.
- [ ] 1.3 RLS für `feedback_themes`: Lesen für `authenticated`. Die Liste ist
      keine Preisgabe, aber sie braucht eine ausgesprochene Policy.
- [ ] 1.4 **`grants_test.sql`-Golden-Snapshot nachziehen.** Die neue Tabelle
      bricht ihn sonst, und der Bruch sieht aus wie ein Rechtefehler.
- [ ] 1.5 pgTAP: ein Thema ausserhalb der Menge wird abgewiesen; der Bestand
      trägt nach der Migration `generell` und keine Zeile trägt `null`.

## 2. Screenshot: Bucket und Policies

- [ ] 2.1 Migration: privater Bucket mit `file_size_limit` und
      `allowed_mime_types`, angelegt mit `on conflict (id) do update` — **nicht**
      `do nothing`, sonst konserviert ein bestehender Bucket falsche
      Einstellungen und der RLS-Test läuft grün dagegen.
- [ ] 2.2 Schreib-Policies nach dem Muster von `post-media`: Präfix je Verfasser
      über `(storage.foldername(name))[1]`, `is_activated()`, je eine für
      insert/update/delete.
- [ ] 2.3 SELECT-Policy: Eigentümer **oder** `public.is_admin()`. Das ist der
      Unterschied zu `post-media` — hier liest jemand, der nicht der Eigentümer
      ist.
- [ ] 2.4 `feedback.screenshot_path` anlegen (nullable — das Bild ist optional).
- [ ] 2.5 pgTAP gegen `storage.objects`, und zwar so, dass er **wirklich Zeilen
      anfasst**: ein drittes Mitglied kommt an ein fremdes Bild nicht heran, der
      Eigentümer und der Admin schon. Ein Fall, der nichts anfasst, tarnt sich
      hier als bestandener RLS-Test.

## 3. Die RPC: abreissen und neu anlegen

- [ ] 3.1 `drop function public.admin_list_feedback(int, int)` — der Rückgabetyp
      **und** die Signatur ändern sich, `create or replace` kann das nicht.
- [ ] 3.2 Neu anlegen mit `p_limit`, `p_offset`, `p_themes text[]`,
      `p_ratings int[]` — **alle vier mit Vorgabewert**, damit
      `admin_list_feedback()` argumentlos auflösbar bleibt. Fünf Zusagen in
      `rls_test.sql` (479, 486, 491, 496, 769) rufen sie so auf.
- [ ] 3.3 Rückgabe um `theme` und `screenshot_path` erweitern.
- [ ] 3.4 Filter als `(p_themes is null or f.theme = any(p_themes))`. **`null`
      heisst „keine Einschränkung", ein leeres Array nicht** — `= any('{}')` ist
      falsch und lieferte im Normalfall eine leere Liste.
- [ ] 3.5 Die Klemmung (1..100, `null` → Vorgabe) und `order by created_at desc,
      id desc` **wörtlich** übernehmen. Beide tragen eine eigene Zusage.
- [ ] 3.6 `revoke ... from public, anon` und `grant ... to authenticated` mit der
      **neuen** Signatur, dazu den Kommentar — der `drop` nimmt beides mit.
- [ ] 3.7 pgTAP: die fünf argumentlosen Zusagen laufen weiter; der Filter greift
      **vor** der Seitengrenze (eine Zeile, die ungefiltert erst auf Seite 2
      läge, steht gefiltert auf Seite 1); ohne Filterargument dieselbe Menge wie
      zuvor; zwei Themen wirken als ODER.

## 4. Die Ausnahme im Zugangsmodell

- [ ] 4.1 `threads_insert` neu deklarieren: die `contact_requests`-Bedingung
      wird `( exists (…) or public.is_admin() )`. `is_activated()` und die
      Teilnehmerprüfung bleiben **unangetastet**.
- [ ] 4.2 `messages_insert` genauso. **Beide, nicht eine** — ein Admin, der ein
      Gespräch anlegen, aber nicht hineinschreiben kann, sieht aus wie ein
      funktionierender Weg und bricht erst beim Absenden.
- [ ] 4.3 Die Vorgängerfassung beider Policies wörtlich in den Migrationskopf,
      damit eine Rücknahme ohne Archäologie möglich ist.
- [ ] 4.4 pgTAP **in beide Richtungen**: Admin darf ohne angenommene
      Kontaktanfrage anlegen und schreiben; ein Nicht-Admin darf es weiterhin
      nicht. Ein Test, der nur die neue Richtung prüft, ließe eine Öffnung für
      alle unbemerkt.
- [ ] 4.5 pgTAP für die Grenzen der Ausnahme: der Admin kann kein Gespräch
      zwischen zwei anderen anlegen, keinen fremden `sender_id` vortäuschen und
      nicht in ein Gespräch schreiben, an dem er nicht beteiligt ist.
- [ ] 4.6 `cso` über den fertigen Diff laufen lassen — dieser Schritt weitet
      eine Zugangszusage.

## 5. Typen und Datenschicht

- [ ] 5.1 `src/types/database.types.ts` **von Hand** nachziehen: neue Tabelle,
      zwei neue Spalten, neue RPC-Signatur. `gen types` NICHT darüberlaufen
      lassen.
- [ ] 5.2 `src/lib/feedback.ts`: Thema und Bild beim Absenden, Upload mit
      **`upsert: false`**, Filterargumente beim Abruf (`null` statt `[]`, wenn
      nichts gewählt ist), signierte URL fürs Anzeigen.
- [ ] 5.3 Tests der Datenschicht: der Upload-Aufruf trägt `upsert: false`; ein
      leerer Filterzustand schickt `null` und nicht `[]`.

## 6. Oberfläche: Abgeben

- [ ] 6.1 `FeedbackButton.tsx`: Themenauswahl aus `feedback_themes`, vorbelegt
      mit „Generell".
- [ ] 6.2 Bildauswahl, optional. Die Grösse wird im Formular geprüft **und** am
      Bucket — die Prüfung im Formular ist Komfort, nicht die Grenze.
- [ ] 6.3 Die bestehende Zusage bleibt: ohne Sterne kein Absenden.
- [ ] 6.4 Die bestehende Zusage bleibt: unterhalb `sm` steht der Knopf im
      Dokumentfluss und schwebt nicht. Nach dem Umbau nachmessen, nicht
      annehmen — das Formular wird höher.

## 7. Oberfläche: Admin

- [ ] 7.1 `AdminFeedbackPage.tsx` in die bestehende `FilterSpalte` setzen
      (**wiederverwenden, nicht nachbauen**).
- [ ] 7.2 Kästchen für Thema und Bewertung, Mehrfachauswahl als ODER. Kein
      Filter heisst alles.
- [ ] 7.3 Der Filterzustand geht an die RPC, nicht an eine Filterung im Browser
      — die Fläche pagiert.
- [ ] 7.4 Ein Filter ohne Treffer sagt „zu dieser Auswahl liegt nichts vor" und
      ist **unterscheidbar** von einem gescheiterten Aufruf. Die bestehende
      Zusage „ein gescheiterter Ladevorgang ist kein leerer Bestand" bleibt.
- [ ] 7.5 Bildanzeige an der Zeile über die signierte URL.
- [ ] 7.6 Knopf „Gespräch öffnen" je Zeile, adressiert über `profile_id` und
      **nicht** über den Anzeigenamen.
- [ ] 7.7 Der Knopf öffnet ein bestehendes Gespräch oder legt genau eines an,
      mit normalisiertem Paar. Kein zweites Gespräch zu einem Paar, das schon
      eines hat.
- [ ] 7.8 Tests: zwei gleichnamige Mitglieder, und der Sprung landet beim
      richtigen.

## 8. Abnahme

- [ ] 8.1 `pnpm lint`, `pnpm typecheck`, `pnpm test` — **Exit-Codes** lesen,
      nicht die Ausgabe.
- [ ] 8.2 `supabase test db` **mit Dateiliste** — ohne sie lügt der Lauf.
- [ ] 8.3 `openspec validate --all` grün.
- [ ] 8.4 Die Änderung im Browser zeigen, nicht nur grüne Tests: Abgeben mit
      Bild und Thema, Filtern über eine Seitengrenze hinweg, Sprung in den Chat.
- [ ] 8.5 Code-Review über den **Diff**, nicht über den Plan.
