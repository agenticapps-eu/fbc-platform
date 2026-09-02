# Aufgaben — Rechte-Matrix: Verzeichnis ab connect, Kontaktanfragen nach Stufe

Linear: AGE-598 · [proposal.md](./proposal.md) · [design.md](./design.md)

**TDD gilt durchgehend: RED vor GREEN.** Bei den RLS-Aufgaben heißt RED ein
pgTAP-Test, der gegen das *heutige* Schema fehlschlägt — nicht einer, der ohne
Sonde durchläuft.

## 1. Fremdreview vor der ersten Codezeile

- [x] 1.1 `openspec validate --all` grün (erledigt beim Anlegen: 32/32) — vor
      dem Review erneut fahren, falls der Delta sich noch ändert. **02.09. nach
      der Überarbeitung erneut gefahren: 32 passed, 0 failed**
- [x] 1.2 `openspec-change-review` mit **≥2 Reviewern anderer Anbieter** über
      den Delta laufen lassen, `REVIEWS.md` schreiben (Trailer nicht vergessen —
      von Hand gezählte Reviews zählen nicht). **gemini + opencode, beide
      REQUEST-CHANGES.** Der Gate-Trailer fehlt bewusst: die Artefakte sind
      nach dem Review geändert worden, der Digest bindet also nicht mehr
- [x] 1.3 Einwände abarbeiten oder begründet zurückweisen; bei Änderungen am
      Delta 1.1 wiederholen. **Sechs Befunde, fünf übernommen, einer begründet
      zurückgewiesen** — Resolution-Tabelle in `REVIEWS.md`
- [x] 1.4 `cso` über den Delta: beide Änderungen sind Rechte-Änderungen.
      **Gefahren am 02.09., gescopt auf den Delta statt aufs Repo. Vier
      Befunde, alle am laufenden Schema gemessen: 3 × MEDIUM, 1 × LOW, kein
      HIGH und kein CRITICAL.** Bericht:
      `.gstack/security-reports/2026-09-02-170000.json` (nicht eingecheckt,
      `.gstack/` steht in `.gitignore`). Alle vier sind unten eingearbeitet —
      in 3.3, 3c.2, 5.6 und 6.5. Drei Verdächtige haben sich am Code
      **widerlegt** und sind ausdrücklich keine Befunde:
      `p_theme`/`p_offering`/`p_offers`/`p_needs`/`p_competency` sind kein
      Orakel (`offers`, `needs`, `profile_interests` tragen alle `has_level(3)`
      in ihrer SELECT-Policy, gemessen — die Filter liefern für Rang 2 leer,
      genau wie D1 zusagt); `is_contactable` ist `security definer`, das
      Empfänger-Opt-out wirkt also auf fremde Zeilen wirklich und 5.5 misst
      etwas; und das neue Prädikat ist für `authenticated` kein Stufen-Orakel,
      weil `tier` ohnehin in `profiles_public` steht

## 2. Positivkontrollen sichern, bevor irgendetwas wackelt

Diese Gruppe schreibt **keine** neue Funktionalität. Sie stellt sicher, dass ein
Rückschritt auffällt — ohne sie sieht ein Schaden an der Rang-3-Grenze wie ein
Erfolg aus.

- [x] 2.1 Bestehende `rls_test.sql`-Zusagen zur Rang-3-Grenze auf dem lokalen
      Stack fahren und die Zahl der bestandenen Zusagen **notieren**; sie ist
      die Grundlinie

  **Grundlinie, gemessen am 02.09. gegen eine frische Abbildung**
  (`supabase db reset` über alle 120 Migrationen, dann
  `supabase test db supabase/tests/rls_test.sql supabase/tests/directory_search_test.sql`):

  | Datei | bestanden | fehlgeschlagen |
  |---|---|---|
  | `rls_test.sql` | **437** | 0 |
  | `directory_search_test.sql` | **24** | 0 |
  | zusammen | **461** | 0 |

  Die Zusagen, die die **Rang-3-Grenze selbst** tragen — sie sind es, die nach
  3.4 unverändert grün bleiben müssen, und ein Schaden an ihnen sähe ohne diese
  Liste wie ein Erfolg aus:

  | Nr. | Zusage |
  |---|---|
  | rls 6 | Basic sieht Impact im öffentlichen Verzeichnis (`profiles_public`) |
  | rls 7 | **Connect liest KEINE fremde Vollzeile (erweiterte Felder)** |
  | rls 8 | **Discover liest die fremde Vollzeile** |
  | rls 10 | Discover sieht fremde Interessen |
  | rls 12 | Discover sieht fremde Angebote |
  | rls 213 | Discover sieht die fremden Altdaten NICHT — obwohl es die Vollzeile sieht |
  | dir 11 | unterhalb von discover verrät der Kategoriefilter weder Zeilen noch Kategorien |

  **Zwei Vorbehalte, die zur Zahl gehören.** Erstens stand der lokale Stack vor
  dem Lauf verdriftet da — Schema teilweise voraus (die 4-argumentige
  `admin_list_feedback` existierte), Historie elf Zeilen hinterher. Die
  Grundlinie ist deshalb gegen eine **frische** Abbildung gemessen, nicht gegen
  den vorgefundenen Datenträger; Donald hat den `db reset` am 02.09.
  freigegeben. Zweitens ist die lokale CLI **2.111.0**, CI pinnt **2.116.0**
  (AGE-622, rollen-eigene Grants). Für Zeilensichtbarkeit ist das folgenlos,
  für `grants_test.sql` wäre es das nicht — die Datei ist hier bewusst nicht
  Teil der Grundlinie.
- [x] 2.2 ~~**RED**~~ **Gegenprobe**: pgTAP-Zusage, dass ein `discover`-Konto
      `competencies` **gefüllt** aus `search_directory` bekommt — muss heute
      schon grün sein und ist die Gegenprobe, nicht der Fortschritt.
      `directory_search_test.sql` Zusage 25, **grün**
- [x] 2.3 ~~**RED**~~ **Gegenprobe**: pgTAP-Zusage, dass ein `connect`-Konto
      heute nur die **eigene** Zeile aus `search_directory` bekommt —
      dokumentiert den Ist-Zustand, den 3.x umdreht.
      `directory_search_test.sql` Zusage 26, **grün**

  **Das „RED" oben ist durchgestrichen, und zwar mit Absicht.** Die Kopfzeile
  dieser Datei sagt „RED vor GREEN", und für 3.x bis 7.x gilt das. Diese beiden
  sind die Ausnahme: ihr eigener Aufgabentext sagt „muss heute schon grün sein"
  und „dokumentiert den Ist-Zustand". Eine Gegenprobe, die erst rot ist, misst
  nichts. Der Widerspruch stand im Plan und wird hier aufgelöst statt
  stillschweigend in eine Richtung entschieden.

  **Zwei neue Fixtures, weil die Datei die fragliche Stufe gar nicht kannte.**
  Sie kannte `basic` (Egon) und `impact` (Anna, Bea, Dora) — zwischen ihnen
  liegt die Grenze, um die es geht. Neu: **Frida** auf genau `discover`
  (Rang 3) und **Gero** auf `connect` (Rang 2). Eine Zusage, die bei Rang 6
  hält, sagt über Rang 3 nichts.

  **Und beide sind gesondert gesondiert.** Grün allein belegt hier nichts: eine
  Zusage über eine Stufengrenze ist auch dann grün, wenn sie in Wahrheit die
  Umgebung misst. Probe: in einer Wegwerf-Kopie die beiden Stufen **vertauscht**
  (Frida → `connect`, Gero → `discover`) und den Lauf wiederholt. Ergebnis
  **24 bestanden, 2 fehlgeschlagen — genau 25 und 26, keine andere.** Die zwei
  hängen also an der Stufe und an nichts sonst.

  Grundlinie danach: `rls_test.sql` 437 + `directory_search_test.sql` **26** =
  **463**, `supabase test db` grün.

## 3. Verzeichnisliste ab `connect` (Teil A)

- [x] 3.1 **RED**: pgTAP — `connect`-Konto erhält die Basisfelder **aller**
      öffentlichen Profile aktivierter Eigentümer aus `search_directory`.
      `directory_search_test.sql` Zusage 27, **rot**: `have: Gero`,
      `want: Anna,Bea,Dora,Egon,Frida,Gero`
- [x] 3.2 **RED**: pgTAP — dasselbe `connect`-Konto erhält für **fremde** Zeilen
      `competencies`, `offer_categories`, `need_categories` als leere Arrays und
      `has_offers`/`has_needs` false; für die **eigene** Zeile gefüllt.
      Zusage 28 (fremd), **rot**: `have: (leer)`,
      `want: {} | false | {} | false | {}`. Zusage 29 (eigen) steht **grün** und
      muss es bleiben — ohne sie wäre 28 auch von einer Funktion erfüllt, die
      die Spalten für jeden leert, und die hätte die Rang-3-Grenze nicht
      gewahrt, sondern abgeschafft
- [x] 3.3 ~~**RED**~~ **Gegenprobe**: pgTAP — ein `basic`-Konto erhält
      **genau** die eigene Zeile aus `search_directory`. Zusage 30, **grün**

  **Aus „höchstens" ist „genau" geworden, und das ist ein Befund, kein
  Formulierungsgeschmack.** „Höchstens die eigene Zeile" liesse null Zeilen zu,
  und ein blosses `has_level(2)` als Eintrittstor lieferte genau die. Das wäre
  ein stiller Bruch: **`HeaderSearch.tsx` verlässt sich ausdrücklich auf den
  Selbst-Zweig** — im Kopf der Datei, Punkt 2, seit AGE-540: „die Policy gibt
  einem Konto unterhalb `discover` die EIGENE Zeile zurück, und die ist ein
  gültiger Treffer." Ein `basic`-Konto fände nach einem harten Rang-2-Tor in
  der Kopfzeilen-Suche nicht einmal mehr das eigene Profil, und nichts wäre
  rot geworden.

  **Folge für 3.4:** Das Tor lautet `has_level(2) or p.id = auth.uid()`, nicht
  `has_level(2)`. Die Rangzahl steht weiterhin an genau einer Stelle — der
  Selbst-Zweig trägt keine.

  **Und die Zusage gilt der RPC, nicht den Daten.** Dieselben Basisfelder holt
  dasselbe Konto mit einem Aufruf auf `profiles_public` (gemessen —
  `security_invoker=off`, keine Stufenbedingung, `grant select` für
  `authenticated`; `rls_test.sql` Zusage 6 sagt es zu). Wer 3.3 als Datengrenze
  liest, liest sie falsch — siehe den Zusatz in D1
- [x] 3.4 **GREEN**: Migration — `search_directory` neu: Eintrittstor bei Rang 2
      **plus Selbst-Zweig** (siehe 3.3),
      Basisfelder aus `profiles_public`, erweiterte Spalten weiterhin aus
      `public.profiles` unter der unveränderten Rang-3-Policy. Die Zahl `3`
      SHALL im neuen Rumpf **nicht** vorkommen.
      **`supabase/migrations/20260902150000_verzeichnis_ab_connect.sql`** —
      eine Migration für 3.4, 3b.4 und 3c.2 zusammen. Drei getrennte ergäben
      zwei Zwischenzustände, die niemand haben will und die trotzdem in der
      Historie stünden: ohne 3b wäre die Maskierung Kulisse, ohne 3c fiele
      `branche` still auf NULL
- [x] 3.5 Prüfen, dass die Migration `profiles_select_self_or_discover`
      **nicht** anfasst — `grep` über den Migrationsrumpf, nicht aus dem
      Gedächtnis. **Ein einziger Treffer, und der steht in einem Kommentar
      (Zeile 23).** Dazu gegengeprüft: keine `create/drop/alter policy`- und
      keine `alter table`-Anweisung in der Datei

  **Die Zahl `3` ist am ARTEFAKT geprüft, nicht an der Eingabe.** Ein `grep`
  über die Migrationsdatei fände die Ziffer fünfmal — jedes Mal in einem
  Kommentar. Gemessen wurde deshalb der Katalog:
  `regexp_replace(prosrc, '--[^\n]*', '', 'g') ~ '3'` über `pg_proc` →
  **keine Ziffer 3 im Rumpf.** Die Datei ist die Eingabe, die Funktion ist das
  Ausgelieferte, und nur das zweite zählt

- [x] 3.6 2.2 erneut fahren: muss **weiterhin grün** sein. **Zusage 25 grün** —
      und der eigentliche Beleg steht daneben: **`rls_test.sql` steht
      unverändert bei 437/437.** Das ist die Grundlinie aus 2.1, und sie ist
      der Beweis, dass die neue Rang-2-Schwelle die alte Rang-3-Grenze nicht
      mitgenommen hat
- [x] 3.7 `src/config/nav.ts:95` — `minTier` von `discover` auf `connect`, mit
      Begründung im Kommentar daneben. Erledigt, Zeile 105
- [x] 3.8 Test für 3.7: `/mitglieder` trägt `minTier: "connect"`.
      `nav.test.ts` umgestellt (RED → GREEN belegt).

  **Dabei fielen zwei Frontend-Zusagen, die der Plan nicht genannt hat.**
  `MembershipGate.test.tsx` prüft die Wand über ihre Überschrift, und die
  lautet jetzt „Dieser Bereich ist ab **Connect** verfügbar". Zwei Zusagen rot,
  eine dritte (`queryByRole ... not.toBeInTheDocument`) wäre still grün
  geblieben — aus dem falschen Grund. Alle drei nachgezogen.

  **Und eine Zusage neu, die es vorher nicht geben konnte:** „lässt Connect das
  Verzeichnis sehen". Sonde: `minTier` versuchsweise auf `discover`
  zurückgesetzt → **3 rot, darunter die neue.** Sie hängt an der Schwelle und
  nicht an der Umgebung

## 3b. Das Volltext-Orakel schliessen (Befund opencode HIGH-1)

Ohne diese Gruppe macht 3.x aus der Maskierung eine Kulisse: die Spalte wäre
verborgen und über das Suchfeld erfragbar.

- [ ] 3b.1 **RED**: pgTAP — ein `connect`-Konto sucht einen Begriff, der **nur**
      in `competencies` oder `interests` eines fremden Profils vorkommt, und
      findet die Zeile **nicht**
- [ ] 3b.2 **RED**: pgTAP — dasselbe Konto findet dieselbe Zeile über
      Firmenname, Region oder Branche sehr wohl
- [ ] 3b.3 **RED**: pgTAP — ein `discover`-Konto findet den Kompetenz-Begriff
      weiterhin. Positivkontrolle: die Bindung darf die Suche für Berechtigte
      nicht verengen
- [x] 3b.4 **GREEN**: zweiter tsvector — **`name`, `company`, `branche`,
      `short_bio`, `roles`.** Zwei Abweichungen von der Liste im Entwurf, beide
      aus einer Regel: **der Basis-Vektor muss eine Teilmenge von `search_doc`
      sein.** `roles` kommt dazu (steht in `profiles_public` *und* in
      `search_doc` — es wegzulassen machte ein sichtbares Feld unauffindbar,
      dieselbe Klasse wie HIGH-2 für `branche`); `region` fällt weg (steht in
      `profiles_public`, aber **nicht** in `search_doc` — aufgenommen könnte
      `connect` nach der Region suchen und `discover` nicht, die niedrigere
      Stufe bekäme eine Fähigkeit, die der höheren fehlt). Als Zusage 36
      festgehalten, nicht als Kommentar.

  **Die Bindung kommt ohne Rangzahl aus** und nutzt dieselbe Asymmetrie wie die
  Spaltenmaskierung: `coalesce(p.search_doc, <Basis-Vektor aus pp>) @@ …`. Ab
  Rang 3 ist `p.search_doc` da und gilt; darunter ist es NULL und der
  Basis-Vektor übernimmt. Kein `case`, kein `has_level(3)`, keine zweite Kopie
  der Grenze.

  **Bewusst inline statt als generierte Spalte mit GIN-Index.** Bei 74 Profilen
  folgenlos, und den indizierten Weg über `search_doc` nimmt weiterhin jeder ab
  Rang 3. Die Schwelle, ab der das falsch wird, ist dieselbe, die
  `src/lib/directory.ts` für die Kontaktliste benennt: das Paging
- [x] 3b.5 Prüfen, dass `search_doc` selbst **unverändert** bleibt — es bedient
      weiterhin Rang 3 und die Kopfzeilen-Suche. **Keine `generated`-,
      `alter table`- oder `fbc_profile_search_doc`-Anweisung in der Migration**
      (gegengeprüft). Zusage 33 belegt die Wirkung: `discover` findet den
      Kompetenz-Begriff weiterhin

## 3c. `branche` wird Basisfeld (Befund opencode HIGH-2)

- [ ] 3c.1 **RED**: pgTAP — ein `connect`-Konto bekommt `branche` **gefüllt**
      aus `search_directory`, und `p_branche` filtert für es korrekt
- [x] 3c.2 **GREEN**: `branche` in `profiles_public` aufgenommen — **als letzte
      Spalte, hinter `cover_url`**, Grants erneut ausgesprochen. Dazu
      `src/lib/database.types.ts` nachgezogen: die Datei ist handgepflegt,
      `gen types` darf nicht darüberlaufen
- [x] 3c.3 Gegenprobe: die View gibt weiterhin **keine** erweiterten Felder her.
      Am Katalog gemessen — `profiles_public` trägt genau
      `id, name, avatar_url, region, company, short_bio, tier, roles,
      cover_url, branche`. Kein `competencies`, kein `has_offers`/`has_needs`,
      keine Kategorien, kein `headline`, keine `interests`
- [x] 3c.4 Die Spalten-Aufzählung im Delta gegen den tatsächlichen
      Rückgabetyp von `search_directory` abgleichen — **jede** Spalte ist
      entweder Basis oder erweitert, keine ohne Zuordnung. **15 Spalten,
      15 zugeordnet:**

  | Herkunft | Spalten |
  |---|---|
  | **Basis** — aus `profiles_public` (10) | `id` · `name` · `avatar_url` · `cover_url` · `region` · `company` · `short_bio` · `branche` · `tier` · `roles` |
  | **Erweitert** — aus `public.profiles` / `offers` / `needs` unter Rang 3 (5) | `competencies` · `has_offers` · `has_needs` · `offer_categories` · `need_categories` |

## 4. Filter, die ein `connect`-Konto nicht bedienen kann

Entschieden in D5: sie werden **ausgeblendet**, nicht leer laufen gelassen.

- [x] 4.1 **RED**: Frontend-Test — ein `connect`-Konto sieht die Filter für
      Kompetenz, Biete-/Suche-Kategorien, Thema und Angebotsart **gar nicht**
- [x] 4.2 **RED**: Frontend-Test — an ihrer Stelle steht ein Hinweis, ab welcher
      Stufe es sie gibt; das Ausblenden allein wäre ein zweites Verschweigen
- [x] 4.3 **RED**: Frontend-Test — der Branchenfilter bleibt für `connect`
      sichtbar und funktionsfähig (er filtert nach 3c auf einem Basisfeld)
- [x] 4.4 **GREEN**: umsetzen. Die drei Leerzustände aus `directory-search`
      („Fehler" · „Stufe zu niedrig" · „echter Nulltreffer") bleiben
      unterscheidbar und unberührt

## 5. Gestaffelte Kontaktanfragen (Teil B)

- [x] 5.1 **RED**: pgTAP für das Prädikat `darf_kontaktanfrage_senden(uuid)` —
      über **alle sechs** Absenderstufen gegen mindestens `connect` und
      `impact` als Ziel. Ein Test gegen nur `basic` und `discover` sieht die
      `connect`→`connect`-Regel nicht
- [x] 5.2 **GREEN**: Migration — Prädikat anlegen (`stable`,
      `security definer`, `set search_path = ''`), `revoke` von `public`/`anon`,
      `grant execute` an `authenticated` **ausdrücklich** (neue Funktionen
      erben nichts)
- [x] 5.3 **RED**: pgTAP — `cr_insert_self` lehnt bei `open_contact = false` die
      Anfrage eines `basic`-Kontos ab und lässt `connect`→`connect` durch
- [x] 5.4 **GREEN**: `cr_insert_self` neu setzen — Klausel 320 wird
      `( is_contact_open() or darf_kontaktanfrage_senden(to_id) )`
- [x] 5.5 **RED**: pgTAP — die vier unverändert geltenden Zusagen
      (Selbst-`from_id`, `pending`, `match_id`-Paarbindung, `is_contactable`)
      halten in **beiden** Schalterstellungen
- [x] 5.6 `grants_test.sql` **Abschnitt 6 muss unverändert grün bleiben** —
      die Liste wird *nicht* angefasst. Sie zählt abschliessend auf, welche
      Funktionen `anon` ausführen darf, und eine neue Funktion erbt EXECUTE
      über PUBLIC (der Test sagt das in seinem eigenen Kopf, Zeile 262). Wird
      5.2 richtig gemacht, bricht Abschnitt 6 **gar nicht**. Bricht er, ist
      **das** der Befund: der `revoke ... from public, anon` aus 5.2 fehlt.
      `darf_kontaktanfrage_senden` in die Golden-Liste einzutragen wäre die
      falsche Reparatur — sie erteilte einem ausgeloggten Aufrufer dauerhaft
      EXECUTE auf ein `security definer`-Prädikat, das `profiles.tier` fremder
      UUIDs liest. `anon` hält auf `profiles_public` kein SELECT (gemessen),
      das wäre also ein neuer Weg und kein bestehender

## 6. Welpenschutz entfernen

Entschieden von Donald am 02.09.: ersatzlos. Grundlage ist die Messung in 6b.

- [x] 6.1 **RED**: pgTAP — eine Kaltanfrage **ohne** `match_id` an ein Konto,
      das am selben Tag registriert wurde, geht durch. Bei `open_contact = true`
      **und** bei `false` (dort mit einem Absender ab Rang 3). Das ist die
      Zusage, die heute nur zufällig gilt, weil das Flag offen steht
- [x] 6.2 **GREEN**: Klausel 332 aus `cr_insert_self` **streichen** — nicht
      umbauen, nicht durch einen Schalter ersetzen
- [x] 6.3 **GREEN**: `drop function public.is_new_member(uuid)`. Gemessen genau
      **ein** lebender Aufrufer, und das war Klausel 332
- [x] 6.4 **RED/GREEN**: pgTAP — `public.is_new_member(uuid)` existiert nicht
      mehr. Ohne diese Zusage bliebe der Drop unbelegt
- [x] 6.5 Vorher prüfen, dass kein pgTAP-Bestandstest den Welpenschutz
      **oder die Rang-4-Grenze** zusagt — sonst wird die Änderung an einer
      alten Zusage rot, und das sähe wie ein Fehler aus statt wie die Absicht.
      **Drei sind bereits gefunden und namentlich zu behandeln** (`cso`,
      02.09.):

  | Fundstelle | Was mit ihr geschieht |
  |---|---|
  | `rls_test.sql:260` „Discover kann keine Kontaktanfrage senden (rank < exchange)" | **ERLEDIGT mit 5.4** (umgeschrieben, `is(… , 'OK')`). **Kippte von DENIED auf OK.** Das ist Teil B, nicht der Welpenschutz: Klausel 320 geht von `has_level(4)` auf das Prädikat, und das erlaubt ab Rang 3 jeden Empfänger. Muss umgeschrieben werden, und zwar als das, was sie ist — eine **Erweiterung** |
  | `rls_test.sql:268` „Ein neues Mitglied ist in den ersten 30 Tagen nicht KALT kontaktierbar" | **ERLEDIGT mit 6.2**: gestrichen. Kippte auf OK. Nachfolge ist `kontaktanfrage_staffelung_test.sql` §3c, die das Gegenteil zusagt |
  | `rls_test.sql:272` „Über ein Match ist dasselbe neue Mitglied erreichbar" | **ERLEDIGT mit 6.2**: gestrichen. Sie wurde beim Messen sogar ROT — die Vorgängerzusage legt jetzt dieselbe Zeile an und das Unique-Paar ist verbraucht. Die Paarbindung steht in `kontaktanfrage_staffelung_test.sql` §3. Ursprüngliche Diagnose: bleibt grün — **aber nicht mehr aus ihrem Grund.** `exchange` darf nach der Streichung ohnehin senden, das `match_id` belegt nichts mehr. Eine Zusage, die aus dem falschen Grund hält, ist schlimmer als eine rote |
- [x] 6.6 Gegenprobe, dass 5.x weiterhin grün ist: die Staffelung darf durch das
      Streichen weder schärfer noch weicher geworden sein

## 6b. Das Alter des Bestands messen — erledigt, und es hat 6. entschieden

- [x] 6b.1 Auf PROD gelesen (02.09., Supabase-MCP, read-only): **alle 74
      Profile jünger als 30 Tage.** 05.08. → 2 · 16.08. → 69 · 24.08. → 1 ·
      25.08. → 2. `open_contact` steht auf `true`, es gibt 56 Übereinstimmungen
      gegen 2.701 mögliche Paare — rund 2 % Durchlass
- [x] 6b.2 Ergebnis als Zahlen im Entwurf, unter „Risks" — keine Namen, das
      Repository ist öffentlich
- [x] 6b.3 Donald vorgelegt (02.09.). **Ergebnis: der Welpenschutz geht ganz.**
      Eine Regel, die man wegen ihrer eigenen Wirkung nie einschalten kann, ist
      keine Regel. Damit entfallen der zweite Schalter, die Frage nach seiner
      Vorgabe und die Frage nach dem richtigen Datum für `is_new_member`
- [x] 6b.4 Nebenbefund, ebenfalls gemessen: **73 × `impact`, 1 × `discover`,
      0 × `connect`, 0 × `basic`.** Alle Konten liegen auf Rang 3 oder darüber,
      für die die Staffelung jeden Empfänger erlaubt — `open_contact` auf
      `false` zu setzen ist damit heute **folgenlos**

## 7. Oberfläche der Kontaktanfrage

- [x] 7.1 **RED**: Test — ein Konto, das nach der Staffelung nicht senden darf,
      bekommt eine benannte Begründung statt eines rohen `42501`.
      `PublicProfilePage.staffelung.test.tsx`, fünf Zusagen. **Zwei Ziel-Stufen**,
      weil die `connect`→`connect`-Regel sonst nie gemessen würde
- [x] 7.2 **GREEN**: umsetzen in `src/lib/contact-requests.ts`
      (`darfKontaktanfrageSenden`) und in `PublicProfilePage.tsx`. Die
      Begründung steht **an der Stelle des Knopfes**, nicht in einem Toast: eine
      Hürde, die man erst nach dem Klicken erfährt, ist zweimal enttäuschend.
      Zwei Sätze, nicht einer — `basic` kann niemanden anschreiben, `connect`
      kann es schon, nur nicht dieses Profil
- [x] 7.3 **GEGENSTANDSLOS GEWORDEN, und dabei eine Altlast gefunden.** Es gibt
      keine Welpenschutz-Ablehnung mehr — Aufgabe 6.2 hat die Klausel
      gestrichen. Die Aufgabe war beim Planen richtig und ist es durch D3 nicht
      mehr.

      Was stattdessen zu tun war: die **bestehende** `42501`-Meldung nannte den
      Welpenschutz („an neue Mitglieder nur über ein gemeinsames Match") und
      erklärte damit eine abgeschaffte Regel — sie schickte den Leser auf einen
      Weg, den es nicht gibt. Sie nennt jetzt den einzigen lebenden Grund, der
      an dieser Stelle übrig bleibt: das Opt-out des Empfängers. Die
      Bestandszusage in `PublicProfilePage.test.tsx` ist mit umgeschrieben

## 8. Abnahme

- [x] 8.1 `pnpm lint` — Exit-Code **0** (7 Warnungen, alle Bestand)
- [x] 8.2 `pnpm typecheck` — Exit-Code **0**
- [x] 8.3 `pnpm test` — **2473/2473**
- [x] 8.4 `pnpm build` — Exit-Code **0**. **Achtung:** der Build schreibt
      `src/content/release-entries.generated.ts` unformatiert um. Zurückgenommen,
      der Arbeitsbaum ist sauber
- [x] 8.5 `supabase test db` mit der Dateiliste aus `ci.yml` (27 Dateien) —
      **1160/1160**. Die neue Datei steht in der Liste, sonst liefe sie nie
- [x] 8.6 `openspec validate --all` — 32 passed, 0 failed. Und der Delta-Spec
      **gegengelesen**: er beschreibt, was gebaut wurde (Validate prüft nur die
      Form)
- [x] 8.7 `requesting-code-review` auf den **Diff**, nicht auf den Plan.
      Ausgeschrieben in `REVIEWS.md`, Abschnitt „Diff-Review".
      **`opencode`: VERDICT Freigabe**, drei NIEDRIG-Befunde — einer
      reproduziert nicht (kein erweiterter Filter kommt aus der Adresszeile,
      `DIRECTORY_QUERY_PARAM` ist `"q"`), zwei sind Entscheidungen, die im
      Migrationskopf stehen (§5, §6). Er hat selbst gemessen: Katalog,
      `pg_get_expr(polwithcheck)` gegen den Vorstand, Impersonation, vitest.
      **`gemini`: beide Befunde am Repo widerlegt** — Belege erfunden (eine
      Datei `supabase/tests/database/…`, die es nicht gibt; `is_empty` kommt in
      `directory_search_test.sql` **null**mal vor; `search_doc` wird aus `p`
      gelesen, nicht aus `pp`)
- [x] 8.8 `qa` auf der Verzeichnis-Fläche mit einem `connect`-Konto, gegen den
      **lokalen** Stack (die Migrationen sind nicht auf DEV). Belegt: die Liste
      steht, Branche und Region sind gefüllt und filtern, die vier maskierten
      Filter fehlen, der Hinweis steht da. Kontaktfläche: `connect`→`connect`
      **wirklich gesendet** (Zeile in `contact_requests`, `match_id` NULL, Ziel
      tagesfrisch, `open_contact = false` — das belegt Staffelung UND
      gestrichenen Welpenschutz in einem), `connect`→`impact` von der Policy
      abgewiesen. Umgebung vollständig zurückgebaut
- [x] 8.9 `verification-before-completion` — jede Zahl oben stammt aus einem
      Lauf in dieser Sitzung, nicht aus einer Erwartung. Zusätzlich zwei
      Gegenproben gefahren: die Bremse aus `8bbae86` herausgenommen (genau die
      eine neue Zusage wurde rot), und `connect`→`impact` als Sonde gegen die
      laufende Policy (abgewiesen mit der RLS-Meldung)

## 9. Ausrollen — getrennt und ausdrücklich

- [ ] 9.1 PR, CI grün abwarten, mergen
- [ ] 9.2 `migrate-dev` grün auf demselben SHA
- [ ] 9.3 `migrate-prod` **ausdrücklich erfragen** — Schreibzugriff auf PROD
- [ ] 9.4 Frontend-Deploy; auf `drift-gate` achten, der ihn stumm anhält
- [ ] 9.5 Live nachmessen: ein `connect`-Konto sieht das Verzeichnis, seine
      erweiterten Spalten sind leer
- [ ] 9.6 **Kein Flag umlegen.** Weder `open_contact` noch
      `welpenschutz_aktiv`. Beides sind Donalds Schritte und gehören nicht in
      diesen Change
- [ ] 9.7 Live gegenprüfen, dass eine Kaltanfrage an ein junges Konto **weiter
      durchgeht** — die Zusage aus 6.1 am laufenden System, nicht nur in pgTAP

## 10. Nachlauf

- [ ] 10.1 `openspec archive rechte-matrix-stufen` — beide Delta-Specs falten
- [ ] 10.2 `pnpm release:entries`, danach den **Diff** von
      `release-entries.generated.ts` lesen: beschreiben die `aenderungen`, was
      gebaut wurde? Die Ausschlüsse dürfen nicht als das Ausgelieferte dastehen
- [ ] 10.3 Im Neuigkeiten-Eintrag steht die **Verzeichnisschwelle** — sie ist
      das einzige sofort Spürbare, und sie gibt Rechte. Der Welpenschutz gehört
      **nicht** hinein: er wartet auf seinen Schalter und ändert am Tag des
      Ausrollens nichts
- [ ] 10.4 AGE-598 in Linear nachsehen; der Merge setzt den Status selbst
- [ ] 10.5 AGE-610 Abnahmepunkt „AGE-598 entschieden" abhaken
