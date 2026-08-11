# Tasks — Mitglieder-Aktivierung (AGE-495)

**Revision 4** (2026-08-06): Donalds Sichtbarkeits-Entscheidung als 2.1b/2.5b/3.3b
eingebaut; die verbleibenden Befunde aus Runde 3 stehen als Aufgaben in Block 12,
nicht als weitere Revision.

**Revision 3** nach der zweiten Review-Runde. Geändert gegenüber Revision 2:
1.3 (unique-Index), 1.7/1.8 (Tripwire statt Datums-Guard), 2.6 (sieben statt
vier RPCs), 4.2 (kein JWT), 4.3/4.4 (Nebenläufigkeit), 5.2 (Token zuerst
beanspruchen, Stempel zuletzt). Neu: `INVENTORY.md` mit den ausgeschriebenen
Listen — „46 Policies" und „vier RPCs" waren behauptet, und die zweite Zahl war
falsch.

**Reihenfolge ist Absicht.** Das Gate entsteht vor allem, was es bedient: erst
Schema und Helfer, dann die Policies, dann der Test, der beweist dass es greift
— **und erst danach** die Edge Functions und das Frontend. Ein
Aktivierungsbildschirm über einem offenen Gate ist Kulisse und wäre in jeder
Prüfung grün.

**Entwickelt und getestet wird gegen LOKAL (`supabase start`) und gegen DEV.**
Niemals direkt gegen PROD. Vor jedem schreibenden CLI-Befehl wird das Zielprojekt
ausgegeben. Kein `supabase db reset` gegen ein Remote-Projekt.

**Zwei Haltepunkte:** Task 6.4 und Task 10.3.

**TDD gilt für 3, 4.4, 5.6, 6.7, 7.5.** Erst der rote Test, dann der Code. Ein
Test, der beim ersten Lauf grün ist, hat nichts gemessen und wird gelöscht.

---

## 0. Ausgangsmessung — bevor irgendetwas gebaut wird

- [x] 0.1 `scripts/probe-activation-gate.ts` schreiben und **gegen den heutigen
      Stand** laufen lassen. Roher Supabase-Client, echte Session eines Kontos
      mit `activated_at = null`, direkte Abfragen auf `profiles`,
      `profiles_public`, `posts`, `events`, `offers`, `needs`, `matches`,
      **`profile_contacts`**, `goals`, `notifications` plus **alle sieben** RPCs
      aus `INVENTORY.md` B1.
      **Erwartetes Ergebnis heute: Zeilen, nicht null.** Das ist der rote
      Ausgangsbefund, gegen den Task 8 misst. Ohne ihn ist „null Zeilen" am Ende
      nicht von „Abfrage falsch geschrieben" zu unterscheiden.
- [x] 0.2 Ergebnis mit Zeilenzahlen pro Tabelle in `EVIDENCE.md`, Abschnitt
      „Vorher".

## 1. Migration A — Schema und Helfer

- [x] 1.1 `profiles.activated_at timestamptz` (nullable, kein Default).
      Kommentar am Feld: `null` = nicht aktiviert, einzige Wahrheit fürs Gate.
- [x] 1.2 **Kein Schreibrecht für Clients** — nicht nur als Zusage, sondern als
      Mechanismus: der Spalten-`grant update` auf `profiles` (`20260611171003:80`)
      zählt die erlaubten Spalten auf und wird **nicht** erweitert. Eine
      Assertion in 3.9 hält das fest.
- [x] 1.3 `public.activation_tokens`: `token_hash text primary key`,
      `profile_id uuid not null references profiles(id) on delete cascade`,
      `expires_at timestamptz not null`, `used_at timestamptz`,
      `created_at timestamptz not null default now()`.
      **`unique`** partieller Index `(profile_id) where used_at is null`.
      _Das `unique` ist der Punkt (codex): ohne es erzwingt nichts „ein Token je
      Profil", und ein `insert … where not exists` serialisiert zwei
      gleichzeitige Anforderungen nicht._
- [x] 1.4 `alter table public.activation_tokens enable row level security;`
      **Keine Policy, kein Grant.** Deny-by-default ist hier das Feature. Als
      Kommentar an der Tabelle ausschreiben, damit niemand später „die fehlende
      Policy nachreicht".
- [x] 1.5 `public.is_activated()` — `stable security definer`,
      `set search_path = ''`, `coalesce(...) → false` bei fehlender Session.
      `revoke execute from public, anon`, `grant execute to authenticated`.
- [x] 1.6 `public.my_activation_state()` — `SECURITY DEFINER`, gibt **genau**
      `(activated boolean, display_name text)` für `auth.uid()` zurück.
      Die einzige Ausnahme vom Gate und zugleich seine Voraussetzung: ohne sie
      kann `AuthProvider` nach Migration B die eigene Zeile nicht mehr lesen.
      `grant execute to authenticated`, `revoke from anon`.
      _Nichts weiter zurückgeben. Jedes zusätzliche Feld ist ein Feld, das ein
      Angreifer mit dem Default-Passwort abholt._
- [x] 1.7 **Tripwire vor dem Backfill:** Profile zählen und mit
      `raise exception` abbrechen, wenn mehr als der bei Abfassung gemessene
      Stand (37, C4-Audit) vorliegt — dann ist der Import schon gelaufen.
      _Revision 2 wollte hier `where created_at < <Migrationszeitpunkt>` als
      „zweite Sicherung". Das trägt nicht (codex): läuft der Import zuerst,
      erfüllen genau die importierten Profile die Bedingung. Und ein Import darf
      `created_at` auf das historische Beitrittsdatum zurückdatieren (opencode),
      dann hilft überhaupt kein Datum. Es gibt EINE Sicherung — die
      Deploy-Reihenfolge — und diesen Stolperdraht._
- [x] 1.8 Backfill danach unbedingt: `update public.profiles set
activated_at = now()`.
- [x] 1.9 **Harte Vorbedingung im Migrationskopf und in C10 vermerken:**
      Migration A läuft **vor** dem Import.

## 2. Migration B — das Gate einweben

Reiner Policy-Diff. **Das Gate gilt für alle Mitgliedsdaten, auch die
„eigenen".** Der Angreifer meldet sich als das Mitglied an; `auth.uid()` ist die
ID des Opfers. Ein `or id = auth.uid()`-Zweig wäre die Lücke, nicht die
Ausnahme.

- [x] 2.1 Lesende Fremddaten-Policies (17): `profiles_select_self_or_discover`,
      `interests_select`, `theme_scores_select`, `profile_badges_select`,
      `contacts_select_self_or_released`, `offers_select`, `needs_select`,
      `matches_select_participant`, `cr_select_participants`, `threads_select`,
      `messages_select`, `posts_select_by_visibility`, `comments_select_visible`,
      `events_select_by_visibility`, `regs_select_self_or_host`,
      `partners_read_authenticated`, `feedback_admin_read`.
- [x] 2.1b **Zielprofil mitprüfen** (Entscheidung 16, Donald 2026-08-06) — auf
      den Verzeichnisflächen zusätzlich `<zeile>.activated_at is not null`:
      `profiles_select_self_or_discover`, `interests_select`,
      `theme_scores_select`, `profile_badges_select`, `offers_select`,
      `needs_select`, `contacts_select_self_or_released`.
      _Ohne das sähen bereits bestätigte Mitglieder genau die Profile, deren
      Inhaber sich nie ausgewiesen haben — und die Zusage im Mailtext wäre
      unwahr (codex, Runde 3)._
      **Inhalte (`posts`, `events`, `comments`, Interaktionen) bekommen die
      Prüfung NICHT**: sie können keinen unbestätigten Urheber haben, weil die
      schreibenden Policies gegatet sind. Eine Prüfung ohne möglichen Fall.
- [x] 2.2 Schreibende Policies (12): `cr_insert_self`, `cr_update_recipient`,
      `threads_insert`, `messages_insert`, `posts_write_own`,
      `comments_insert_own`, `likes_write_own`, `regs_write_own`,
      `events_write_host`, `routing_queue_update_staff`, **`offers_write_own`**,
      **`needs_write_own`**.
      _Die letzten beiden fehlten in Revision 1: ein Angreifer hätte unter dem
      echten Namen des Mitglieds Angebote und Gesuche veröffentlicht._
- [x] 2.3 **Own-Data-Policies (16)** — neu gegenüber Revision 1, codex'
      blockierender Befund: `profiles_update_own`, `profile_contacts_select_own`
      (als Teil von 2.1), `profile_contacts_insert_own`,
      `profile_contacts_update_own`, `goals_own`, `notifications_own`,
      `feedback_own`, `member_settings_own`, `compass_responses_select_own`,
      `compass_responses_write_own`, `interests_write_own`,
      `theme_scores_write_own`, `staff_roles_select_self`,
      `platform_settings_update_admin`, `avatars_insert_own`,
      `avatars_update_own`, `avatars_delete_own`.
      _`profile_contacts` ist der wichtigste Eintrag der Liste: dort stehen
      E-Mail und Telefonnummer des Mitglieds._
- [x] 2.4 `routing_queue_select_staff`.
- [x] 2.5 **`profiles_public` neu deklarieren** mit `and public.is_activated()`
      im `where`. Ohne diesen Schritt ist 2.1 wirkungslos: die View hat
      `security_invoker = off` und läuft an den Policies vorbei.
      `security_invoker` bleibt `off` — das trägt die Sichtbarkeit für `basic`.
      **Kein `or id = auth.uid()`-Zweig**, konsistent mit 2.3.
      **Und `and activated_at is not null`** auf der Zeile (Entscheidung 16) —
      die View ist die Hauptfläche des Verzeichnisses.
      _`create or replace view` erhält die Grants; nach dem Replace trotzdem
      `has_table_privilege` prüfen, nicht annehmen._
- [x] 2.6 Die **sieben** `SECURITY DEFINER`-RPCs nachziehen —
      Revision 2 zählte vier, das war zu wenig (opencode; nachgemessen):
      `post_engagement_counts`, `event_registration_counts`,
      `register_for_event`, `set_event_check_in`, **`recompute_my_matches`**,
      **`admin_list_feedback`**, **`list_routing_queue`**.
      _Die letzten drei sind durch `is_admin()` / `is_matching_manager()` bzw.
      `auth.uid()` gedeckt — das schützt gegen fremde Rollen, nicht gegen einen
      Angreifer im Konto eines echten Staff-Mitglieds. Vollständige Begründung
      je Funktion in `INVENTORY.md`, Abschnitt B._
      `register_for_event` / `set_event_check_in` werfen `42501`, die beiden
      `_counts` liefern leer.
      _Achtung AGE-448: der `public`-Zweig von `register_for_event` trägt den
      Gäste-Fall. Er bleibt erhalten — Gäste registrieren sich selbst und
      durchlaufen denselben Aktivierungsweg (design.md, Entscheidung 1)._
- [x] 2.7 **Nicht anfassen** und im Kopf der Migration namentlich ausschreiben:
      die fünf anon-Policies (`posts_select_public_anon`,
      `events_select_public_anon`, `badges_read_all`, `tiers_read_all`,
      `partner_cat_read_all`) und `platform_settings_select` (globaler Flag,
      kein Mitgliedsdatum). Rechnung: 46 + 5 + 1 = 52. Die vollständigen Listen
      stehen in `INVENTORY.md`, Abschnitt A — Migration Bs Lesbarkeit war der
      Grund für den Zwei-Migrationen-Schnitt und hängt daran, dass der Reviewer
      sie sehen kann.
- [x] 2.8 **Profilbilder: bewusst außerhalb des Gates**, im Migrationskopf
      ausschreiben. Der `avatars`-Bucket ist `public` (`20260613081627:18`) und
      trägt absichtlich keine SELECT-Policy; Bilder rendern über ihre URL. Die
      drei `storage.objects`-Policies regeln nur Schreibzugriffe und sind
      gegatet. Was Reads schützt, ist `profiles.avatar_url` — und die Spalte ist
      gegatet. Vorbestehend, keine Regression (`INVENTORY.md`, Abschnitt C).

## 3. pgTAP — der Beweis, dass das Gate greift

TDD: dieser Block wird **vor** Migration B geschrieben und muss rot sein.

- [x] 3.1 Fixture: ein Konto mit `tier = 'impact'` (!) und `activated_at = null`.
      Bewusst die höchste Stufe — es muss belegen, dass das Gate ohne
      Stufen-Gate dahinter trägt, so wie bei den importierten Konten.
- [x] 3.2 Je eine `count_as`-Assertion auf 0 Zeilen für: `profiles`,
      `profiles_public`, `posts`, `events`, `offers`, `needs`,
      `profile_interests`, `comments`, `matches`.
- [x] 3.3 **Die eigenen Daten ebenso auf 0**: `profile_contacts` (die eigene
      Zeile!), `goals`, `notifications`, `compass_responses`, `member_settings`.
      Das ist die Assertion zu codex' Befund — sie ist in Revision 1 nicht
      vorgekommen und hätte die Lücke aufgedeckt.
- [x] 3.4 Schreibversuche desselben Kontos auf `profiles`, `offers`, `needs`,
      `posts` → `try_as` liefert `DENIED:%` bzw. ändert nichts.
- [x] 3.3b **Zielprofil-Gate (Entscheidung 16):** ein **bestätigtes** Konto
      fragt `profiles` und `profiles_public` ab und sieht das unbestätigte
      Fixture-Profil aus 3.1 **nicht**. Das ist die Assertion zur Mailzusage —
      ohne sie ist der Satz „für kein anderes Mitglied sichtbar" unbelegt.
- [x] 3.5 Gegenprobe: dasselbe Konto mit `activated_at = now()` sieht dieselben
      Zeilen wie ein normales `impact`-Konto. Ohne diese Hälfte prüft 3.2 nur,
      dass die Fixture kaputt ist. **Und es taucht danach für andere im
      Verzeichnis auf** — die Gegenprobe zu 3.3b.
- [x] 3.6 `my_activation_state()` liefert dem nicht aktivierten Konto
      `(false, <Name>)` — und **nur** diese zwei Felder. Assertion auf die
      Spaltenzahl, damit ein späteres Feld nicht unbemerkt dazukommt.
- [x] 3.7 **Alle sieben** RPCs aus `INVENTORY.md` B1 einzeln belegen, nicht nur
      drei (codex): `try_as` → `DENIED:%` für `register_for_event`,
      `set_event_check_in`, `recompute_my_matches`; `count_as` → 0 für
      `post_engagement_counts`, `event_registration_counts`,
      `admin_list_feedback`, `list_routing_queue`.
- [x] 3.8 **Anon bleibt unberührt:** öffentliche Posts und Events sind für die
      `anon`-Rolle weiter sichtbar. Nicht über `count_as` (das setzt eine
      authentifizierte Identität) — eigener Helfer mit `set local role anon`.
- [x] 3.9 `activation_tokens`: `has_table_privilege` ist `false` für `anon` und
      `authenticated`, für alle vier Operationen. Dazu:
      `has_column_privilege('authenticated', 'public.profiles', 'activated_at',
'update')` ist `false` (Mechanismus zu 1.2).
      _Nachgezogen 06.08.: das Häkchen stand über **drei** der acht Assertions
      (anon/SELECT, authenticated/SELECT, authenticated/INSERT). UPDATE und
      DELETE waren auf beiden Rollen ungeprüft — ein späteres `grant update`
      wäre also durch genau den Block gerutscht, der ihn fangen soll. Fünf
      Assertions ergänzt, Plan 148 → 153. Vorher rot gemessen mit einer
      Wegwerf-Sonde, die die Rechte erteilt und wieder zurücknimmt:
      `has_table_privilege` schlägt auf `true` um, die Assertions sind also
      keine Leerprüfung. Gefunden beim 6.4-Nachlauf (siehe 13.4)._
- [x] 3.10 `plan(n)` auf die neue Zahl heben. Lauf **mit** Dateiliste:
      `supabase test db supabase/tests/rls_test.sql supabase/tests/grants_test.sql
supabase/tests/directory_search_test.sql` — ohne Liste meldet der Befehl
      FAIL, obwohl grün.
- [x] 3.11 `grants_test.sql`: Golden-Snapshot pflegen. `activation_tokens` taucht
      **nicht** auf (kein Grant) — deshalb eine eigene, explizite Assertion, dass
      die Tabelle in der Grant-Matrix fehlt.

## 4. Edge Function `send-activation`

- [x] 4.1 `supabase/functions/send-activation/` nach dem Muster von
      `notify-contact-request`: `index.ts` (I/O), `emails.ts` (reine Logik),
      `emails.test.ts`, `README.md`.
- [x] 4.2 **Auth-Modell.** `verify_jwt = false`, weil die Function **auch ohne
      Session** erreichbar sein muss: hat ein Angreifer das Passwort geändert,
      käme das Mitglied sonst nie an einen Link (design.md, Entscheidung 7).
      **Die Function liest kein JWT** — nur die E-Mail-Adresse aus dem Body.
      _Revision 2 wollte bei vorhandener Sitzung die `sub` „aus dem vom Gateway
      geprüften JWT" lesen. Bei `verify_jwt = false` prüft das Gateway nichts
      (codex); die Kennung wäre frei wählbar und damit ein Weg, den Link eines
      fremden Kontos auszulösen. Ein Zweig weniger, und sicherer._
      Empfänger ist immer die **hinterlegte** Adresse des Profils, nie eine
      mitgegebene. Antwort `202` unabhängig davon, ob die Adresse existiert —
      sonst ist der Endpunkt ein Adressverzeichnis.
- [x] 4.3 Token: 32 Byte aus `crypto.getRandomValues`, base64url. Gespeichert
      wird **nur** `sha256(token)` als Hex. `expires_at = now() + 72h`.
      **≥ 256 Bit Entropie, CSPRNG** — das ist die Eigenschaft, auf der der
      öffentliche Einlöse-Endpunkt ruht (opencode), und steht deshalb auch in
      der Spec, nicht nur hier.
      **Ein neuer Versand entwertet das ausstehende Token** — in derselben
      Anweisung, und der `unique`-Index aus 1.3 erzwingt es zusätzlich.
- [x] 4.4 Rate-Limit **pro Profil**, konkurrenzsicher: höchstens ein Versand pro
      60 s, höchstens fünf pro 24 h. Die Eindeutigkeit trägt der `unique`-Index
      (1.3), die Frequenz eine Bedingung in derselben Anweisung — nicht „erst
      zählen, dann einfügen": zwei parallele Requests passierten sonst beide die
      Prüfung (codex).
      _Das Limit ist zugleich die einzige Begrenzung der Belästigungsfläche aus
      Entscheidung 8: wer eine Adresse kennt, entwertet damit wiederholt den
      ausstehenden Link. Im Code-Kommentar benennen._
- [x] 4.5 `emails.test.ts` nach dem Muster von `notify-contact-request`: reine
      Render-Funktionen, `escapeHtml`-Fall, Betreff, Fallback ohne Namen, und
      **eine Assertion, dass der Klartext-Token im Link steht und der Hash
      nirgends**. `deno test` + `deno check index.ts`.
- [x] 4.6 Bereits aktiviertes Konto → `202` wie jeder andere Fall, keine Mail.
- [x] 4.7 Der Link zeigt auf `/aktivierung#token=…` — **Fragment, nicht
      Query-String** (Entscheidung 10). Assertion in 4.5.

## 5. Edge Function `redeem-activation`

- [x] 5.1 `verify_jwt = false` — **Absicht.** Das Token trägt die Identität,
      nicht die Session; nur so funktioniert der Link in einem anderen Browser
      (AGE-495 §6). Im Kopf der Datei **und** in `config.toml` begründen.
- [x] 5.2 Ablauf, vier Schritte, Reihenfolge ist die Sicherung (Entscheidung 9):
      **1.** Token atomar beanspruchen —
      `update activation_tokens set used_at = now() where token_hash = $1 and
used_at is null and expires_at > now() returning profile_id`. Kein
      Treffer → abgelehnt. **2.** Passwort setzen. **3.** `signOut(uid,
'global')`. **4.** _Erst danach_ `activated_at` stempeln.
      _Schritt 1 muss EINE Anweisung sein (codex, opencode): ein Prüfen mit
      anschließendem Vermerken lässt zwei gleichzeitige Einlösungen beide durch,
      und es setzten zwei verschiedene Passwörter. Und der Stempel gehört ans
      ENDE, weil er das Gate öffnet: schlägt der Sitzungswiderruf danach fehl,
      läuft genau die vorab angelegte Angreifer-Sitzung hinter dem geöffneten
      Gate weiter — der Zustand, den dieser Change verhindern soll._
      _Nicht „in einer Transaktion" — GoTrue läuft über HTTP und kann mit einem
      Postgres-Commit nicht klammern (codex). Bricht der zweite Schritt, steht
      ein Konto mit neuem Passwort und ohne Aktivierung: das Mitglied kommt
      herein und fordert einen neuen Link an. Die umgekehrte Reihenfolge erzeugt
      den gefährlichen Zustand — aktiviert, aber noch auf dem Default-Passwort.
      Das gehört als Kommentar an die Stelle._
- [x] 5.3 Ausstehende Tokens des Profils mit entwerten (der `unique`-Index
      lässt ohnehin nur eines zu — die Anweisung ist die Absicherung gegen ein
      späteres Lockern des Index).
- [x] 5.4 Passwortprüfung serverseitig: mindestens zehn Zeichen.
- [x] 5.5 Antworten, die das Frontend unterscheiden kann — je ein eigener Code
      für `expired`, `used`, `not_found`, `weak_password`. Kein generisches
      „ungültig": AGE-495 §6 verlangt für „abgelaufen" und „schon benutzt"
      unterschiedliche Bildschirme.
- [x] 5.6 Versuchs-Drosselung pro Aufrufer auf diesem Endpunkt (opencode). Ein
      256-Bit-Token ist nicht erratbar, aber ein ungedrosselter öffentlicher
      Endpunkt ist auch ohne Erfolg eine Lastfläche. Steht als Anforderung in
      der Spec, nicht nur hier.
      _Umgesetzt 06.08. nach der Entscheidung in 12.6: Migration
      `20260806110000_activation_redeem_throttle.sql` (Tabelle
      `activation_attempts`, RPC `note_failed_activation`, nur `service_role`),
      Aufruf in `redeem-activation/index.ts` **hinter** dem Beanspruchen, neuer
      Status `throttled` in `RedeemStatus` und auf der Einlöseseite. Belege:
      `rls_test.sql` Abschnitt 14c (+8 Assertions, Plan 140 → 148) und ein
      Vitest auf der Einlöseseite — beide vorher rot gemessen._
- [x] 5.7 `signOut` als Vorsicht kennzeichnen, nicht als Befund: gemessen wurde,
      dass ein Passwortwechsel Access- und Refresh-Token bereits tötet. Für den
      Admin-Pfad ist das **ungemessen**, deshalb der explizite Aufruf.

## 6. Frontend

- [x] 6.1 `AuthProvider` ruft `my_activation_state()` statt die Profilzeile zu
      lesen — nach Migration B ist Letztere für ein nicht aktiviertes Konto
      gesperrt. Neue Felder `isActivated` / `activationLoading`.
      _Solange unbekannt: **nicht** durchlassen. Fail closed._
- [x] 6.2 `ActivationGate` in `HomeRedirect`s Naht und um die
      `AppShell`-Routen. Eingeloggt + nicht aktiviert → ausschließlich der
      Aktivierungsbildschirm, egal welche Route.
- [x] 6.3 Aktivierungsbildschirm: erklärt in zwei Sätzen, was passiert, Button
      „Bestätigungslink senden", danach 60 s Sperre mit Countdown und Hinweis
      auf den Spam-Ordner.
- [x] 6.4 **Haltepunkt.** Route `/aktivierung` außerhalb der `AppShell`. Token
      aus dem **Fragment** lesen, danach `history.replaceState` ohne Fragment;
      `Referrer-Policy: no-referrer` auf der Route. Ohne Fragment: Formular
      „Link erneut anfordern" über die E-Mail-Adresse — das ist der Weg für ein
      Mitglied, dessen Passwort übernommen wurde.
- [x] 6.5 Die sieben Fehlerfälle aus AGE-495 §6, je ein eigener Zustand:
      abgelaufen (+ „Neuen Link senden") · schon benutzt („Konto ist schon
      aktiviert" + Login) · Konto schon aktiviert, alter Link (Weiterleitung auf
      `/`, **keine** Fehlermeldung) · Adresse stimmt nicht mehr (Hinweis auf
      `info@fairbusinessclub.de`) · anderer Browser (muss gehen) · Mail kommt
      nicht an (erneut senden nach 60 s) · Passwort zu schwach.
- [x] 6.5b Der Aktivierungsbildschirm nennt die Asymmetrie aus Entscheidung 15:
      ausgeloggt sieht man das öffentliche Schaufenster, eingeloggt-nicht-
      aktiviert nicht. Ohne diesen Hinweis liest sich der leere Bildschirm als
      Fehler. Button „Abmelden und weiterstöbern".
- [x] 6.6 `LoginPage`: Mindestlänge von 8 auf **10**. Heute widerspricht der
      Client dem Server und produziert einen Serverfehler statt einer
      Feldmeldung.
- [x] 6.7 Vitest für `ActivationGate` und die Einlöseseite. **Keine `vi.mock` auf
      eigene Komponenten** — das prüft den Mock, nicht den Code. `fireEvent`,
      nicht `user-event` (nicht installiert).
- [x] 6.8 `ThemeServerSync` fällt sauber zurück, wenn `member_settings` gesperrt
      ist (Folge von 2.3). Kein roter Fehler in der Konsole beim
      Aktivierungsbildschirm.
- [x] 6.9 Laufende lokale Version zeigen, bevor committet wird. Grüne Tests haben
      in AGE-492 ein visuell falsches Ergebnis durchgewunken.

## 7. Bereits erledigt — nur verifizieren, nichts ändern

- [x] 7.1 `minimum_password_length = 10`. **Steht schon** (C4). Nur belegen —
      jede Zeile in dieser Datei ist eine Aussage über PROD.
- [x] 7.2 Onboarding-Wizard nicht im Erstlogin. **Ist schon draußen**
      (AGE-494/C2).
- [x] 7.3 `site_url` / `additional_redirect_urls`. **Stehen** (C4). Prüfen, dass
      `https://fbc-platform.pages.dev/**` die Aktivierungsroute deckt.
- [x] 7.4 `enable_confirmations = false` bleibt. Nicht „korrigieren".
- [x] 7.5 `is_prime_plus` aus `src/lib/database.types.ts` räumen — fällt bei der
      Regenerierung von selbst weg. Danach `pnpm typecheck`.

## 8. Abnahme — der Beweis, den Donald sehen will

- [x] 8.1 `scripts/probe-activation-gate.ts` erneut laufen lassen, gegen LOKAL
      **und** gegen DEV. Erwartung: **null Zeilen** überall, einschließlich
      `profile_contacts`, `goals` und `notifications` des eigenen Kontos.
      Skript und vollständige Ausgabe in `EVIDENCE.md`, Abschnitt „Nachher" —
      neben dem roten Vorher aus 0.2. Kein Screenshot als Beleg.
- [x] 8.2 Gegenprobe im selben Lauf: ausgeloggter Client sieht weiterhin
      öffentliche Posts und Events.
- [x] 8.2b **Der Erste sieht nur zwei.** Auf DEV mit einem frisch bestätigten
      Konto das Verzeichnis abfragen: es enthält ausschließlich die
      Bestandskonten (Detlev und Donald). Erwarteter Zustand, kein Fehler —
      protokollieren, damit ihn niemand später „repariert".
- [x] 8.3 Alle sieben Fehlerfälle einmal von Hand durchspielen, protokolliert.
      _Erledigt 06.08. in drei Etappen, weil nicht jeder Fall auf derselben
      Fläche messbar ist._

      **Beim Betrachten der laufenden Oberfläche (6.9):** Wand auf `/`,
                                              `/mitglieder` und `/profil` · Anforderungsformular ohne Sitzung · Anrede
                                              und Adresse aus `my_activation_state()` · keine Konsolenfehler.

                                              **Gegen die LIVE deployten Functions** — Antworten der Function, nicht des
                                              Quelltexts: vierstelliges Passwort → `400 weak_password` (`minLength: 10`)
                                              · erfundenes Token → `410 not_found` · echtes Token zweimal eingelöst →
                                              `200 activated`, dann `410 used` · Fehlversuche einer IP → 19× `not_found`,
                                              dann `throttled` · `resend-activation` ohne JWT → `401` vom Gateway.

                                              **Gegen die LOKAL servierte Function** (`supabase functions serve`), weil
                                              die letzten zwei Fälle einen Datenbankeingriff brauchen und der an der
                                              Live-Datenbank nichts zu suchen hat: Token abgelaufen, nicht entwertet →
                                              `410 expired` · Token entwertet, nicht abgelaufen → `410 superseded`.
                                              Beide Zustände vorher einzeln in `activation_tokens` hergestellt und
                                              gegengeprüft, damit nicht ein Zustand zwei Antworten erklärt.

                                              Drei Dinge, die dabei mehr belegen als das Abhaken:

                                              1. **„Schon benutzt" antwortet `used`, nicht `not_found`** — der Punkt aus
                                                 12.4. Andernfalls läse das Mitglied eine falsche Meldung.
                                              2. **Die Drossel greift erst nach 19 sauberen `not_found`.** Sie zählt
                                                 also wirklich nur Fehlversuche und wirft nicht vorzeitig — die
                                                 Eigenschaft, an der die Entscheidung in 12.6 hing.
                                              3. **Die Reihenfolge im Fehlerzweig stimmt.** Ein Token, das benutzt
                                                 **und** abgelaufen ist, meldet `used`
                                                 (`20260806080200_activation_rpcs.sql:146-154`). Das ist die richtige
                                                 Wahl: das Konto ist aktiviert, „melde dich an" führt weiter. Gewönne
                                                 `expired`, schickte man das Mitglied einen neuen Link anfordern, den es
                                                 nie bekommt (`already_activated`) — eine Sackgasse. Vorher ungeprüft.

                                              **Der ganze Weg wurde einmal Ende zu Ende gegangen:** Mail an
                                              `donald@vlahovic.de` → Link → Token → Passwort gesetzt → `activated`.
                                              Gegenprobe direkt danach mit dem neuen Passwort: `my_activation_state()`
                                              meldet `activated:true`, und dasselbe Konto sieht jetzt `profiles_public`
                                              **37**, `posts` 5, `events` 9 — vorher waren es **14 Tabellen mit null
                                              Zeilen**. Damit hing die Sperre nachweislich am Aktivierungszustand und
                                              nicht an einer kaputten Fixture.

- [x] 8.4 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün.
      pgTAP grün, mit Dateiliste aufgerufen.
- [x] 8.5 `database-sentinel:audit` → `DB-AUDIT.md`. Critical und High blocken.
      _Gefahren 06.08. Ergebnis: **kein Critical, kein High auf DB-Ebene** —
      blockt nicht. 29/29 Tabellen mit RLS, 49 Policies, keine mit nacktem
      `auth.uid()` oder `user_metadata`, keine DEFINER-Funktion ohne
      `search_path`, kein INSERT/UPDATE-Grant auf `tier`, `potential_score`,
      `member_number`. `activation_tokens`: RLS an, 0 Policies, keine Grants —
      absichtlich. Der `profiles_public`-CRITICAL des Sentinels ist
      **zurückgezogen**: er stammt aus einer PROD-Messung ohne die
      C3-Migrationen. **Ablage `.gstack/security-reports/DB-AUDIT.md`**, nicht
      im Change-Verzeichnis: das Repo ist öffentlich und die Change-Dateien
      sind getrackt._
- [x] 8.6 `/cso` → `SECURITY.md`.
      _Gefahren 06.08., 41 Kandidaten → 17 gemeldet (1 CRITICAL, 3 HIGH, 12
      MEDIUM, 1 LOW). **Für C3 blockt nichts**; C3-eigen sind nur die MEDIUMs
      Nr. 6 (Sentry erfasst das Token-Fragment) und Nr. 7 (`send-activation`
      entwertet den gültigen Link). Der CRITICAL (Stripe-Secret-Parität) liegt
      außerhalb und ist für das Migrationsfenster auf MEDIUM neubewertet.
      **Ablage `.gstack/security-reports/SECURITY.md`**, gleiche Begründung
      wie 8.5; Rohbericht `2026-08-06-084500.json`._
- [x] 8.7 Unabhängiges Code-Review in eigenem Kontext. `openspec validate` ist
      ein Schema-Check und ersetzt es nicht.
      _Gefahren 07.08. mit **vier** Reviewern in je eigenem Kontext, ohne die
      Sitzungsgeschichte: RLS-Gate · Edge Functions · Frontend/Token · Tests.
      Umfang `ac8d73f..27e903b` (39 Code-Dateien, ~11.400 Zeilen, PRs
      #120/#127/#128). Volltext in `REVIEW-8.7.md`._

      **Ein Blocker, selbst nachgemessen:** die drei Aktivierungs-Functions
                                          beantworten OPTIONS mit `405` **ohne** `Access-Control-*`. Antwort trägt
                                          `x-deno-execution-id` und `x-served-by: supabase-edge-runtime` — die
                                          Function antwortet, nicht das Gateway. Das Frontend ruft alle drei über
                                          `supabase.functions.invoke` (`src/lib/activation.ts:68,83,91`), das
                                          `Content-Type: application/json` setzt und damit einen Preflight erzwingt.
                                          **Aus dem Browser schlägt der ganze Weg fehl.** Gegenprobe:
                                          `create-checkout-session` → `200` + `ACAO: *`.
                                          _Warum das bis heute unsichtbar war: die Ende-zu-Ende-Belege aus 8.3 und
                                          10.5/10.8 sind HTTP-Antworten der Functions. Der Serverweg ist gemessen,
                                          der Browserweg nie. Dieselbe Klasse wie die zwei Blocker vom 06.08. —
                                          die Prüfung bestand, weil sie die falsche Fläche traf._
                                          **Behoben 07.08.**, rot vorher / grün nachher gemessen: `CORS`-Konstante,
                                          `OPTIONS`-Zweig und Header auf **jeder** Antwort (auch den Fehlerfällen —
                                          sonst kann der Browser die Meldung nicht lesen). `deno check` grün,
                                          deployt gegen `foelowldexkcqzewvrcf`. `OPTIONS` → `200` mit `ACAO: *` und
                                          `ACAH`; `POST send-activation` → `202` **mit** `ACAO`. Der zweite Wert
                                          zählt mehr: ein bestandener Preflight allein reicht nicht.
                                          _Grenze der Messung: mit `curl` gemacht, und `curl` erzwingt CORS nicht.
                                          Belegt ist die Serverseite vollständig — der Client-Pfad durch
                                          `functions.invoke` nicht. Ein echter Klick bleibt Teil von 10.4._
                                          **Client-Pfad nachgeholt 07.08., im Browser:** Klick auf „Neuen Link
                                          senden" auf `/aktivierung` → Preflight `OPTIONS …/send-activation`
                                          `200` **und** der Erfolgszweig der Oberfläche. Der zweite Teil ist der
                                          Beweis: bei Fehler wirft `activation.ts:88`, dann stünde dort der
                                          Fehlerzweig. Adresse `…@example.invalid` — keine Mail ausgelöst.
                                          **Die zwei restlichen Wege nachgeholt 07.08.**, mit Testkonto
                                          `donald.vlahovic@gmail.com` (angemeldet, `activated_at` per Hand auf
                                          `null`). `resend-activation`: Preflight `OPTIONS` → `200`,
                                          Erfolgszweig „Der Link ist unterwegs" **und** Knopfsperre „Erneut
                                          senden in 58 s", dazu serverseitig ein neues Token um
                                          `2026-08-07T12:17:17.915Z`, und die Mail kam an. Damit ist der
                                          Gateway-Pfad **mit** JWT-Prüfung gedeckt.
                                          `redeem-activation`: `used_at 12:20:43.278Z` und
                                          `profiles.activated_at` auf dieselbe Sekunde, Bildschirm davor
                                          „Passwort festlegen" / danach `/login` (der vorgesehene Ausgang,
                                          `ActivationRedeemPage.tsx:66-70`).
                                          _Grenze, und sie bleibt: für `redeem-activation` gibt es **keinen
                                          Netzwerkbeleg** — der Mitschnitt stand danach beide Male leer, Ursache
                                          ungeklärt. Der Weg trägt über zwei Zeitstempel und zwei Bildschirme,
                                          nicht über einen Statuscode._
                                          → **B2 (Vorbedingung von C10) ist am 07.08. geschlossen**: die drei
                                          Functions liegen jetzt auch auf `viwntbodrtqxgmqyxluh`, mit
                                          DEV-gleichem `ezbr_sha256` und bestandenem Preflight. Messung in
                                          `REVIEW-8.7.md`, Vorbedingung (f) in 11.2.

                                          **Die zentrale Zusage hält.** Der RLS-Reviewer hat den Endzustand aller
                                          Migrationen nachgespielt statt nur den Diff: 52 lebende Policies, 46
                                          gegatet, keine permissive Altpolicy überlebt (Policies ODERn — das wäre
                                          die gefährlichste Ausfallform gewesen), alle 31 DEFINER-Funktionen mit
                                          gesetztem `search_path`, `activated_at` client-seitig nicht schreibbar,
                                          `activation_tokens` ohne Policy und ohne Grant. An **fremde**
                                          Mitgliederdaten kommt ein nicht aktiviertes Konto nicht.

- [x] 8.8 `run-plan-review.sh` erneut, gegen die überarbeiteten Artefakte.
      _Gefahren 06.08. mit codex, opencode und gemini (AGENT_SELF=claude, also
      drei Fremdanbieter). Ergebnis 2× REQUEST-CHANGES, 1× APPROVE. Triage
      vollständig in **Block 14**: vier Punkte behoben, einer widerlegt, fünf
      als Entscheidung offen. `REVIEWS.md` trägt den Volltext._

## 9. Mailtext

- [x] 9.1 Entwurf aus `design.md` an Detlev, als **Entwurf**.
- [x] 9.2 Nach der Abstimmung in `emails.ts` einpflegen; `emails.test.ts` prüft
      Struktur, nicht Wortlaut, damit eine Textänderung nicht rot wird.
      _**Aus C3 herausgenommen, 2026-08-09 (Donald).** Der ausgelieferte Text ist
      in Ordnung und geht so live — er ist an zwei echten Mails belegt (10.8).
      Die Abstimmung mit Detlev ist damit kein Bestandteil dieses Changes mehr,
      sondern ein eigener, kleiner Change im Backlog. `emails.test.ts` prüft
      ohnehin Struktur statt Wortlaut, eine spätere Textänderung wird also nicht
      rot._

## 10. Deploy — Haltepunkt, Donalds Freigabe

- [x] 10.1 Migrationen auf DEV: `pnpm db:push`. Zielprojekt vorher ausgeben.
- [x] 10.2 Functions auf DEV deployen, echten Versand an eine eigene Adresse
      prüfen.
      _Deploy-Hälfte erledigt 06.08.: `send-activation`, `resend-activation` und
      `redeem-activation` sind auf `foelowldexkcqzewvrcf` **ACTIVE** (je v1), und
      `verify_jwt` deckt sich mit `config.toml` — false / true / false.
      `APP_URL`, `FROM_EMAIL`, `RESEND_API_KEY` liegen. Gegen die live
      deployten Endpunkte gemessen (nicht im Code gelesen): unbekannte Adresse →
      `202 {"accepted":true}`, erfundenes Token → `410 {"status":"not_found"}`,
      vierstelliges Passwort → `400 {"status":"weak_password","minLength":10}`,
      `resend-activation` ohne Sitzung → `401` vom Gateway.
      Testkonto `donald@vlahovic.de` (Selbstregistrierung, `basic`,
      `activated_at = null`) am 06.08. angelegt; dabei nebenbei belegt:
      `my_activation_state()` liefert mit echter Sitzung genau zwei Felder
      (`activated:false`, Anzeigename), `resend-activation` antwortet innerhalb
      der Minute `rate_limited` (die 60-s-Sperre aus 4.4, zur Laufzeit
      gemessen) und danach `issued`.
      **Der erste Versandversuch scheiterte** (10.5, Resend-Sandkasten). Nach der
      Domainverifikation am selben Tag wiederholt: `resend-activation` →
      `200 {"status":"issued"}`, und die Mail ist bei `donald@vlahovic.de`
      **angekommen** (von Donald bestätigt). Damit ist der Versandweg zum ersten
      Mal Ende zu Ende gegangen._
- [x] 10.8 **ZWEITER BLOCKER, gefunden am 06.08. beim ersten echten Versand:
      `APP_URL` steht auf `http://localhost:5173`.** Gemessen, nicht vermutet —
      der Wert ist der Hash aus `supabase secrets list` gegen Kandidaten geprüft,
      und der Link in der zugestellten Mail lautete
      `http://localhost:5173/aktivierung#token=…`. Jede Aktivierungsmail an ein
      importiertes Mitglied verlinkt damit auf dessen **eigenen Rechner**.
      Dieselbe Klasse wie 10.5: der Versand meldet Erfolg, der Weg endet im
      Nichts.
      **Reicht über diesen Change hinaus:** `APP_URL` speist auch
      `notify-contact-request` (`index.ts:89`) — die „Zum Chat"-Links in den
      Kontaktanfrage-Mails zeigen seit jeher auf localhost. Eigener Nachlauf.
      Ebenfalls auffällig: `APP_URLS` (Stripe-Rücksprung-Allowlist) lautet
      `http://localhost:5173,https://fbc-platform.pages.dev` — localhost an
      erster Stelle, auf dem Projekt der Live-Seite.
      **Richtiger Wert steht schon in `config.toml`:**
      `site_url = "https://fbc-platform.pages.dev"`. Behebung:
      `supabase secrets set APP_URL="https://fbc-platform.pages.dev"
--project-ref foelowldexkcqzewvrcf` — und Infisical nachziehen, sonst
      kehrt der Wert beim nächsten Sync zurück. **Vorbedingung von C10**, wie
      10.5.
      _Ursache vermutlich die dev==prod-Falle: `env=dev` teilt sich die
      Supabase-Instanz mit prod, also setzt ein für lokales Testen gesetzter
      Wert zugleich die Live-Seite. Wer künftig lokal testen will, überschreibt
      `APP_URL` lokal statt im Projekt-Secret._
      **Behoben 06.08.** auf beiden Flächen: `supabase secrets set` gegen
      `foelowldexkcqzewvrcf` und `infisical secrets set … --env=dev`. Über den
      SHA-256 aus `supabase secrets list` gegengeprüft — `APP_URL` und
      `FROM_EMAIL` stimmen jetzt mit den Sollwerten überein. `APP_URL` wird zur
      Laufzeit gelesen, ein Deploy war nicht nötig.
      **Nachgemessen an einer echten Mail** (06.08., zweites Wegwerfkonto
      `donald.vlahovic@gmail.com`, weil das erste inzwischen aktiviert ist und
      nach 4.6 keine Mail mehr bekommt): der Link lautet jetzt
      `https://fbc-platform.pages.dev/aktivierung#token=…`, Absender und
      `Reply-To` stimmen, die Mail landete im Posteingang. `--env=prod` und das
      PROD-Projekt sind ebenfalls geprüft (siehe 10.3).
      _**Am Rohtext der zugestellten Mail belegt** (`.eml`, von Donald
      beigebracht), nicht mehr nur erschlossen. Googles Hop:
      `dkim=pass header.i=@effbeezee.com header.s=resend` ·
      `spf=pass (domain of …@send.effbeezee.com designates 54.240.6.53 as
permitted sender)` · `dmarc=pass (p=REJECT sp=REJECT dis=NONE)
header.from=effbeezee.com`. Fastmail bestätigt dasselbe unabhängig auf
      einem zweiten Hop. Der `send.`-Subdomain-SPF greift also genau wie
      eingerichtet, und `Reply-To: info@fairbusinessclub.de` steht im Header —
      die Zusage auf dem Aktivierungsbildschirm ist damit gemessen, nicht
      behauptet. Der Link im Text lautet
      `https://fbc-platform.pages.dev/aktivierung#token=…`._
      **Weiter offen:** `APP_URLS` führt localhost an erster Stelle
      (Stripe-Rücksprung, eigener Nachlauf — bewusst nicht ungefragt an der
      Bezahlstrecke gedreht).
      _Der Blocker selbst ist seit dem 06.08. behoben und an einer echten Mail
      gemessen; das Häkchen stand nur wegen dieses Restes aus. Er liegt seit
      2026-08-09 als **AGE-519** im Backlog und bleibt damit sichtbar, ohne C3
      offen zu halten._

- [x] 10.3 **Erst nach Freigabe:** `pnpm db:push:prod`, Functions auf PROD,
      Secrets auf PROD prüfen.
      _**Aus C3 herausgenommen, 2026-08-09 (Donald), ins Backlog.** Begründung:
      das Projekt namens PROD ist leer, und die Live-Seite läuft gewollt gegen
      `foelowldexkcqzewvrcf` — dort sind Migrationen und Functions seit dem
      06.08. deployt (10.1/10.2). Der PROD-Deploy ist damit kein Haltepunkt
      dieses Changes, sondern Vorarbeit für eine spätere Umschaltung. **Der
      offene CRITICAL wandert mit** und bleibt offen: Stripe- und
      `RESEND_API_KEY`-Werte sind zwischen den Projekten byte-identisch; das
      braucht Donald im Stripe-Dashboard und ist als eigenes Issue erfasst._
      _Merge ≠ live: `deploy.yml` deployt nur das Frontend._
      _Am 06.08. abends ausgezählt statt geschätzt: **12 von 22** gemeinsamen
      Secrets sind byte-identisch, 10 getrennt — aber die 10 sind fast alle die
      projektgebundenen `SUPABASE_*`-Werte, die gar nicht gleich sein können.
      Bewusst getrennt sind genau drei: `APP_URLS`, `CONTACT_WEBHOOK_SECRET`,
      `FROM_EMAIL`. Jedes von Hand gepflegte geteilte Secret ist also geteilt —
      Stripe vollständig und `RESEND_API_KEY`. Das ist der offene CRITICAL und
      braucht Donald im Stripe-Dashboard. `APP_URL` ist seit dem 06.08.
      absichtlich gleich (dieselbe App-URL), kein Befund._
      **Ein konkreter Fund, noch am selben Abend behoben:** `FROM_EMAIL` auf
      PROD stand noch auf `FBC <onboarding@resend.dev>` — dem Sandkasten aus
      10.5. Folgenlos, weil dort keine Aktivierungs-Functions deployt sind;
      ungeprüft übernommen hätte 10.3 den Blocker aber exakt wiederholt.
      Gesetzt und per Hash gegengeprüft: `FROM_EMAIL` und `APP_URL` stimmen auf
      **beiden** Projekten mit den Sollwerten überein.
      _Die Lehre daraus ist die wichtigere: **Infisical zu setzen schiebt nichts
      ins Supabase-Projekt.** Das sind zwei getrennte Flächen, und genau deshalb
      sah am Morgen alles gesetzt aus, während die Live-Functions den Sandkasten
      benutzten. Wer einen Function-Wert ändert, muss beide anfassen — und die
      Prüfung ist der Digest-Vergleich, nicht der Blick in Infisical._
- [x] 10.4 Zustell-Abnahme bei GMX, Web.de, Gmail, Outlook. **Hängt an AGE-256**
      (SPF/DKIM). Blockiert die Abnahme des Versands, nicht den Sicherheitskern.
      _Der zweite Satz war zu milde formuliert — siehe 10.5. Es geht nicht um
      Zustellqualität, sondern darum, dass gar nicht erst gesendet wird._
      _Stand 06.08.: **Gmail zur Hälfte, die anderen drei gar nicht.** Zwei
      Zustellungen sind belegt (`donald@vlahovic.de`, `donald.vlahovic@gmail.com`).
      Die zweite ist mehr wert als zunächst gedacht: der `Return-Path`
      (`donald.vlahovic+caf_=donald=vlahovic.net@gmail.com`) zeigt, dass **Gmail
      die Mail angenommen, authentifiziert (`dmarc=pass`, s. 10.8) und
      weitergeleitet** hat — sie landete danach bei Fastmail. Damit ist Gmails
      **Annahme** gemessen, seine **Platzierung** nicht: ob sie in einem echten
      Gmail-Postfach im Eingang oder im Spam läge, sagt eine Weiterleitung
      nicht. GMX, Web.de und Outlook sind unberührt. Und das eigentliche Risiko
      liegt ohnehin nicht bei der Authentifizierung — die steht —, sondern bei
      der **Reputation einer neuen, ungewärmten Absenderdomain**, die beim
      Import auf einen Schlag an alle Mitglieder sendet._
      _**Geschlossen 2026-08-09 (Donald) mit dem, was belegt ist — und nur
      damit.** Belegt: DKIM, SPF und DMARC bestehen an zwei unabhängigen Hops
      (10.8), Gmail hat angenommen und weitergeleitet, zwei echte Zustellungen
      liegen vor. **Nicht belegt und ausdrücklich nicht behauptet:** die
      Platzierung bei GMX, Web.de und Outlook, und die Platzierung in einem
      echten Gmail-Postfach. Diese Prüfung wandert dorthin, wo auch ihr eigentliches
      Risiko liegt — **AGE-256**, Reputation und Aufwärmen der Absenderdomain vor
      dem Import. Der Grund, es hier zu schließen: drei weitere Postfächer
      abzunehmen hieße drei weitere Wegwerf-Konten in der Live-Datenbank
      anzulegen (es liegen schon zwei), und das Ergebnis hinge trotzdem an der
      Aufwärmphase, die C3 nicht leistet._

- [x] 10.5 **GESCHLOSSEN 06.08. — war ein BLOCKER, gefunden am 06.08. beim ersten echten Versuch (10.2):
      der Aktivierungsweg kann an kein Mitglied eine Mail schicken.**
      `FROM_EMAIL` steht auf Resends Sandkasten-Absender `onboarding@resend.dev`
      — `docs/secrets.md:209-212` führt das ausdrücklich als Übergang, „swap in
      the real domain once it's set up". Von diesem Absender lässt Resend
      **ausschließlich** Mail an die Adresse des Resend-Kontoinhabers zu, jede
      andere Empfängeradresse wird mit `403` abgewiesen
      (<https://resend.com/docs/knowledge-base/403-error-resend-dev-domain>).
      Gemessen: `resend-activation` an `donald@vlahovic.de` antwortet
      `502 {"status":"send_failed"}`, und `send-activation` an dieselbe Adresse
      hat `202` geliefert (Anti-Aufzählung, unabhängig vom Versandergebnis)
      ohne dass eine Mail ankam.
      Bestätigend im DNS: `fairbusinessclub.de` trägt
      `v=spf1 include:spf.protection.outlook.com -all` — nur Microsoft 365 darf
      senden, `-all` ist ein harter Fehlschlag für alles andere — und
      `resend._domainkey.fairbusinessclub.de` existiert nicht. Die Domain ist in
      Resend also nicht verifiziert.
      **Tragweite: das ist ein Startblocker, kein Nachlauf.** Bei importierten
      Konten ist das Aktivierungs-Gate die einzige Hürde, und der einzige Weg
      hindurch ist diese Mail. Liefe C10 heute, bekämen alle importierten
      Mitglieder ein gesperrtes Konto und keinen Link. **Der Import darf erst
      nach einer in Resend verifizierten Absenderdomain laufen** — damit ist
      AGE-256 keine Nebenbedingung von 10.4 mehr, sondern Vorbedingung von C10.
      Gehört als vierte Vorbedingung in 11.2.

- [x] 10.6 **Absenderdomain entschieden (Donald/Detlev, 06.08.): `effbeezee.com`,
      `FROM_EMAIL = "FBC <noreply@effbeezee.com>"`.** Gewählt, weil sie auf
      Strato-NS liegt und Donald sie selbst pflegen kann; `fairbusinessclub.de`
      liegt auf Cloudflare-NS, an das nur der Betreuer der WordPress-Seite kommt.
      Nachgemessen vor der Umstellung: Apex ohne SPF, `resend._domainkey` und
      `send` frei — keine Kollision.
      **Zwei Eigenschaften, die die Einrichtung beachten muss:**
      (a) `_dmarc.effbeezee.com` trägt bereits `v=DMARC1;p=reject;` — Resends
      optionalen DMARC-Eintrag **nicht** anlegen (zwei Einträge auf einem Namen
      machen DMARC ungültig), und `reject` heißt: ein vertippter DKIM-Key ist
      kein Spam-Ordner, sondern ein Bounce. (b) Die Domain hat einen
      **Wildcard** (`*.effbeezee.com` antwortet mit Stratos MX) — unter `send.`
      **beide** Einträge setzen, denn sobald dort irgendein Eintrag existiert,
      greift der Wildcard für diesen Namen nicht mehr.
      **Im Code nachgezogen:** `ActivationScreen` kündigt den Absender an und
      nennt getrennt davon den Rückkanal (vorher rot gemessen, Test
      „kündigt den Absender an und nennt getrennt davon den Rückkanal");
      beide Functions setzen `Reply-To: info@fairbusinessclub.de`, weil der
      Bildschirm dem Mitglied eine ankommende Antwort zusagt; `docs/secrets.md`
      korrigiert — der Sandkasten-Hinweis stand dort als Empfehlung.
      _**Korrigiert 06.08. abends:** hier stand, der Absender liege „auf einer
      anderen Domain als der Auftritt des Clubs", und daraus folgte eine
      Phishing-Warnung. Das war falsch. Die Plattform heißt **eff.bee.zee** —
      `send-activation/emails.ts:63,82` führen den Namen im Betreff und im Text
      selbst ein, seit langem. `effbeezee.com` ist die ausgeschriebene Marke,
      nicht eine fremde Domain. Der Bildschirmtext, der sich dafür
      entschuldigte („die Adresse sieht ungewohnt aus"), ist entfernt: er
      untergrub genau die Marke, die die Mail einführt.
      Was bleibt, gilt unabhängig davon: der Absender gehört auf den Bildschirm.
      Bei importierten Konten ist diese Mail der einzige Weg hinein, und einen
      Absender, den niemand angekündigt hat, erkennt das Mitglied nicht wieder —
      deshalb steht die Adresse wörtlich dort, und deshalb ist der Test darauf
      kein Textdetail. Empfohlen und offen bleibt eine Weiterleitung
      `effbeezee.com` → `fairbusinessclub.de`: wer den Absender prüft, landet
      heute auf einer Strato-Platzhalterseite statt beim Club._

- [x] 10.7 Nach dem Setzen der DNS-Einträge: `FROM_EMAIL` in Infisical **und**
      per `supabase secrets set` auf `FBC <noreply@effbeezee.com>` ziehen, beide
      Functions neu deployen (der Absender steckt nicht im Bundle, das Reply-To
      schon), dann den Versand an `donald@vlahovic.de` wiederholen. Erst wenn
      dort eine Mail ankommt, ist 10.2 zu — `202` von `send-activation` belegt
      bauartbedingt nichts, der ehrliche Status kommt von `resend-activation`.

## 11. Nachläufe, die dieser Change nicht schließt

_**2026-08-09:** Die Häkchen hier bedeuten „hat einen Besitzer", nicht „ist
erledigt". 11.1–11.4 liegen als **AGE-520** im Backlog, 11.7 ist als eigener
Change **`password-reset-flow`** (AGE-505) längst in Arbeit. Der Abschnitt heißt
seit jeher „Nachläufe, die dieser Change nicht schließt" — offen zu bleiben war
nie seine Aufgabe, einen Ort zu bekommen schon._

- [x] 11.1 `security_update_password_require_reauthentication` auf PROD: soll er
      `true` werden? **Ungemessen** — die Einstellung wirkt laut Supabase nur,
      wenn der Login nicht „kürzlich" war, und der Angreifer hat sich gerade
      angemeldet. Der Messversuch auf DEV wurde vom Berechtigungs-Classifier
      abgelehnt. Eigenes Issue, mit der Messung als erstem Schritt.
- [x] 11.2 C10 trägt **fünf** Vorbedingungen — im Import-Issue vermerken, nicht
      nur hier: (a) Migration A läuft vorher (1.9), (b) der Import stößt den
      Aktivierungsversand direkt an, damit der Weg des Mitglieds das
      Default-Passwort nicht berührt, (c) deterministisches Verhalten, wenn eine
      Adresse durch Selbstregistrierung bereits belegt ist — ein vorab besetztes
      Konto darf nicht durch bloße Adressgleichheit zum Mitgliedskonto werden
      (codex), und (d) **in Resend ist eine eigene Absenderdomain verifiziert**
      (10.5) — sonst schlägt jeder Aktivierungsversand fehl und der Import
      erzeugt lauter gesperrte Konten ohne Weg hinein —, und (e) **`APP_URL`
      zeigt nicht auf localhost** (10.8), sonst verlinkt jede Mail auf den
      Rechner des Empfängers, und (f) **die drei Aktivierungs-Functions liegen
      auf dem Projekt, auf das das Frontend zeigt** (B2).
      _(f) ist am 07.08. erfüllt worden. Die Merkregel, die hier stand — „nichts
      rollt Edge Functions automatisch aus, jede spätere Änderung muss beide
      Projekte von Hand anfassen" —, ist **durch AGE-506 ersetzt**: der Job
      `functions` in `deploy.yml` liefert die geänderten Functions bei jedem
      Merge auf beide Projekte aus und liest danach `supabase functions list`
      nach. Sie steht hier nicht mehr als Regel, sondern als Hinweis, woher der
      Zustand kommt — zwei Wahrheiten nebeneinander wären schlimmer als keine.
      **Solange AGE-506 nicht gemergt ist, gilt die alte Regel weiter.**_
      _Und eine Buchhaltungssache, die sonst beim Import Verwirrung stiftet: auf
      `foelowldexkcqzewvrcf` steht seit dem 06.08. ein **Wegwerf-Testkonto**
      `donald@vlahovic.de` („Donald (Testkonto AGE-495)", `basic`, inzwischen
      aktiviert und damit im Verzeichnis sichtbar). Entscheidung Donald: bleibt
      stehen. Es ist **kein Mitglied** — und es zählt in die 50er-Gesamtschwelle
      der Tripwire aus 1.7 (nicht in die 20er auf `impact`). Wer die Schwelle
      vor dem Import festschreibt (12.1), muss es abziehen._
      _Seit dem 07.08. steht dort ein **zweites**: `donald.vlahovic@gmail.com`
      („Donald (Testkonto 2, Linkprüfung)", `basic`, aktiviert am 07.08. um
      12:20:43 Z durch die Messung der beiden restlichen Wege). Gilt dasselbe:
      kein Mitglied, zählt in die 50er-Schwelle, beim Festschreiben abziehen —
      also **zwei** Konten, nicht eins._
- [x] 11.4 **`notify-contact-request` ist auf PROD ein älterer Stand** — beim
      B2-Deploy am 07.08. nebenbei gemessen, nicht gesucht: `ezbr_sha256`
      `6c0358f462eb` auf `viwntbodrtqxgmqyxluh` gegen `046dfb9d9619` auf
      `foelowldexkcqzewvrcf`. Bewusst **nicht** mitgezogen — der Auftrag war B2,
      und die Function hängt am Webhook-Trigger, der pro Projekt von Hand
      angelegt wird (`docs/supabase-environments.md`, „Objekte, die bewusst
      keine Migration sind"). Vor dem Umzug klären, welcher Stand der richtige
      ist; blind angleichen wäre hier die falsche Bewegung.
- [x] 11.3 `avatars`-Bucket privat stellen? Eigener Change mit Folgen für jede
      Bild-URL im Frontend (`INVENTORY.md`, Abschnitt C). Heute kein Weg für ein
      nicht aktiviertes Konto, die URLs überhaupt zu erfahren.
- [x] 11.5 **Kein Befund — das Cloudflare-Deployment läuft absichtlich gegen
      DEV** (P1 in `REVIEW-8.7.md`). Am 07.08. als operativer Befund notiert und
      von Donald am selben Tag aufgelöst: das Live-Deployment zeigt bewusst auf
      `foelowldexkcqzewvrcf`, die PROD-Datenbank ist derzeit nur über einen
      lokalen Dev-Server erreichbar, und in PROD stehen noch keine Daten — die
      Demo-Konten liegen deshalb dort, wo das Deployment hinzeigt. Festgehalten,
      damit die Beobachtung nicht ein zweites Mal als Fehler aufschlägt.
      _Was daraus bleibt, ist eine Sprachregelung, keine Aufgabe: „auf PROD
      gemessen" ist doppeldeutig, solange Projektname und benutzte Umgebung
      auseinanderfallen. Jede Messnotiz nennt den **Ref**._
- [x] 11.6 **Der anonyme Weg schweigt 24 h und sieht dabei aus wie Erfolg** (P2).
      Offenes Token unter 24 h → `issue_activation_token` gibt `pending`, es geht
      **keine Mail** raus, aber `send-activation` antwortet `202` und
      `/aktivierung` zeigt dieselbe grüne Meldung wie im Erfolgsfall. Wer die
      erste Mail nicht bekam, wartet bis zu einen Tag auf nichts. Das
      Schutzfenster selbst ist richtig — zu ändern ist die Oberfläche. Gehört mit
      E1 zusammen entschieden, nicht einzeln.
      _Entschieden 07.08. (Donald), Variante A+B′ — **beides zusammen**, weil P2
      und E1 derselbe Mechanismus von zwei Seiten sind. **B′ (die Ursache):**
      schlägt Resend nach der 202-Antwort fehl, entwertet `send-activation` sein
      eigenes Token (`20260807190000`, neuer RPC `invalidate_activation_token`,
      nur `service_role`). Aus 24 Stunden Schweigen wird die 60-s-Sperre.
      **A (die Meldung):** `ActivationRedeemPage.tsx:233` deckt jetzt alle drei
      Ausgänge ab — Absender, „ein Link aus den letzten 24 h gilt weiter",
      Rückkanal — ohne sie zu unterscheiden.
      **Nicht gewählt:** das Schutzfenster in eine Drossel umbauen. Hätte die
      zwei gegensätzlichen Knöpfe angeglichen, aber die Aussperrung vom 06.08.
      wieder geöffnet. Begründung steht im Migrationskopf.
      **Nicht angefasst:** `ActivationScreen.tsx:80`.
      `request_own_activation_token` (`20260806090000:108-114`) entwertet und
      gibt immer neu aus, hat also gar kein Schutzfenster — dort ist „Der Link
      ist unterwegs" wahr.
      **Gemessen, nicht behauptet:** pgTAP rot (`function
"public.invalidate_activation_token(text)" does not exist`) → grün
      (`Files=3, Tests=190, Result: PASS`, neun neue Assertions in `rls_test.sql`
      §14b-bis); Vitest rot (`Expected /letzten 24 Stunden/`) → grün (427/427).
      **Offen bleibt:** `index.ts` hat keine eigene Testdatei — der Fehlerzweig
      ist über den RPC belegt, die zwei Zeilen Verdrahtung sind es nicht.
      **E2 ist NICHT erledigt:** `resend-activation` entwertet weiter vor dem
      Senden; derselbe Fehlschlag kostet dort den alten Link._
      _**Nachgetragen 08.08.:** E2 ist inzwischen erledigt — siehe 11.8. Dabei
      zeigte sich, dass dieser Satz den Befund verfehlte: der teurere Schaden
      war nicht der verlorene alte Link, sondern das liegengebliebene Token, mit
      dem der Fehlversand hier den anonymen Weg 24 h lang zusperrte. Genau der
      Schaden, den 11.6 für den anderen Weg schloss._
      _**Nachgezogen nach dem Code-Review vom 07.08.** (zwei Befunde):_
      _(1) **Der `catch`-Zweig entwertet nicht mehr.** Ein `!res.ok` ist eine
      Ablehnung — nichts ging raus, das Token ist wertlos. Ein Wurf trifft auch
      den Fall, dass die ANTWORT verlorengeht, nachdem Resend die Mail
      angenommen und zugestellt hat; dort hielte das Mitglied sonst eine echte
      Mail in der Hand, deren Link „überholt" meldet. Ein zugestellter Link ist
      mehr wert als ein geschlossenes Schutzfenster. Preis, benannt: für diesen
      selteneren Fall bleibt E1 bestehen, deshalb `warn` statt stillschweigen.
      Spec-Delta und Szenario sind mitgezogen._
      _(2) **Deploy-Pflicht, die im PR fehlte.** Diese Änderung fasst
      `send-activation` an. Nach 11.2 (f) muss sie auf **beide** Projekte
      deployt werden — `supabase functions deploy send-activation` gegen
      `foelowldexkcqzewvrcf` UND `viwntbodrtqxgmqyxluh`, geprüft über den
      `ezbr_sha256`-Vergleich aus `supabase functions list`. Ohne das läuft nach
      dem Merge weiter der alte Build, während die Migration schon da ist._
- [x] 11.7 **Es gibt keinen „Passwort vergessen"-Weg** (P3). `rg
'resetPasswordForEmail|forgot|reset-password' src` findet nichts. Für nicht
      aktivierte Konten deckt `/aktivierung` das ab; für **aktivierte** nicht —
      dort antwortet `issue_activation_token` `already_activated`, verschickt
      nichts, und die Oberfläche meldet trotzdem Erfolg
      (`ActivationRedeemPage.tsx:80-82` setzt `setAngefordert(true)` im
      `finally`). Nach C10 ist „aktiviert" der Normalfall. Eigene Anforderung,
      nicht Teil dieses Changes.
- [x] 11.8 **Der Fehlversand auf dem angemeldeten Weg sperrt den anonymen zu**
      (E2). `resend-activation` entwertet über `request_own_activation_token`
      und gibt neu aus, **bevor** es sendet. Lehnt Resend ab, antwortet die
      Function zwar ehrlich mit 502 — aber das neue Token bleibt **offen und
      gültig** liegen, und damit sieht das Schutzfenster von
      `issue_activation_token` (`20260806090000:190-201`) ein ausstehendes
      Token: der sitzungsfreie Rückfallweg auf `/aktivierung` antwortet bis zu
      24 Stunden lang `pending` — kein Versand, kein neues Token, und die
      Oberfläche meldet dabei dasselbe Grün wie im Erfolgsfall. **Das ist der
      Befund, nicht der 502.** Er stand so weder in Review 8.7 noch in der
      Handoff-Notiz; beide beschrieben nur den lauten Teil.
      _Entschieden 08.08. (Donald), Variante B — **nur entwerten**, kein
      Zurückholen: bei `!res.ok` ruft `resend-activation` das vorhandene
      `invalidate_activation_token`. **Keine Migration, kein neuer RPC, kein
      neuer Grant** — der RPC ist seit `20260807190000` da. Nötig ist dafür ein
      **zweiter** Client mit Service-Role-Key: der bestehende trägt das
      User-JWT, weil `auth.uid()` in `request_own_activation_token` auflösen
      muss, und `invalidate_activation_token` ist `service_role`-only, weil sie
      für `authenticated` aufrufbar selbst der Aussperrungsweg wäre._
      _**Nicht gewählt:** den überholten Link zurückholen (`invalidated_at`
      wieder auf `null`, die Handoff-Variante A). Sie hätte auch den lauten
      Schaden geschlossen, verlangt aber eine Zustandsumkehr, die es im System
      sonst nirgends gibt — `invalidated_at` ist überall Einbahnstraße — und der
      Nutzen ist gering: Wer einen neuen Link anfordert, tut es, weil ihm der
      alte nicht vorliegt. **Offen bleibt damit ausdrücklich:** der überholte
      Link im Postfach bleibt tot. Benannt im Code, im Spec-Delta und hier._
      _**Der `catch`-Zweig entwertet nicht**, gleiche Begründung wie bei E1
      (11.6): ein `!res.ok` ist eine Ablehnung, ein Wurf trifft auch den Fall,
      dass die Antwort verlorenging, nachdem Resend zugestellt hat._
      _**Gemessen, nicht behauptet** — `scripts/probe-e2-resend-fehlversand.ts`
      gegen DEV, echter Resend-Fehlversand an eine `@example.com`-Adresse,
      nichts gemockt. Die Sonde bricht laut ab, wenn Resend die Adresse doch
      annimmt, statt einen grünen Lauf vorzutäuschen._
      _Rot (09:31 Uhr, vor dem Diff): `HTTP 502 / send_failed` · offene gültige
      Token **1** · `issue_activation_token` → **`pending`**._
      _Grün (09:48 Uhr, nach dem Deploy auf DEV): `HTTP 502 / send_failed` ·
      offene gültige Token **0** · `issue_activation_token` → **`issued`**._
      _Die zweite Zeile ist die Abnahme; die erste ist nur ihre Ursache._
      _**Deploy-Pflicht nach 11.2 (f):** diese Änderung fasst
      `resend-activation` an und muss auf **beide** Projekte. DEV ist für die
      Messung schon deployt; PROD übernimmt der `functions`-Job aus AGE-506 beim
      Merge._

## 12. Aus Review-Runde 3 offen — als Aufgabe festgehalten, nicht als Revision

Diese Punkte sind geprüft und anerkannt, aber nicht mehr in die Planungstexte
eingearbeitet (Entscheidung Donald, 2026-08-06: „nimm das als Task mit, was
offen ist"). Jeder wird **vor** der zugehörigen Umsetzung entschieden, nicht
währenddessen.

- [x] 12.1 **Der Stolperdraht aus 1.7 trägt so nicht** — zwei unabhängige
      Gründe. (a) opencode: er bricht bei **jeder** organischen
      Selbstregistrierung zwischen Messung und Deploy ab, weil er nur Profile
      zählt; er unterscheidet „C10 lief zu früh" nicht von „ein Fremder hat sich
      angemeldet". (b) codex: die Zahl **37 stammt aus dem C4-Audit gegen DEV** —
      PROD ist seit C4 ein frisches, leeres Projekt, dort ist sie sinnlos.
      **Vorschlag:** statt aller Profile die `impact`-Profile zählen —
      importierte sind `impact`, Selbstregistrierer `basic`. **Erst den
      PROD-Ausgangsbestand messen, dann den Grenzwert festschreiben.**
- [x] 12.2 **Der Backfill stempelt auch unbestätigte Altkonten** (opencode). Mit
      `enable_confirmations = false` kann unter den Bestandsprofilen jedes sein,
      das nie ein Postfach nachgewiesen hat; 1.8 winkt sie durch. Entweder als
      benannte Restfläche aufnehmen oder filtern — hängt daran, wie die
      DEV-Profile entstanden sind. Prüfen, bevor 1.8 geschrieben wird.
- [x] 12.3 **Der Sitzungswiderruf trägt weniger als zugesagt** (codex).
      `auth.admin.signOut` erwartet ein Access-JWT, keine Nutzer-ID — 5.2 ist so
      nicht implementierbar. Und ein bereits ausgegebener Access-Token bleibt
      zustandslos gültig bis zum Ablauf (`jwt_expiry = 3600`), kann also nach dem
      Stempel noch bis zu einer Stunde durchs Gate. Entweder `jwt_expiry` senken
      (PROD-`config.toml`) oder die `session_id` im Gate gegen `auth.sessions`
      prüfen (teuer, auf jeder Abfrage). **Bis dahin: benannte Restfläche mit
      Obergrenze, keine Zusage.**
- [x] 12.4 **Beanspruchtes Token ≠ aktiviertes Konto** (codex, opencode). Bricht
      es nach Schritt 1 oder 2 ab, steht `used_at` gesetzt und `activated_at`
      leer — die Meldung „dieses Konto ist schon aktiviert" wäre dann **falsch**.
      Eigener Zustand (`superseded` / `invalidated_at`) oder eine neutrale
      Meldung „dieser Link ist nicht mehr gültig, fordere einen neuen an", plus
      Szenario. Betrifft 5.5 und 6.5.
- [x] 12.5 **Zeitkanal beim Versand** (codex). Gleicher HTTP-Status genügt nicht:
      eine bestehende Adresse löst einen echten Mailversand aus und antwortet
      messbar langsamer als eine nicht bestehende — ein Orakel für
      Mitgliedsadressen. **Vorschlag:** sofort `202` antworten und erst danach
      versenden. Betrifft 4.2.
- [x] 12.6 **„Versuchsgedrosselt" hat kein Subjekt** (opencode). Auf einem
      sitzungsfreien Endpunkt ist unklar, wer der Aufrufer ist — IP (sperrt bei
      NAT das echte Mitglied mit aus), Fingerprint, Token-Präfix? Und anders als
      bei 4.4 ist kein instanzübergreifender Speicher genannt. Betrifft 5.6.
      _Entschieden 06.08. (Donald): **Subjekt ist die IP, gezählt werden aber
      ausschließlich Fehlversuche**, und die Zählung steht hinter dem
      Beanspruchen des Tokens. Damit fällt der NAT-Einwand weg — ein gültiges
      Token läuft nie in die Drossel — und ein gefälschter `x-forwarded-for`
      bleibt folgenlos, weil er einen Eimer füllt, der niemanden aussperrt. Der
      instanzübergreifende Speicher ist die Tabelle `activation_attempts`,
      dasselbe Muster wie bei 4.4 (die Datenbank, nicht der Function-Prozess).
      Verworfen: globaler Zähler ohne IP-Bezug (ein Fremder legte den Einlöseweg
      für alle still) und „gar nichts" (stimmt fürs Erraten, nicht für die
      Last)._
- [x] 12.7 **Bestehende Requirements widersprechen dem Delta** (codex). In
      `member-profiles` und benachbarten Capabilities sichern Requirements
      Eigentümern weiterhin Profil-, Kontakt-, Einstellungs- und Avatarzugriff
      **ohne** Aktivierungsvorbedingung zu. Sie müssen als MODIFIED auf
      „aktiviertes Mitglied" eingeschränkt werden, sonst ist die durable Spec
      nach dem Archivieren in sich widersprüchlich.
      _Nachgezogen 06.08.: vier Requirements als MODIFIED im
      `member-profiles`-Delta — „Full profile and extended data are gated by
      membership rank", „Contact data is disclosed only after an accepted
      contact request", „Private profile data is strictly owner-only",
      „Profile media is stored and gated per member". Jede Zusage gegen
      `20260806080100_activation_gate.sql` geprüft, nicht gegen die Taskliste._
- [x] 12.8 **„Genau eine privilegierte Funktion ohne Gate"** (codex) — die
      Formulierung im access-control-Delta widerspricht `INVENTORY.md` B2, wo 15
      bestehende Funktionen ungegatet bleiben. Auf die gemeinte Datenklasse
      eingrenzen, nicht auf eine Anzahl.
      _Umformuliert 06.08.: Das Gate trägt jede privilegierte Funktion, die
      **Mitgliederdaten liefert oder verändert**; nicht darunter fallen
      Funktionen über den eigenen Stand gegenüber der Plattform, plattformweite
      Merker und Funktionen ohne API-Rollen-EXECUTE. Die „genau zwei" gelten
      jetzt ausdrücklich **innerhalb dieser Datenklasse**. Die Booleans über
      einen bereits bekannten Fremdschlüssel stehen als benannte Restfläche
      drin, wie in `INVENTORY.md` B2._
- [x] 12.9 **`my_activation_state()` hat keine Grant-Regel in der Spec**
      (opencode). In 1.6 steht sie, im Delta nicht — und das
      Prädikat-Requirement verlangt EXECUTE-Entzug für `public`/`anon`.
      Nachziehen.
- [x] 12.10 **AGE-448 ist nicht „intakt", sondern verschoben** (opencode). Ein
      Gast registriert sich heute und ist sofort nutzbar; nach diesem Change muss
      er erst sein Postfach öffnen — auch für die Anmeldung zu einem öffentlichen
      Event, weil `register_for_event` gegatet ist. Vermutlich richtig so, aber
      es ist eine Verhaltensänderung und braucht ein eigenes Szenario statt der
      Behauptung. Vor dem Sommerfest mit Detlev klären.
      _**Entschieden 2026-08-09 (Donald): das Gate gewinnt.** Ein unbestätigtes
      Konto meldet sich zu nichts an, auch nicht zu einem öffentlichen Event.
      Begründung: die Alternative wäre **ein** ungegateter Schreibweg in
      Mitgliederdaten, und damit wäre das Gate eine Geschmacksfrage statt einer
      Grenze. Der Preis ist benannt — ein selbst registrierter Gast war bisher
      sofort nutzbar und muss jetzt erst sein Postfach öffnen. Die
      Verhaltensänderung steht damit **als Szenario** in den Deltas zu `events`
      und `directory-search` (siehe 14.8) und nicht mehr als Behauptung. Die
      Produktfrage selbst geht getrennt an Detlev (eigenes Issue im Backlog) und
      blockiert C3 nicht: sie kann die Entscheidung später umdrehen, ohne dass
      dieser Change offen bleiben muss._

## 13. Aus dem Sicherheits-Audit nachgezogen (8.5/8.6)

Drei Befunde aus dem Audit vom 2026-08-06, in derselben Sitzung behoben. Jeder
mit einem Test, der vorher rot war — der Punkt ist nicht der Diff, sondern der
Beleg, dass der beschriebene Angriff nicht mehr geht.

- [x] 13.1 **`/api/log`: `...props` überschrieb die geprüften Felder.** Die
      Allowlist prüft `event`, danach wurde `props` DARÜBER gespreizt — ein
      unauthentifizierter Aufruf konnte sich einen beliebigen Event-Namen,
      `source: "server"` und einen zurückdatierten Zeitstempel ins
      Axiom-Audit-Dataset schreiben. Spread vorgezogen
      (`functions/api/log.ts:92`). Neu: `functions/api/log.test.ts` (4 Tests)
      und `functions/**/*.test.ts` in der Vitest-`include` — die Pages
      Functions hatten bis hierher **kein** Testzuhause (der Deno-Job deckt nur
      `supabase/functions/`).
- [x] 13.2 **Sentry erfasste das Aktivierungs-Token im Fragment.**
      `getLocationHref()` strippt den Hash nicht, `replaysOnErrorSampleRate`
      steht auf 1.0, und aufgeräumt wurde erst beim Rendern der Einlöseseite —
      Hunderte Millisekunden zu spät. Die Entnahme sitzt jetzt in
      `src/lib/activation-fragment.ts` und läuft in `instrument.ts` **vor**
      `Sentry.init()`; `leseTokenAusFragment()` holt nur noch ab.
      `src/instrument.test.ts` misst nicht, DASS aufgeräumt wird, sondern WANN:
      die Adresszeile zum Zeitpunkt des `init`-Aufrufs. Ein Supabase-Auth-
      Fragment (`#access_token=…`) bleibt unangetastet — eigener Test.
- [x] 13.3 **`send-activation` konnte Mitglieder aussperren.** Unauthentifiziert,
      und jede Ausgabe entwertete den ausstehenden Link; fünf Aufrufe mit fremder
      Adresse leerten das Tageskontingent. Entscheidung Donald (06.08.):
      **die zwei Wege trennen**, statt IP-Drossel (sperrt hinter NAT das echte
      Mitglied mit aus) oder Turnstile (Reibung im Hauptweg). Verworfen ist auch
      „den gültigen Link nicht entwerten" als Alleinlösung: der Unique-Index
      `activation_tokens_offen_je_profil` erzwingt höchstens **ein** ausstehendes
      Token je Profil, und den alten erneut zu versenden geht nicht — gespeichert
      ist nur der Hash. - Migration `20260806090000_activation_self_request.sql`: neue RPC
      `request_own_activation_token` (Subjekt `auth.uid()`, kein
      Adressparameter, EXECUTE nur für `authenticated`), und
      `issue_activation_token` bekommt ein **24-Stunden-Schutzfenster** mit
      neuem Status `pending`. - Neue Function `resend-activation` mit `verify_jwt = true`; Mailtext aus
      `send-activation/emails.ts` geteilt, nicht kopiert. - `ActivationScreen` ruft `resendActivationLink()` ohne Adresse. - Belege: `rls_test.sql` Abschnitt 14b (+7 Assertions, Plan 133 → 140),
      `src/pages/ActivationScreen.test.tsx` (3 Tests). - Spec-Delta nachgezogen: „genau **eine** privilegierte Funktion" → zwei,
      enumeriert; „Der Versandweg SHALL für angemeldete und nicht angemeldete
      Aufrufer derselbe sein" ersetzt durch die Trennung plus das
      Nicht-Entwerten; zwei neue Szenarien. `openspec validate --all` grün.
- [x] 13.4 **Aus 8.6 nachgezogen** (06.08., zweite Runde). Details in
      `.gstack/security-reports/SECURITY.md`. - **`stripe-webhook` prüfte `payment_status` nicht.**
      `checkout.session.completed` heißt nicht „bezahlt": bei SEPA-Lastschrift
      und Überweisung feuert Stripe es sofort mit `payment_status: "unpaid"`.
      Ein Mitglied bekam die Stufe in dem Moment, in dem es den Kauf
      **anstößt**. `parseCheckoutCompleted` verlangt jetzt `paid` oder
      `no_payment_required`; ein fehlendes Feld gilt **nicht**. Drei neue
      Deno-Tests, zwei davon vorher rot. Der alte Test hatte gar kein
      `payment_status` im Fixture — er hätte den Fall nie gefunden. - **`notify-contact-request` prüfte `record` nicht gegen die Tabelle.**
      Das Shared Secret belegt „der Aufruf kommt vom Webhook", nicht „diese
      Zeile existiert". Wer es hat, wählte Empfänger, Absendername und
      **Nachrichtentext** frei — die Mail ging unter der Absenderadresse des
      Clubs raus. Neu: `passtZurDatenbank()` (id/from_id/to_id/status), 409
      statt 200 bei Abweichung, und der Nachrichtentext kommt jetzt aus der
      Datenbank statt aus dem Payload. Vier neue Deno-Tests, vorher rot. - **`public/_headers` gab es nicht.** Neu, mit `frame-ancestors 'none'`,
      `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS (2 Jahre, ohne
      `preload`) und `Permissions-Policy`. Dabei aufgefallen: **Task 6.4s
      `Referrer-Policy: no-referrer` auf `/aktivierung` war abgehakt, aber
      nirgends umgesetzt** — es gab keine Header-Datei. Steht jetzt drin. - **`.gitignore` ohne Schlüsselmuster.** `*.pem`, `*.key`, `id_rsa`,
      `service-account*.json` u. a. ergänzt; geprüft, dass keine getrackte
      Datei dadurch verschwindet.
- [x] 13.5 **Ins Backlog, 2026-08-09 (Donald)** — eigenes Issue, nicht Teil von
      C3. Der Befund selbst bleibt gültig: die **vollständige** CSP. `_headers` trägt
      nur `frame-ancestors` — die Direktive, die nichts brechen kann. `script-`,
      `connect-` (Supabase, Axiom, Sentry), `frame-` (YouTube, Vimeo), `img-`
      und `style-src` brauchen eine Messung im Browser davor, sonst bricht die
      Anwendung in Produktion still, während lokal alles läuft.
- [x] 13.6 **Ins Backlog, 2026-08-09 (Donald)** — eigenes Issue, wie hier schon
      vermerkt. **Rückstufung bei geplatzter Zahlung.** `apply_upgrade` ist bewusst
      nur-höher; eine widerrufene Lastschrift oder ein Chargeback stuft heute
      nicht zurück. Braucht einen eigenen Weg für `charge.dispute.created` /
      `invoice.payment_failed` — eigenes Issue, nicht Teil von C3.

## 14. Review-Runde 4 (Task 8.8, 2026-08-06)

`run-plan-review.sh` gegen die überarbeiteten Artefakte: **codex
REQUEST-CHANGES · opencode REQUEST-CHANGES · gemini APPROVE**. Volltext in
`REVIEWS.md`. Jeder Punkt unten ist **nachgemessen**, nicht übernommen.

### Behoben in derselben Sitzung

- [x] 14.1 **`design.md` Entscheidung 12 war stale** (alle drei Reviewer
      unabhängig). Sie beschrieb noch EINEN sitzungsfreien Weg für angemeldete
      wie ausgeloggte Aufrufer und begründete das mit „einfacher als zwei
      Zweige" — genau dieser eine Weg war die Aussperrung aus 13.3. Ersetzt
      durch die zwei Wege mit je einem Zweig, mit der widerlegten Begründung im
      Text statt gelöscht.
- [x] 14.2 **Drei unbelegte Zahlen** (opencode) — alle drei am 06.08.
      nachgemessen und alle drei falsch:
      `proposal.md:210` „`LoginPage` verlangt heute acht" → `LoginPage.tsx:15`
      verlangt seit 6.6 `min(10)`. ·
      `design.md` Entscheidung 6 „alle 47 Policies" → die eigene Rechnung
      (52 − 5 − 1) und `INVENTORY.md` A sagen beide **46**. ·
      `design.md` Entscheidung 14 „Tripwire über 37" → die Migration prüft
      `> 50` gesamt **oder** `> 20` auf `impact` (`20260806080000:139-158`).
- [x] 14.3 **Der Backfill-Widerspruch** (opencode). Das Requirement sagte
      unbedingt „Profile, die vor Einführung bestanden, SHALL als aktiviert
      gelten" — die Migration schränkt auf `email_confirmed_at` ein
      (`20260806080000:167`). Die Bedingung steht jetzt **im Requirement**, mit
      eigenem Szenario für das Bestandsprofil ohne Nachweis. Ebenso ist die
      Tripwire-Anforderung auf beide Schwellen ausgeschrieben.
- [x] 14.4 **Die Zusage zum Sitzungswiderruf war zu stark** (codex, deckt sich
      mit 12.3). Die Spec versprach, mit dem verteilten Passwort sei nichts mehr
      anzufangen; ein bereits ausgegebener, zustandsloser Zugriffs-Token trägt
      aber bis zu seinem Ablauf. Jetzt als benannte Restfläche mit Obergrenze im
      Requirement plus eigenem Szenario — die Zusage lautet „kein NEUER Zugang",
      nicht „jeder bestehende Zugriff endet sofort".

### Geprüft, trifft nicht zu

- [x] 14.5 **„Zwei Namen in der durable Spec"** (opencode). Trifft nicht: das
      access-control-Delta sagt „nur die Bestandskonten"; die Namen stehen in
      `tasks.md` 8.2b, also im Rollout-Protokoll — genau dort, wo der Reviewer
      sie haben will.

### Offen, Donalds Entscheidung

- [x] 14.6 **„Die Drossel drosselt nichts"** (opencode) — der schärfste Punkt,
      und er trifft die Entscheidung aus 12.6. Weil erst beansprucht und dann
      gezählt wird, kostet jeder Fehlversuch weiter eine Datenbankrunde; die
      Drossel **fügt** vor dem Limit sogar Arbeit hinzu (löschen, einfügen,
      zählen) und schaltet danach einen 429 davor, ohne die Arbeit zu sparen.
      Sie ist ein Zähler mit Bremslicht, keine Bremse. Das ist der **Preis** der
      gewählten Eigenschaft: „ein gültiges Token wird nie abgewiesen" verlangt,
      dass zuerst nachgesehen wird, ob es gültig ist. Wer wirklich Last sparen
      will, muss vor dem Beanspruchen sperren — und nimmt damit in Kauf, dass
      ein Mitglied hinter einer verbrannten Adresse mit gültigem Link abgewiesen
      wird. **Nicht einseitig geändert.** Zu entscheiden, welche der beiden
      Eigenschaften gilt; die Begründung in der Spec muss der Entscheidung
      folgen (heute sagt sie „Lastfläche", und das trägt nicht).
      _**Entschieden 2026-08-09 (Donald): die Eigenschaft bleibt, die Begründung
      geht.** „Ein gültiges Token wird niemals abgewiesen" gilt weiter; es wird
      also weiterhin erst beansprucht und dann gezählt. Kein Code, keine
      Migration — der Befund war nie ein Fehler im Ablauf, sondern eine
      Falschaussage über ihn. Geändert ist deshalb allein die Spec
      (`specs/access-control/spec.md`): „Lastfläche" ist raus, der Preis steht
      jetzt ausgeschrieben — die Zählung kostet vor der Grenze **mehr** Arbeit
      und spart sie dahinter nicht ein, sie verweigert die Antwort. Die Drossel
      heißt dort nun „Zähler mit Missbrauchssignal, weder Lastbremse noch
      Sicherheitsgrenze", und eine Sperre **vor** dem Beanspruchen ist
      ausdrücklich untersagt, solange die Zusage gilt. Damit ist der Satz in der
      Spec prüfbar geworden, statt eine Wirkung zu behaupten, die er nicht hat.
      Zahl ergänzt: 20 Fehlversuche je Herkunft im gleitenden Fenster einer
      Stunde, der 21. wird abgewiesen (aus `20260806110000`, nicht geschätzt)._
- [x] 14.7 **Ins Backlog, 2026-08-09 (Donald)** — eigenes Issue, es betrifft die
      Zustellreputation (AGE-256), nicht das Gate.
      **Mail-Missbrauch über die offene Selbstregistrierung** (codex, neu).
      Die Ratengrenze sitzt **je Profil**. Wer beliebig viele Profile mit
      beliebigen Fremdadressen anlegt, löst je Profil einen Versand aus — die
      Plattform wird zum Weiterleiter. Keine profilübergreifende, IP- oder
      globale Grenze deckt das ab. Betrifft nicht das Gate, sondern die
      Zustellreputation (und damit AGE-256).
- [x] 14.8 **Durable Specs widersprechen dem Gate** (codex). `directory-search`
      sagt jedem angemeldeten Mitglied Verzeichniszugriff zu, `events` jedem
      `basic`-Konto die Anmeldung zu öffentlichen Veranstaltungen. Beides steht
      nach dem Archivieren neben dem Gate. Dasselbe Muster wie 12.7, nur in zwei
      weiteren Capabilities — und es hängt an der AGE-448-Entscheidung (12.10).
      _**Behoben 2026-08-09**, nachdem 12.10 entschieden war. Zwei neue
      Delta-Dateien, weil der Widerspruch sonst beim Archivieren in die durable
      Specs geschrieben würde:_
      _· `specs/directory-search/spec.md` — MODIFIED „Public field projection is
      members-only and read-only": „every logged-in member" liest jetzt „every
      logged-in **and activated** member", beide Seiten (Aufrufer und
      Profilinhaber), und ausdrücklich im **Rumpf der View**, weil sie mit den
      Rechten ihres Eigentümers läuft und die Policies umgeht. Neues Szenario für
      das unbestätigte Konto._
      _· `specs/events/spec.md` — MODIFIED „Events are visible to all
      authenticated members" und „Registration goes through a capacity-aware RPC
      …". Die Verhaltensänderung aus 12.10 steht dort als **eigenes Szenario**
      („An unconfirmed account cannot register for a public event") samt der
      Begründung und ihrem Preis, statt als Behauptung._
      _Gegen den Code geprüft, nicht erschlossen: `20260806080100:177`
      (`events_select_by_visibility`), `:564` (`register_for_event`) und `:489`
      (`profiles_public`) tragen die Aktivierungsprüfung tatsächlich.
      `openspec validate --all`: 29/29._
- [x] 14.9 **Der Zeitkanal steht nur im Code-Kommentar** (codex, opencode,
      deckt sich mit 12.5). Dass sofort `202` geantwortet und erst danach
      versendet wird, ist die Abwehr des Adress-Orakels — sie gehört als
      Anforderung in die Spec, nicht in einen Kommentar.
      _**Behoben 2026-08-09** in `specs/access-control/spec.md`, Requirement „Der
      Weg zur Aktivierung setzt keine Anmeldung voraus": gleich sein SHALL nicht
      nur der **Inhalt** der Antwort, sondern auch ihr **Zeitpunkt** — zuerst
      antworten, danach versenden, weil sonst die Antwortdauer verrät, was die
      gleichlautende Antwort verbergen soll. Das Szenario „Die Anforderung verrät
      keine Adressen" nennt den Zeitkanal jetzt ausdrücklich mit, statt nur
      Statuscode und Inhalt._
- [x] 14.10 **Grenzwerte ohne Zahl** (opencode). Die Spec nennt 72 h und 256 Bit,
      aber weder die Sperrfrist je Profil noch das Versuchslimit auf dem
      Einlöseweg; ein Szenario nennt ein „Tageskontingent", das kein Requirement
      definiert. So sind die Szenarien nicht prüfbar.
      _**Behoben 2026-08-09.** Die Zahlen sind aus den Migrationen **gelesen**,
      nicht geschätzt: Sperrfrist **60 Sekunden** und Tageskontingent **fünf
      Token je 24 Stunden** aus `20260806080200:75` und `:81` (dieselben Werte in
      `20260806090000`), Einlöse-Drossel **20 Fehlversuche je Herkunft im
      gleitenden Fenster einer Stunde** aus `20260806110000:68-69`, der 21. wird
      abgewiesen (`v_anzahl > p_limit`, streng größer). Alle drei stehen jetzt im
      Requirement, das Tageskontingent trägt ein eigenes Szenario. 72 h und 256
      Bit standen bereits drin._

## 15. Abschluss (2026-08-09) — gebaut, entschieden, ausgelagert

Diese Sitzung hat den Change zu Ende gebracht: die verbliebenen Code- und
Spec-Befunde sind behoben, die drei offenen Entscheidungen sind gefallen und
schriftlich begründet, und alles, was C3 nicht schließt, liegt als eigenes
Linear-Issue im Backlog statt als Häkchen ohne Besitzer.

- [x] 15.1 **F1 behoben** — `/onboarding` liegt jetzt hinter `ActivationGate`
      (`src/App.tsx`). RED: der neue Test „zeigt einem unbestätigten Konto die
      Wand statt des Kompass-Assistenten" fiel vor der Änderung (1 failed | 9
      passed), GRÜN danach (10 passed). Der Begleittest für das **bestätigte**
      Konto blieb durchgehend grün — der rote Test hing also am Gate und nicht
      an etwas Beiläufigem.
- [x] 15.2 **F2 behoben** — `AuthProvider` unterscheidet jetzt „warte noch" von
      „aufgegeben" (`activationLookupFailed`, gesetzt **nur** in der
      Aufgeben-Lage nach dem dritten Fehlversuch); `ActivationGate` zeigt dort
      eine Meldung mit „Erneut versuchen" statt dauerhaft nichts. Die
      Entscheidung *fail closed heißt warten* bleibt unangetastet: bei
      `isActivated === null` ohne gesetztes Flag wird weiter nichts gezeigt.
      RED: 2 failed | 8 passed, GRÜN: 10 passed. **Löschprobe:** ein dritter
      Test behauptet die **Abwesenheit** des Knopfes bei
      `activationLookupFailed: false` — er war vorher wie nachher grün und
      belegt damit, dass die beiden positiven Tests am neuen Feld hängen und
      nicht an `isActivated === null`.
- [x] 15.3 **Testlücke `redeem-activation` geschlossen** — die
      sicherheitskritische Reihenfolge wird jetzt geprüft. Die Kernlogik liegt
      als `redeem.ts` neben dem `Deno.serve`-Rumpf (dasselbe Muster wie
      `emails.ts` und `webhook.ts`), ihre Außenwelt kommt als Parameter herein;
      Antworten, Statuscodes und Logzeilen sind unverändert. Sechs Tests in
      `redeem.test.ts` behaupten die Reihenfolge über eine **mitgeschriebene
      Aufrufliste**, nicht über einzelne „wurde aufgerufen"-Prüfungen, und
      decken jeden Teilfehlschlag ab. **RED gegen eine absichtlich falsche
      Fassung** (`mark_activated` vor `revoke_sessions` gezogen): 3 von 6
      Tests fielen, darunter genau der, der diesen Fall fangen soll — das ist
      der Zustand, der das Gate offen ließe. GRÜN nach dem Zurückstellen: 6
      passed. Voller Lauf: `70 passed | 0 failed`.
- [x] 15.4 **CI prüft die Edge Functions jetzt auch auf Typen.** Aufgefallen
      beim Herauslösen von `redeem.ts`: `deno test` typprüft nur, was ein Test
      **importiert** — und das sind gerade die reinen Module, nie die
      `index.ts`. Ein Verdrahtungsfehler zwischen beiden käme grün durch. Der
      konkrete Fall: `supabase.rpc()` gibt einen `PostgrestFilterBuilder`
      zurück, kein `Promise`; nur `deno check` sieht das. Neuer Schritt in
      `.github/workflows/ci.yml`, lokal über alle Functions grün.
- [x] 15.5 **Folge der 14.6-Entscheidung im Code nachgezogen** — der
      fail-open-Kommentar in `redeem.ts` sagte „die Drossel ist eine Lastbremse".
      Genau dieser Satz ist in der Spec gestrichen worden; der Kommentar folgt
      ihm jetzt. **Benannte Restfläche:** der Kopf von `20260806110000` trägt
      dieselbe überholte Begründung. Er wird **nicht** nachträglich umgeschrieben
      — eine angewandte Migration ist ein datiertes Protokoll, kein Dokument.
      Maßgeblich ist ab hier die Spec.

### Ausgelagert statt abgehakt

Zwölf Linear-Issues im Backlog, jedes mit Herkunftsverweis auf diesen Change:

| Issue | Was | Aus |
| --- | --- | --- |
| AGE-511 | PROD-Projekt: Migrationen und Functions nachziehen | 10.3 |
| AGE-512 | **CRITICAL** Stripe- und Resend-Secrets trennen | 10.3 |
| AGE-513 | Mailtext mit Detlev abstimmen | 9.1/9.2 |
| AGE-514 | Produktfrage: unbestätigtes Konto und öffentliche Events | 12.10 |
| AGE-515 | Vollständige CSP messen und setzen | 13.5 |
| AGE-516 | Rückstufung bei geplatzter Zahlung | 13.6 |
| AGE-517 | Mailmissbrauch über die offene Selbstregistrierung | 14.7 |
| AGE-518 | Kleine Restbefunde E5–E7, F3–F5 | REVIEW-8.7 |
| AGE-519 | `APP_URLS` führt localhost an erster Stelle | 10.8 |
| AGE-520 | Nachläufe aus Abschnitt 11 | 11.1–11.4 |
| AGE-521 | Restliche Testlücken | REVIEW-8.7 |
| AGE-522 | Zwei Wegwerf-Testkonten in der Live-DB entfernen | 10.2/10.8 |
