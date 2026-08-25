## 1. Datenbank

- [x] 1.1 Eine Migration, forward-only, mit Kopf: Befund, Entscheidung,
      verworfene Alternative — und ausdrücklich, dass die geteilte Bedingung aus
      1.2 eine **Abschrift ersetzt**, die der Plan-Review als nicht tragfähig
      erwiesen hat
- [x] 1.2 `create function public.member_state_matches(...)` — die
      Zustandsbedingung, wörtlich aus dem heutigen `case p_status` von
      `20260824100000_admin_member_list_ban.sql:128-136`. `immutable`,
      `set search_path = ''`
- [x] 1.3 `create or replace function public.admin_list_members(...)` — **derselbe
      Rumpf**, nur der `case`-Ausdruck durch den Aufruf aus 1.2 ersetzt. Signatur
      und Spaltensatz bleiben Zeichen für Zeichen gleich. **Die Abnahme dieses
      Schritts ist, dass `admin_member_list_test.sql` unverändert grün bleibt** —
      insbesondere die fünf `::regprocedure`-Casts und die Zusage über die genau
      acht Zusatzspalten
- [x] 1.4 `drop function public.admin_list_feedback()`, dann `create` mit
      `p_limit int default 25`, `p_offset int default 0`, **`profile_id` in der
      Rückgabe** und **`order by created_at desc, id desc`**. `security definer`,
      `set search_path = ''`, `where public.is_admin()` bleibt (kein `raise` —
      fünf Zusagen beschreiben genau dieses Verhalten). `p_limit` auf 1..100
      geklemmt, `null` zur Vorgabe
- [x] 1.5 Der zweite Ordnungsschlüssel ist keine Kosmetik: `created_at desc`
      allein ist **keine Gesamtordnung**, und die Feedback-Fixtures entstehen alle
      in derselben Transaktion mit demselben `now()`. Ohne `id desc` kann dieselbe
      Zeile auf Seite 1 **und** Seite 2 stehen. Das gehört als Begründung in den
      Migrationskopf
- [x] 1.6 `create function public.admin_member_counts()` → `(status text, anzahl
      bigint)`, eine Zeile je Zustand **einschliesslich der mit null**, über die
      geteilte Bedingung aus 1.2. `raise` mit `42501` für Nicht-Admins — der
      Unterschied zu 1.4 gehört in den Kopf: eine leere Liste ist eine Antwort,
      eine Zeile Nullen eine Aussage über den Bestand
- [x] 1.7 **Rechte für alle drei neuen Funktionen ausdrücklich aussprechen.** Neue
      Funktionen tragen EXECUTE für `PUBLIC`, solange es niemand entzieht (AGE-312)
- [x] 1.8 Migration lokal anwenden; **prüfen, dass `grants_test.sql` unberührt
      bleibt** — der Golden-Snapshot bricht an neuen Tabellen, nicht an Funktionen.
      Gemessen, nicht angenommen
- [x] 1.9 Typen nachziehen: `src/lib/database.types.ts` für beide RPCs

## 2. Die alten Zusagen — zwei ändern, fünf ausdrücklich NICHT

- [x] 2.1 **Die fünf argumentlosen SQL-Aufrufe in `rls_test.sql` (479, 486, 491,
      496, 769) bleiben stehen.** Weil die neue Funktion Vorgabewerte trägt, ist
      `admin_list_feedback()` weiter gültig — und die fünf werden dadurch zu
      **Wächtern über genau diese Vorgabewerte**. Der erste Plan wollte sie
      umschreiben und hätte damit fünf Wächter stillgelegt (Befund codex)
- [x] 2.2 Nur `rls_test.sql` Z. 500 und 504 ändern: `has_function_privilege` auf
      `'public.admin_list_feedback(int,int)'` — nur diese zwei benennen die
      **Funktionsidentität**. Zeigt eine davon auf eine Signatur, die es nicht
      mehr gibt, ist ein Recht ungeprüft
- [x] 2.3 `src/lib/feedback.test.ts:79` auf den Aufruf mit Argumenten ziehen
- [x] 2.4 Zusage: die Vorgabewerte sind da. Ein argumentloser Aufruf liefert
      dieselbe erste Seite wie ein Aufruf mit `(25, 0)`. Das ist die Zusage, die
      2.1 überhaupt erst zu einem Wächter macht
- [x] 2.5 Gegenprobe zu 2.2–2.4: die Vorgabewerte in einem zurückgerollten Rahmen
      entfernen und belegen, dass die fünf Aufrufe aus 2.1 brechen. Grün allein
      belegt hier nichts

## 3. Neue Zusagen an den Funktionen

- [x] 3.1 pgTAP: Seite 2 überschneidet sich **nicht** mit Seite 1, und beide
      zusammen ergeben denselben Bestand wie ein Aufruf mit grossem `p_limit`.
      Fixtures mit **gleichem** `created_at`, damit die Zusage den zweiten
      Ordnungsschlüssel wirklich prüft. Das Szenario gilt für unveränderten
      Bestand — gegen gleichzeitige Zugänge hilft Offset grundsätzlich nicht
- [x] 3.2 pgTAP: `p_limit` von 0, `null` und 9999 werden geklemmt, nicht abgewiesen
- [x] 3.3 pgTAP: die Zeile trägt `profile_id`, und sie zeigt auf **dasselbe**
      Mitglied wie `author_name` — nicht bloss „die Spalte ist da"
- [x] 3.4 pgTAP: `admin_list_members` und `admin_member_counts` stimmen für jeden
      Zustand überein. **Mit diskriminierenden Fixtures: die Zustandsmengen sind
      verschieden gross**, und es gibt Zeilen, die deaktiviert UND gelöscht sind.
      Gleiche Kardinalität bei ausgewogenen Fixtures bliebe sonst grün, obwohl ein
      Zweig falsch ist (Befund codex). Der Vergleich setzt `p_query => null`,
      `p_offset => 0` und ein Limit über dem ganzen Fixture-Bestand
- [x] 3.5 pgTAP: ein Zustand ohne Mitglieder erscheint **mit der Zahl null**,
      nicht gar nicht
- [x] 3.6 pgTAP: ein Mitglied und ein `matching_manager` bekommen aus
      `admin_member_counts()` einen **Fehler**, keine Zeile mit Nullen
- [x] 3.7 pgTAP: die Rechte aller drei neuen Funktionen — `anon`, `authenticated`
      und **das fehlende PUBLIC-ACL**. Ohne die dritte Prüfung bliebe ein
      vergessenes `revoke … from public` unbemerkt
- [x] 3.8 pgTAP: `admin_list_members` behält Signatur und Spaltensatz. Die
      bestehenden Wächter tun das schon — hier wird nur belegt, dass sie nach 1.3
      **unverändert** grün sind, statt angepasst worden zu sein
- [x] 3.9 Gegenproben zu 3.1–3.7: jede Funktion einmal absichtlich verbiegen
      (Klemmung heraus, `is_admin()` heraus, `id desc` heraus, ein Zweig der
      geteilten Bedingung verdreht) und belegen, dass genau die zuständigen
      Zusagen fallen. **Aufweichen, nicht entfernen**

## 4. Datenschicht im Client

- [x] 4.1 `src/lib/feedback.ts`: `fetchAdminFeedback` nimmt Seite und Grösse,
      reicht `p_limit`/`p_offset` durch, gibt `profile_id` heraus. Kein Fehler
      wird zu einer leeren Liste geglättet
- [x] 4.2 Ein Schlüssel, der die Seite trägt — sonst zeigt Seite 2 den Inhalt von
      Seite 1
- [x] 4.3 Die Zähler-Abfrage. **Ihr Schlüssel liegt unter dem Präfix
      `["admin-members", …]`** — die Lebenszyklus-Aktionen invalidieren genau
      diesen Präfix (`AdminMitgliederPage.tsx:223`). Ein eigener Schlüssel
      daneben liesse die Zahlen nach jeder Aktivierung oder Deaktivierung stehen,
      **und jeder Test auf das erste Rendern bliebe grün** (Befund codex)
- [x] 4.4 Zusage: nach einer Zustandsänderung werden die Zähler **neu geholt**.
      Nicht das erste Rendern prüfen, sondern Mutation → Nachladen
- [x] 4.5 `admin_list_members` selbst bleibt im Client unangetastet —
      `admin-members.test.ts:55-73` prüft ihr Args-Objekt mit `toEqual`

## 5. Die Feedback-Seite

- [x] 5.1 Neue Seite unter `src/pages/` mit dem Inhalt von `AdminFeedbackCard`:
      Sterne, „Gefällt/Fehlt/Idee", Datum, Verfasser, Pfad. Blättern wie die
      Mitgliederliste
- [x] 5.2 Route `/admin/feedback` hinter `RequireAdmin`, Muster `App.tsx:157-164`.
      Admin-Seiten werden hier **eager** importiert
- [x] 5.3 Menüeintrag in `AppShell.tsx:196-210`
- [x] 5.4 `AdminFeedbackCard` aus `AdminSettingsPage.tsx:67` entfernen; die
      Komponente auflösen, wenn sie keinen Aufrufer mehr hat
- [x] 5.5 `AdminSettingsPage.test.tsx:61-92` von der Zusage zur **Negativ**zusage
      drehen, wie AGE-578 es mit `EinstellungenPage.test.tsx:171-178` tat. Ein
      gelöschter Test wäre keine Zusage, sondern eine Lücke
- [x] 5.6 Zusage: ein gescheiterter Aufruf zeigt **nicht** den Leerzustand
- [x] 5.7 Zusage auf den Menüeintrag — heute prüft **kein** Test die
      Zusammensetzung des Administrationsabschnitts
- [x] 5.8 **Negativzusage:** ein Nicht-Admin auf `/admin/feedback` wird
      weggeleitet. Ohne sie bliebe eine Route ohne `RequireAdmin` grün
- [x] 5.9 **Negativzusage:** `/admin/mitglied/:id` steht **nicht** im Menü. Eine
      Route mit Parameter hat dort nichts zu suchen, und ohne die Zusage fiele es
      niemandem auf

## 6. Zähler an den Reitern

- [x] 6.1 Die Zahl an jeden der fünf Reiter (`AdminMitgliederPage.tsx:339-349`).
      Die Beschriftung bleibt der **Name** des Reiters; die Zahl gehört nicht in
      `aria-label` hineingemischt, sonst liest eine Vorleseausgabe „Nicht
      aktiviert 12" als Namen eines Bedienelements
- [x] 6.2 Die Abbildung Reiter → Zustand steht in der Fläche:
      **`mitgliedschaft → alle`**. `admin_list_members(..., 'mitgliedschaft')`
      würfe `22023` — die Kennung ist ein Darstellungsmodus, kein Zustand
- [x] 6.3 Zusage: jeder Reiter zeigt seine Zahl; „Alle" und „Mitgliedschaft"
      dieselbe
- [x] 6.4 Zusage: solange die Zahlen nicht da sind, steht **keine** Zahl da —
      nicht die Null (die Lehre aus AGE-582, 6.6)
- [x] 6.5 Zusage: bei aktiver Suche bleiben die Zahlen **global**. Das ist die
      gewollte Seite des scheinbaren Widerspruchs „Reiter sagt 70, Liste zeigt
      zwei" — ohne Zusage hält ein späterer Leser es für einen Fehler

## 7. Der Deeplink in den Feed

- [x] 7.1 `CommunityFeed` liest `?post=<id>` per `useSearchParams` und **holt den
      Beitrag über seine Kennung** (`posts?id=eq.<id>`, unter der RLS), statt den
      Feed zu durchlaufen. Eine Anfrage, jeder sichtbare Beitrag erreichbar,
      unabhängig vom Alter
- [x] 7.2 **Der Parameter darf NICHT in `feedSeitenKey`.** Er ändert nicht, was
      der Feed lädt. Stünde er drin, verwürfe jeder Deeplink den geladenen Feed.
      Die Abfrage des einzelnen Beitrags hat ihren eigenen Schlüssel
- [x] 7.3 Der geholte Beitrag steht dem Feed voran und wird in der Liste darunter
      **herausgefiltert** — sonst steht er zweimal da und sieht wie ein
      Dublettenfehler aus
- [x] 7.4 Nicht gefunden: eine Meldung. **Es gibt nur einen Weg dorthin** —
      unsichtbar und nicht vorhanden liefern beide null Zeilen aus derselben
      Abfrage. Kein `if`, das die Fälle trennt und dann gleich rendert
- [x] 7.5 Zusage: mit der Kennung eines sichtbaren Beitrags steht er oben; ohne
      Parameter ändert sich nichts
- [x] 7.6 Zusage: **ununterscheidbar.** Einmal mit der Kennung eines
      vorhandenen, aber unsichtbaren Beitrags, einmal mit einer erfundenen — die
      zwei Läufe erzeugen **dieselbe Anfrage**, dasselbe leere Ergebnis und
      dieselbe Fläche. Verglichen werden die zwei Läufe **miteinander**, nicht
      gegen ein Muster (Befund codex: eine Musterprüfung liesse zwei verschiedene
      Meldungen zu, die beide passen)
- [x] 7.7 Zusage: der Schlüssel der Feed-Abfrage ist mit und ohne `?post=`
      derselbe. Die scharfe Fassung von 7.2
- [x] 7.8 Zusage: der voranstehende Beitrag erscheint **nicht** zusätzlich in der
      Liste

## 8. Die Aktivitäten-Karten — beide

- [x] 8.1 `PublicProfilePage.tsx:240-246`: jede Zeile wird ein **`<a>`** auf
      `/aktivitaet?post=<id>`. Kein `div` mit `onClick` — das bestünde
      `fireEvent.click` und wäre trotzdem nicht bedienbar (Befund gemini)
- [x] 8.2 **Dasselbe in `profil-widgets.tsx:242-274`** („Meine Beiträge"). Das
      Spec-Delta sagt „jede Zeile, auf jedem Profil"; der erste Plan verlinkte nur
      die öffentliche Seite und hätte die eigene stumm gelassen (Befund codex)
- [x] 8.3 Ersatztext **„Beitrag ohne Text"** für den leeren Body, an beiden Karten
      (`PublicProfilePage.tsx:241`, `profil-widgets.tsx:266`). **Nicht** „Beitrag
      mit Bild": `create_post_with_media` nimmt leeren Text und leere Medien an,
      und das Spalten-UPDATE-Recht lässt ein Mitglied den eigenen Text leeren —
      die Karte behauptete sonst etwas Ungeprüftes (Befund codex, Donalds
      Entscheidung vom 25.08.)
- [x] 8.4 Zusagen je Fläche: die Zeile führt zu **ihrem** Beitrag; sie ist ein
      `<a>` mit `href`; die textlose Zeile trägt den Ersatztext

## 9. Abnahme

- [x] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün — **nie**
      `pnpm format`
- [x] 9.2 `supabase test db` mit **ausdrücklicher Dateiliste** aus `ci.yml` grün.
      Ohne die Liste meldet der Befehl FAIL, obwohl grün
- [x] 9.3 Sichtprobe gegen den lokalen Stack, **beide Themes** — `hell` und `navy`
      über `localStorage['fbc.designVariant']`, **nicht** die Einstellung des
      Betriebssystems. Bei 1440 px und echten 375 px (`emulate`, nie `resize_page`)
- [x] 9.4 Sichtprobe: Deeplink von **beiden** Profilflächen, einmal auf einen
      jungen und einmal auf einen **alten** Beitrag — der alte ist der Fall, an
      dem der verworfene Entwurf gescheitert wäre
- [x] 9.5 Sichtprobe: die fünf Zahlen stimmen mit dem überein, was der jeweilige
      Reiter dann zeigt — und sie bleiben stehen, wenn eine Suche läuft
- [x] 9.6 Sichtprobe: eine Zustandsänderung an einem Mitglied ändert die Zahlen
      **ohne Neuladen**
- [x] 9.7 Sichtprobe: die Feedback-Seite blättert; `/admin` trägt die Karte nicht
      mehr
- [x] 9.8 Zweite Meinung auf den Diff (Schritt 4 der Schleife), Vendor ungleich
      dem des Deltas
