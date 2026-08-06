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
- [ ] 5.6 Versuchs-Drosselung pro Aufrufer auf diesem Endpunkt (opencode). Ein
      256-Bit-Token ist nicht erratbar, aber ein ungedrosselter öffentlicher
      Endpunkt ist auch ohne Erfolg eine Lastfläche. Steht als Anforderung in
      der Spec, nicht nur hier.
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
- [ ] 8.3 Alle sieben Fehlerfälle einmal von Hand durchspielen, protokolliert.
      _Teilweise erledigt beim Betrachten der laufenden Oberfläche (6.9): Wand
      auf `/`, `/mitglieder` und `/profil` · Anforderungsformular ohne Sitzung ·
      Anrede und Adresse aus `my_activation_state()` · keine Konsolenfehler. Die
      vier Token-Fälle brauchen einen echten Versand (10.2)._
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
- [ ] 8.7 Unabhängiges Code-Review in eigenem Kontext. `openspec validate` ist
      ein Schema-Check und ersetzt es nicht.
- [ ] 8.8 `run-plan-review.sh` erneut, gegen die überarbeiteten Artefakte.

## 9. Mailtext

- [ ] 9.1 Entwurf aus `design.md` an Detlev, als **Entwurf**.
- [ ] 9.2 Nach der Abstimmung in `emails.ts` einpflegen; `emails.test.ts` prüft
      Struktur, nicht Wortlaut, damit eine Textänderung nicht rot wird.

## 10. Deploy — Haltepunkt, Donalds Freigabe

- [x] 10.1 Migrationen auf DEV: `pnpm db:push`. Zielprojekt vorher ausgeben.
- [ ] 10.2 Functions auf DEV deployen, echten Versand an eine eigene Adresse
      prüfen.
- [ ] 10.3 **Erst nach Freigabe:** `pnpm db:push:prod`, Functions auf PROD,
      Secrets auf PROD prüfen (12 von 15 sind heute mit DEV identisch).
      _Merge ≠ live: `deploy.yml` deployt nur das Frontend._
- [ ] 10.4 Zustell-Abnahme bei GMX, Web.de, Gmail, Outlook. **Hängt an AGE-256**
      (SPF/DKIM). Blockiert die Abnahme des Versands, nicht den Sicherheitskern.

## 11. Nachläufe, die dieser Change nicht schließt

- [ ] 11.1 `security_update_password_require_reauthentication` auf PROD: soll er
      `true` werden? **Ungemessen** — die Einstellung wirkt laut Supabase nur,
      wenn der Login nicht „kürzlich" war, und der Angreifer hat sich gerade
      angemeldet. Der Messversuch auf DEV wurde vom Berechtigungs-Classifier
      abgelehnt. Eigenes Issue, mit der Messung als erstem Schritt.
- [ ] 11.2 C10 trägt drei Vorbedingungen — im Import-Issue vermerken, nicht nur
      hier: (a) Migration A läuft vorher (1.9), (b) der Import stößt den
      Aktivierungsversand direkt an, damit der Weg des Mitglieds das
      Default-Passwort nicht berührt, (c) deterministisches Verhalten, wenn eine
      Adresse durch Selbstregistrierung bereits belegt ist — ein vorab besetztes
      Konto darf nicht durch bloße Adressgleichheit zum Mitgliedskonto werden
      (codex).
- [ ] 11.3 `avatars`-Bucket privat stellen? Eigener Change mit Folgen für jede
      Bild-URL im Frontend (`INVENTORY.md`, Abschnitt C). Heute kein Weg für ein
      nicht aktiviertes Konto, die URLs überhaupt zu erfahren.

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
- [ ] 12.6 **„Versuchsgedrosselt" hat kein Subjekt** (opencode). Auf einem
      sitzungsfreien Endpunkt ist unklar, wer der Aufrufer ist — IP (sperrt bei
      NAT das echte Mitglied mit aus), Fingerprint, Token-Präfix? Und anders als
      bei 4.4 ist kein instanzübergreifender Speicher genannt. Betrifft 5.6.
- [ ] 12.7 **Bestehende Requirements widersprechen dem Delta** (codex). In
      `member-profiles` und benachbarten Capabilities sichern Requirements
      Eigentümern weiterhin Profil-, Kontakt-, Einstellungs- und Avatarzugriff
      **ohne** Aktivierungsvorbedingung zu. Sie müssen als MODIFIED auf
      „aktiviertes Mitglied" eingeschränkt werden, sonst ist die durable Spec
      nach dem Archivieren in sich widersprüchlich.
- [ ] 12.8 **„Genau eine privilegierte Funktion ohne Gate"** (codex) — die
      Formulierung im access-control-Delta widerspricht `INVENTORY.md` B2, wo 15
      bestehende Funktionen ungegatet bleiben. Auf die gemeinte Datenklasse
      eingrenzen, nicht auf eine Anzahl.
- [x] 12.9 **`my_activation_state()` hat keine Grant-Regel in der Spec**
      (opencode). In 1.6 steht sie, im Delta nicht — und das
      Prädikat-Requirement verlangt EXECUTE-Entzug für `public`/`anon`.
      Nachziehen.
- [ ] 12.10 **AGE-448 ist nicht „intakt", sondern verschoben** (opencode). Ein
      Gast registriert sich heute und ist sofort nutzbar; nach diesem Change muss
      er erst sein Postfach öffnen — auch für die Anmeldung zu einem öffentlichen
      Event, weil `register_for_event` gegatet ist. Vermutlich richtig so, aber
      es ist eine Verhaltensänderung und braucht ein eigenes Szenario statt der
      Behauptung. Vor dem Sommerfest mit Detlev klären.

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
- [ ] 13.4 **Offen aus 8.6, bewusst nicht in dieser Runde:** CSP/`frame-ancestors`
      /HSTS (`public/_headers` fehlt) · `notify-contact-request` verifiziert
      `record` nicht gegen `contact_requests` · `stripe-webhook` prüft
      `payment_status` nicht und stuft nie zurück · `.gitignore` ohne
      Schlüsselmuster. Details in `.gstack/security-reports/SECURITY.md`.
