Linear: **AGE-505**. Jede Aufgabe ist TDD — RED vor GREEN, und der rote Lauf
wird zitiert, nicht behauptet.

Die pgTAP-Zeile, die die Wahrheit sagt (nie der nackte Befehl, s.
`ci.yml:97-101`):

```
supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql \
  supabase/tests/directory_search_test.sql
```

## 1. Den Widerspruch im offenen Delta auflösen

- [x] 1.1 In `openspec/changes/member-activation-flow/specs/access-control/spec.md`
      den Satz „Ein erneuter Versand an ein bereits aktiviertes Konto SHALL keine
      Mail auslösen" auf **Aktivierungsmail** verengen, mit Verweis auf AGE-505.
- [x] 1.2 Das Szenario „Anfordern für ein bereits aktiviertes Konto" entsprechend
      verengen: keine **Aktivierungs**mail.
- [x] 1.3 Die Änderung in `member-activation-flow/REVIEWS.md` vermerken — ein
      bereits reviewtes Delta wurde angefasst; wer es gelesen hat, muss das sehen.
- [x] 1.4 `openspec validate --all` grün.

## 2. Datenbank — der Zweig wandert

- [x] 2.1 **RED:** In `rls_test.sql` einen Block ergänzen, der für ein
      **aktiviertes** Profil `issued_reset` erwartet, plus genau ein offenes
      Token. Muss fehlschlagen, solange `already_activated` zurückkommt.
      `plan(N)` mitziehen.
- [x] 2.2 **RED:** Assertions, dass die drei Grenzen auch auf dem Reset-Weg
      greifen — 60-s-Sperre, Schutzfenster (offener Link wird nicht entwertet),
      Tageskontingent. Das ist der Kern von Entscheidung 2 im `design.md`; ohne
      diese Assertions ist die Umstellung der Reihenfolge ungeprüft.
- [x] 2.3 **RED:** Assertion, dass `already_activated` von
      `issue_activation_token` **nicht mehr** kommt — sonst merkt niemand, wenn
      der Zweig versehentlich wieder vorne landet.
- [x] 2.4 **GREEN:** Migration `<ts>_activation_token_reset_zweck.sql` —
      Neudeklaration von `issue_activation_token`. Kopf trägt Befund,
      Entscheidung, verworfene Alternative (Spalte `purpose`) und die Begründung
      für die neue Reihenfolge.
- [x] 2.5 Belegen, dass `request_own_activation_token` **unverändert** ist und
      seinen `already_activated`-Zweig behält (Non-Goal aus `design.md`).
- [x] 2.6 Grants unverändert: `issue_activation_token` bleibt `service_role`-only.
      Die vorhandenen Assertions müssen weiter halten.

## 3. Versand — zweiter Text, zweite Zieladresse

- [x] 3.1 **RED:** In `supabase/functions/send-activation/emails.test.ts` prüfen,
      dass der Reset-Text die Gültigkeitsdauer, die **Abmeldung aller Geräte**
      und den Ignorieren-Hinweis trägt — und dass er nicht zur Aktivierung
      auffordert.
- [x] 3.2 **RED:** Prüfen, dass die Reset-URL auf `/passwort-neu` zeigt und die
      Aktivierungs-URL unverändert auf `/aktivierung`.
- [x] 3.3 **GREEN:** `renderPasswordReset` und die zweite URL-Form in
      `emails.ts`.
- [x] 3.4 **GREEN:** `send-activation/index.ts` akzeptiert `issued_reset` und
      wählt daran Text und URL. Der `status !== "issued"`-Zweig muss beide
      Erfolgsfälle durchlassen — sonst schluckt er den Reset still.
- [x] 3.5 Absender und `reply_to` unverändert (`effbeezee.com` / Club-Domain).
      Der Reset-Text sagt dieselbe Zusage zu wie der Aktivierungstext, also muss
      sie auch hier wahr sein.

## 4. Oberfläche

- [x] 4.1 **RED:** `LoginPage.test.tsx` — die Anmeldeseite trägt einen sichtbaren
      Weg zum Zurücksetzen.
- [x] 4.2 **RED:** Test für `/passwort-vergessen`: Adressformular, danach die
      Alle-Ausgänge-Meldung mit Rückkanal (dieselbe Regel wie 11.6).
- [x] 4.3 **RED:** Test für `/passwort-neu`: Token aus dem Fragment, Passwort
      setzen, danach `/login` — und die Wortwahl spricht vom **Passwort**, nicht
      vom Bestätigen eines Zugangs.
- [x] 4.4 **GREEN:** Zweck-Schalter am Einlöse-Bauteil, zwei Routen in `App.tsx`,
      Link auf `LoginPage.tsx`.
- [x] 4.5 Die Adresszeile wird auch auf `/passwort-neu` aufgeräumt — das Token
      darf dort so wenig stehenbleiben wie auf `/aktivierung`.
- [x] 4.6 **Lokal zeigen, bevor committet wird.** Grüne Tests haben in AGE-492
      ein visuell falsches Ergebnis durchgewunken.

## 5. Gates

- [x] 5.1 `database-sentinel` auf den Diff — die Migration ist eine
      Neudeklaration einer SECURITY-DEFINER-Function.
- [x] 5.2 Vollständige Verifikation: pgTAP (Dateiliste!), `pnpm test`,
      `pnpm typecheck`, `pnpm typecheck:functions`,
      `deno test --frozen --allow-env --allow-net supabase/functions/`.
- [x] 5.3 `openspec validate --all` grün.
- [x] 5.4 Unabhängiger Code-Review auf den **Diff** (Schritt 4 des Workflows).
      Löst Donald aus. **Gelaufen am 08.08.** auf `c5862fd^..c5862fd`, drei
      unabhängige Reviewer (Claude-Senior, Silent-Failure-Hunter, **Codex** —
      anderer Anbieter). Befunde in Gruppe 8; nachgelagert, weil #134 schon
      gemergt war.

## 6. Ausrollen — drei Flächen, drei Befehle

- [x] 6.1 Merge trägt nur das Frontend. Nach dem Merge prüfen, dass `migrate-dev`
      auf `main` gelaufen ist (auf dem PR ist es zu Recht übersprungen,
      `deploy.yml:36`).

  **Gemessen (08.08.) am Merge `70dda9a` (#140), Lauf `31267948141`:**
  `migrate-dev` = success. Der Satz stimmt aber nur zur Hälfte, und die andere
  Hälfte hat den Rollout zuerst blockiert:

  | Fläche        | erster Anlauf                   | nach `migrate-prod`          |
  | ------------- | ------------------------------- | ---------------------------- |
  | Frontend      | live (`pages-build-deployment`) | live                         |
  | DEV-DB        | angewandt                       | angewandt                    |
  | PROD-DB       | **zwei Migrationen fehlten**    | 50, abweichungsfrei          |
  | Edge Function | `functions` = **skipped**       | auf beiden Refs ausgeliefert |

  **`drift-gate` war rot** — `20260808150000` und `20260808180000` fehlten auf
  PROD —, und weil `functions` und `deploy` beide an
  `!contains(needs.*.result, 'failure')` hängen, wurden sie übersprungen. Ein
  Merge trägt hier also nicht einmal zuverlässig das Frontend über den
  `deploy.yml`-Weg; live war es nur über den eigenen Pages-Workflow.

  Reihenfolge, die funktioniert hat: `migrate-prod` von Hand (Lauf
  `31269631686`, `plan` + `apply` grün, „OK — 50 Migrationen, Historie
  abweichungsfrei", Objekt-Drift-Scan ohne Abweichung) → dann `Deploy` neu
  auslösen → alle vier Jobs grün.

  Vor dem Auslösen wurde der Dry-Run **gelesen**, nicht durchgeklickt (der
  `apply`-Job trägt bis heute keine Reviewer-Regel): PROD kannte 48 Versionen,
  es fehlten genau die zwei, und beide fassen keine Tabelle an — ein
  `create or replace function` samt Kommentar und Grants, dazu ein
  `comment on function`. Keine Indexanlage, kein Check, kein Backfill, also
  keine der Risikoklassen aus dem Kopf von `migrate-prod.yml`.

- [x] 6.2 ~~`supabase functions deploy send-activation` auf **beiden** Refs — kein
      Workflow tut das.~~ **Erledigt durch AGE-506.** Der `functions`-Job in
      `deploy.yml` liefert geänderte Functions nach dem Merge auf beide Refs aus;
      die Handarbeit entfällt. Was bleibt, ist das **Nachlesen**: der Job
      protokolliert je Projekt `supabase functions list` und nennt Übergangene
      sowie die gewählte Vergleichsbasis namentlich. Genau diese Lücke hat
      AGE-495 schon einmal als „live" gemeldet, während nichts deployt war.

  **Nachgelesen (08.08.), und genau das war der Punkt.** Im ersten Anlauf hätte
  das Häkchen getrogen: der Job war `skipped`, und zwei Checks heißen „deploy" —
  der grüne gehörte `pages-build-deployment`. Nach dem Neustart steht im
  Protokoll:

  ```
  BASIS: cf4aa6e2f21ba92e4bb4b829e99b1a7d30c68b45
  Abgeleitet seit cf4aa6e…: send-activation
  Deployed Functions on project foelowldexkcqzewvrcf: send-activation
  Deployed Functions on project viwntbodrtqxgmqyxluh: send-activation
  ```

  Die `functions list` beider Projekte zeigt `send-activation` als `ACTIVE` mit
  frischem Zeitstempel (17:35:09 bzw. 17:35:13) — Version 7 auf dem einen,
  Version 3 auf dem anderen. Übergangen wurde nichts, was sich geändert hätte.

  **Frontend zusätzlich am lebenden Bundle belegt:** `index-mbb0EILy.js`,
  1.208.439 Bytes (also kein 404-Stub, der sich als Bundle tarnt), enthält beide
  neuen Meldungen — „vollständige E-Mail-Adresse" (8.7) und „konnte gerade nicht
  gestellt werden" (8.2).

- [x] 6.3 Am echten Konto messen, nicht am Testdoppel: aktiviertes Konto →
      `/passwort-vergessen` → Mail → `/passwort-neu` → Anmeldung mit dem neuen
      Passwort. Reihenfolge beim Messen: Mitschnitt leeren → handeln →
      **Netzwerk lesen** → Screenshot.

  **Gemessen am 26.08.2026 auf DEV**, Konto `donald@factiv.eu` (aktiviert seit
  06.08., `impact`), Flaeche `fbc-probe-a4664fb5.pages.dev`. Lesesonde:
  `scripts/probe-age505-reset-messung.ts`. Das gesetzte Passwort steht
  bewusst nicht im Repo.

  **Warum diese Flaeche und nicht die lokale Instanz.** Der Reset-Versand geht
  ueber die Resend-HTTPS-API, nicht ueber SMTP — Mailpit faengt ihn also nicht.
  Und die Datenbank haelt nur den **sha256-Hash** des Tokens; das Token selbst
  existiert ausschliesslich in der Mail. Lokal waere 6.3 nur mit genau dem
  Testdoppel messbar, das die Aufgabe ausschliesst. Beide `APP_URL` wurden
  vorher per Digest gegen oeffentliche Kandidaten aufgeloest, ohne einen
  Klartextwert abzurufen: PROD `https://fbc-platform.pages.dev`, DEV
  `https://fbc-probe-a4664fb5.pages.dev`. Die Messung beruehrt PROD nicht.

  **Erster Lauf: der `pending`-Zweig, live belegt.** Vor dem Handeln wurde der
  Token-Stand gelesen — auf DEV lag ein offenes, unbenutztes Token vom 25.08.
  11:44 (`sperrt_pending: true`). Die Anforderung darauf antwortete
  `POST …/functions/v1/send-activation [202]`, und die Datenbank zeigte danach
  **null neue Token**. Genau der Fall, in dem die Antwort nichts belegt (E1).
  Die Flaeche sagt ihn inzwischen selbst an: *„Wurde in den letzten 24 Stunden
  schon ein Link angefordert, gilt weiter der aus jener Mail."* Ohne den Blick
  in die Tabelle waere dieser Lauf als Erfolg durchgegangen.

  **Nebenbefund, mitbelegt.** Der sha256 des Tokens aus jener Mail trifft
  **genau eine** DEV-Zeile — die Mail kam also von DEV, und ihr Link zeigte auf
  `fbc-platform.pages.dev`, die PROD-lesende Flaeche. Sie stammt aus der Zeit
  vor der `APP_URL`-Korrektur (DEV-Secret aktualisiert am 25.08. 14:59, die Mail
  ging um 11:44 raus). Das Alt-Token wurde entwertet, damit der Messlauf nicht
  an der Ratenbegrenzung haengenbleibt.

  **Zweiter Lauf, die eigentliche Messung.** `[202]` vom DEV-Projekt
  `foelowldexkcqzewvrcf`, Token angelegt `09:27:34.868`, Mail zugestellt
  `09:27:35` — und ihr Link zeigt jetzt auf die Probe-Flaeche, die
  `APP_URL`-Korrektur traegt also. `/passwort-neu` →
  `POST …/functions/v1/redeem-activation [200]`, Flaeche meldet „Dein neues
  Passwort ist gesetzt". Anmeldung mit dem neuen Passwort erfolgreich
  (eingeloggte Startseite, Stufe Impact), in der Datenbank an
  `last_sign_in_at = 2026-08-26T09:30:03.164Z` nachgelesen. Token `used_at`
  gesetzt, also einmalig verbraucht.

  Screenshots liegen unter `docs/legacy-planning/qa-screens/age505-*` — der
  dritte absichtlich nur als Element-Ausschnitt: die eingeloggte Startseite
  listet Klarnamen anderer Mitglieder, und das Repo ist oeffentlich.
- [x] 6.4 Belegen, dass `activated_at` dabei **unverändert** geblieben ist.
      — **Am Code belegt (22.08.), die Laufzeitmessung steht noch aus.** Der
      Reset-Weg teilt sich die Kette mit der Aktivierung: `/passwort-vergessen`
      und `/passwort-neu` rendern beide `ActivationRedeemPage` mit
      `zweck="reset"` (`App.tsx:190-191`), und `redeem-activation` ruft
      `markActivated` **ohne Fallunterscheidung** (`redeem.ts:140`) — der
      Reset läuft also durch dieselbe Zeile wie eine Aktivierung. Genau hier
      läge der befürchtete Fehler.
      Er ist abgefangen, aber nicht im Aufrufer, sondern in der Funktion:
      `mark_activated` setzt `activated_at = coalesce(activated_at, now())`
      (`20260806080200_activation_rpcs.sql:185`). Für ein bereits aktiviertes
      Konto ist der Aufruf damit ein No-op auf dem Zeitstempel, und ein
      Passwort-Reset kann die Aktivierung strukturell nicht zurücksetzen oder
      verschieben.
      **Was das nicht ersetzt:** dass der Wert im echten Lauf gleich bleibt,
      ist damit *hergeleitet*, nicht *gemessen*. Der Beleg gehört zu 6.3 und
      wird mit ihm nachgetragen — Wert vorher lesen, Lauf fahren, Wert
      nachlesen.

      **Nachgetragen am 26.08.2026 — gemessen, nicht mehr hergeleitet:**

      | | vorher | nachher |
      |---|---|---|
      | `activated_at` | `2026-08-06T10:07:56.653Z` | `2026-08-06T10:07:56.653Z` |
      | `auth_updated_at` | `2026-08-25T15:00:38.597Z` | `2026-08-26T09:28:52.774Z` |
      | Token `used_at` | `null` | `2026-08-26T09:28:52.627Z` |

      **Die zweite Zeile ist die Gegenprobe und der eigentliche Punkt.** Ein
      unveraendertes `activated_at` allein ist auch mit einem Lauf vereinbar,
      der ueberhaupt nichts geschrieben hat — und der erste Lauf des Tages war
      genau so einer (`pending`, siehe 6.3). Erst das mitwandernde
      `auth_updated_at` belegt, dass in derselben Sekunde geschrieben wurde,
      und macht das stehengebliebene `activated_at` zu einem echten Negativ.

## 7. Nachlauf

- [x] 7.1 AGE-505 in Linear auf Done — vorher `get_issue` lesen, die Automation
      schaltet den Status bei PR-Merge selbst. **22.08. gelesen: steht seit dem
      08.08. 18:28 auf Done, vier PRs angehängt (#134, #139, #140, #142).
      Nichts geschrieben.**
- [x] 7.2 11.7 in `member-activation-flow/tasks.md` als hierher verlagert
      abhaken, mit Verweis auf AGE-505. **22.08.: der Haken stand schon, der
      Verweis fehlte — nachgetragen in
      `archive/2026-08-09-member-activation-flow/tasks.md`.**
- [x] 7.3 `openspec archive` erst, wenn 6.3 gemessen ist — nicht, wenn der Code
      existiert. **26.08.: 6.3 und 6.4 sind gemessen, damit erfuellt.**

## 8. Nach dem Review (08.08., 5.4)

Drei unabhängige Reviewer auf `c5862fd^..c5862fd`. Anders als bei AGE-506 fanden
sie **nicht** denselben Kern — jeder Blickwinkel fand etwas, das die beiden
anderen übersahen. Der schwerste Befund kam vom Reviewer des anderen Anbieters.

Was hier steht, ist nachgemessen, nicht übernommen. Drei Behauptungen der
Reviewer habe ich geprüft: zwei bestätigt, eine entschärft.

- [x] 8.1 **Gleichzeitige Anfragen machen Adressen aufzählbar (Codex, schwerster
      Befund).** Zwei parallele Anfragen für eine bekannte, gerade
      ausgabeberechtigte Adresse passieren beide die Zähl- und Pending-Abfragen;
      der partielle Unique-Index `activation_tokens_offen_je_profil`
      (`20260806080000:65`) lässt nur einen Insert zu, der zweite RPC endet mit
      Unique-Violation, und `index.ts:123-126` übersetzt **jeden** RPC-Fehler in
      **502**. Für eine unbekannte Adresse antworten beide mit 202. Ein einziges
      Paar paralleler Anfragen unterscheidet damit Mitglied von Nicht-Mitglied —
      genau das, was die Immer-202-Konstruktion verhindern soll.
      **PR-spezifische Verschärfung, die Codex nicht nennt:** vor AGE-505 kehrte
      ein aktiviertes Konto bei `already_activated` um, **bevor** irgendetwas
      eingefügt wurde — für solche Konten gab es den Wettlauf gar nicht. Da
      „aktiviert" nach C10 der Normalfall ist, dehnt AGE-505 das Orakel von den
      unaktivierten auf **alle** Konten aus. Der Index ist nicht der Fehler
      (er ist die Absicht, siehe sein Kommentar); der Fehler ist, dass sein
      Verstoß als 502 nach außen dringt. Fix: Unique-Violation in
      `issue_activation_token` abfangen und als `pending` zurückgeben — der
      Zustand, den der Verlierer des Wettlaufs faktisch vorfindet.

  **Behoben (08.08.) in `20260808150000_activation_token_wettlauf_ist_pending.sql`** —
  im zweiten Anlauf, und der erste ist der lehrreichere.

  **Der verworfene erste Anlauf.** Er fing `23505` in der Edge Function ab
  (reine Funktion `rpc-ausgang.ts` samt Tests, RED/GREEN sauber, 5/5). Ein
  Review dieses Fixes durch den Reviewer des anderen Anbieters meldete ihn als
  **Blocker**, und zu Recht: `activation_tokens` trägt **zwei** Unique-
  Constraints — den partiellen Index (der Wächter) und den **Primärschlüssel**
  auf `token_hash` (`20260806080000:38`). Beide werfen `23505`. Der Fix hätte
  eine kaputte Token-Erzeugung als „angenommen" verbucht: kein Fehler, keine
  Mail, im Protokoll „Wettlauf verloren" — also ausgerechnet die Fehlerklasse,
  gegen die er im eigenen Kommentar argumentierte. Zurückgenommen,
  `index.ts` ist wieder byte-identisch zum Stand davor.

  **Der Fix.** Ein `exception when unique_violation` um das `insert`, das den
  Wächter über `get stacked diagnostics … = constraint_name` beim **Namen**
  nennt statt über den Fehlercode; alles andere wird durchgereicht (`raise`).
  Verworfen: `on conflict (profile_id) where …` — kürzer, aber die
  Inferenz-Klausel darf nicht qualifiziert werden, und `profile_id` ist zugleich
  OUT-Parameter der Function. Postgres meldet die Spalte als mehrdeutig;
  gemessen, nicht vermutet.

  **Zwei Messungen statt Annahmen.** (a) Liefert Postgres für einen partiellen
  **Index** (keinen Table-Constraint) überhaupt einen `constraint_name`? An
  einer Wegwerf-Tabelle gegen die lokale Instanz geprüft: ja —
  `probe_offen_je_profil` gegen `probe_tokens_pkey`, beide `23505`. (b) Greift
  der neue pgTAP-Test wirklich? Gegen die **naive** Fassung (23505 pauschal als
  Wettlauf) fällt genau er: `Failed test 170`. Danach GREEN, 200/200 über alle
  drei Testdateien.

  Der Wettlauf selbst bleibt ungetestet — er braucht zwei Sitzungen, und weder
  `dblink` noch `pg_background` sind installiert (nachgesehen). Geprüft ist die
  **Unterscheidung**, und genau an ihr ist der erste Anlauf gescheitert.

- [x] 8.2 **Jeder technische Fehlschlag rendert die grüne Erfolgsmeldung**
      (Silent-Failure-Hunter). `ActivationRedeemPage.tsx:129-135` hat ein
      `finally` ohne `catch`; `setAngefordert(true)` läuft unabhängig vom
      Ausgang, und `angefordert` ist das Einzige, was Formular von „der Link ist
      unterwegs" trennt. **Nachgemessen an `index.ts:99-126`:** fehlendes Secret
      → 500, DB-Fehler → 502, kaputter Rumpf → 400; `requestActivationLink`
      wirft bei jedem Nicht-2xx. Alle drei enden in derselben grünen Meldung.
      Vorbestehend — aber `/passwort-vergessen` ist ab AGE-505 der **einzige**
      Rückweg eines aktivierten Kontos. Fix: `catch`, eigener Fehlerzustand, und
      er darf nicht klingen wie die drei Anti-Aufzählungs-Ausgänge.

  **Behoben (08.08.), RED zuerst.** Neuer Fall „meldet einen technischen
  Fehlschlag als solchen, statt Erfolg zu behaupten": `requestActivationLink`
  wirft, und der Test verlangt die Fehlermeldung **und** die Abwesenheit der
  grünen. Rot mit `Unable to find an element with the text: /konnte gerade nicht
gestellt werden/i`. Danach `setAngefordert(true)` in den `try` verschoben,
  `catch` mit eigenem Zustand, `finally` trägt nur noch `setLäuft(false)`. Das
  Formular bleibt stehen, damit ein zweiter Versuch möglich ist. 19/19.

  **Sichtprobe nachgeholt (08.08., 4.6).** `/passwort-vergessen`, Adresse
  eingegeben, gesendet: der rote Kasten „Die Anfrage konnte gerade nicht
  gestellt werden…" steht **über** dem Formular, das Formular bleibt stehen,
  und die grüne Meldung erscheint nicht. Damit ist auch visuell belegt, was der
  Test behauptet.

  Erzwungen wurde der Fehlschlag **ohne** Wirkung auf die DEV-Datenbank: der
  Server lief mit einem unerreichbaren Backend
  (`VITE_SUPABASE_URL=http://127.0.0.1:59999`), also wirft schon `fetch`. Ein
  echter Absenden-Versuch gegen `foelowldexkcqzewvrcf` hätte für eine bekannte
  Adresse ein Token angelegt und eine Mail ausgelöst — deshalb nicht so
  gemessen.

  **Und der Grund fürs Nichtmounten steht jetzt fest: es lag nicht an der App.**
  Auf 5173–5176 lauschten noch vier **alte** Vite-Server aus früheren
  Sitzungen. Der auf 5173 liefert das HTML mit 200 aus, antwortet auf
  `/src/main.tsx` aber mit **504** — kein Modul, also kein Mount, und die
  Konsole bleibt genau deshalb stumm. Ein frisch gestarteter Server (`pnpm dev`
  weicht selbst auf einen freien Port aus) rendert dieselbe Seite sofort.

- [x] 8.3 **Die Route-Verdrahtung ist durch keinen Test geschützt** (Senior +
      Codex, unabhängig voneinander). `renderReset` setzt zwar
      `window.history`, der `MemoryRouter` liest den Pfad aber nie — der Zweck
      kommt aus der **Prop**. **Zweimal falsifiziert:** (a) alle sechs Pfade in
      `ActivationRedeemPage.test.tsx` durch `/voelliger-unsinn` ersetzt →
      **18/18 grün**; (b) `zweck="reset"` in `App.tsx:155` entfernt, sodass
      `/passwort-neu` wieder „Zugang freischalten" zeigt → **458/458 grün**.
      Damit ist der eigentliche Zweck von AGE-505 ungeschützt. Verschärfend: der
      Kommentar über `renderReset` behauptet ausdrücklich das Gegenteil („sonst
      prüfte der Test eine Konstruktion, die es so nicht gibt") — das ist
      schlechter als kein Test. Fix: ein Fall in `App.test.tsx` mit
      `initialEntries={["/passwort-neu#token=x"]}`, plus den falschen Kommentar
      streichen.

  **Behoben (08.08.).** Drei Fälle in `App.test.tsx` unter „Zweck der
  Einlöseseite hängt an der Route", die das echte `<App />` fahren. Zwei Fallen
  dabei: das Token kommt aus `window.location.hash`, nicht aus dem Router (also
  wird **beides** gesetzt) — und ein Test auf nur EINER Route wäre nicht
  unterscheidend, wer die Routen vertauscht bestünde ihn. Deshalb steht
  `/aktivierung` daneben.
  **Als Sonde belegt, nicht behauptet** (ein fehlender Test wird von sich aus
  nie rot): Mutation 1 `zweck="reset"` entfernt → **genau** der `/passwort-neu`-
  Fall fällt; Mutation 2 die Routen vertauscht → **genau** der `/aktivierung`-
  Fall fällt. `App.tsx` danach unverändert (`git diff` leer). Der falsche
  Kommentar über `renderReset` ist ersetzt und verweist jetzt auf die Stelle,
  die die Verdrahtung wirklich prüft. Suite 458 → 462.

- [x] 8.4 **Die Weiterleitung wurde nicht zweck-abhängig gemacht**
      (Silent-Failure-Hunter; unabhängig auch beim Lesen des Diffs aufgefallen).
      `ActivationRedeemPage.tsx:103` wirft bei `!token && user && isActivated`
      wortlos auf `/`. Für „aktivierung" ist das begründet — für „reset" ist
      aktiviert-sein die **Voraussetzung**, nicht der Grund wegzuschicken. Ein
      eingeloggtes Mitglied auf `/passwort-vergessen` landet ohne Meldung auf der
      Startseite. **Entschärfend nachgemessen:** es gibt einen eingeloggten Weg
      (`EinstellungenPage`, AGE-450, ohne Re-Auth), und `LoginPage.tsx:42` hält
      Angemeldete von `/login` fern, der neue Link ist für sie also nicht
      erreichbar. Niemand ist ausgesperrt; es fehlt der Hinweis. Fix:
      `&& zweck === "aktivierung"`, oder auf `/einstellungen` leiten.

  **Behoben (08.08.), RED zuerst.** `&& zweck === "aktivierung"` in der
  Bedingung; das Formular bleibt für Angemeldete stehen, statt sie wortlos
  wegzuschicken. Der neue Fall „schickt ein angemeldetes Mitglied auf
  `/passwort-vergessen` NICHT weg" war rot (`navigate` wurde aufgerufen), ist
  jetzt grün. Die Weiterleitung auf `/aktivierung` deckt der bestehende Fall
  „leitet ein bereits aktiviertes Konto ohne Token still auf die Startseite" ab
  — **das Paar** ist der Beleg: einer allein bestünde auch, wer die
  Weiterleitung ganz entfernt oder sie überall lässt. Verworfen: auf
  `/einstellungen` leiten — das wäre wieder eine stumme Weiterleitung, nur
  woandershin.

- [x] 8.5 **Kein Zweig für einen unbekannten Status** (Silent-Failure-Hunter).
      `index.ts:139` fasst vier Status plus **alles Unbekannte** in eine
      `info`-Zeile. Der genannte Ablauf: Function deployt, Migration nicht →
      DB antwortet weiter `already_activated` → kein Mitglied bekommt je eine
      Reset-Mail, und das einzige Signal sieht aus wie der Normalfall.
      **Nachgemessen und entschärft:** `20260807200000` **ist** auf
      `foelowldexkcqzewvrcf` angewandt (dem Projekt, auf das das Deployment
      zeigt) — die Function trägt `issued_reset`. Nicht akut, aber die
      Absicherung fehlt: Erlaubnisliste + `error` für Unerwartetes.

  **Behoben (08.08.), RED zuerst.** Neues Modul `status.ts` mit `versandArt()`
  und dem Muster der Nachbarn (`checkout.ts`, `webhook.ts`: reine Logik neben
  der Schale). Es kennt vier Ausgänge — `aktivierung`, `reset`, `kein_versand`
  und **`unerwartet`**; die Erlaubnisliste stammt aus dem `comment on function`
  von `issue_activation_token`. `index.ts` protokolliert `unerwartet` als
  `error` und antwortet **weiterhin 202**: ein eigener Ausgang wäre genau das
  Adressorakel, gegen das die ganze Konstruktion gebaut ist.

  RED war der fehlende Import (`TS2307`), dann 3/3 grün, `deno test` insgesamt
  64/64. Der Fall, der den Befund trägt, steht namentlich drin:
  `already_activated` → `unerwartet`, nicht `kein_versand`.

- [x] 8.6 **Der abgeleitete Zweck trägt nur, solange `activated_at` genau einen
      Schreiber hat** (Senior). `mark_activated` mit
      `coalesce(activated_at, now())` ist heute der einzige, eine Deaktivierung
      gibt es nicht. Genau das ist die unausgesprochene Bedingung des Entwurfs
      „Zweck ableiten statt speichern". Wer je eine Sperrfunktion baut, die
      `activated_at` auf `null` setzt, macht jedes ausstehende Reset-Token zum
      Re-Aktivierer. Gehört als Warnung an `mark_activated` in
      `20260806080200`, nicht nur in den Kopf von `20260807200000`.

  **Behoben (08.08.), RED zuerst** — in
  `20260808180000_mark_activated_warnt_vor_ruecksetzen.sql`. Der Kommentar von
  `mark_activated` trägt die Warnung jetzt selbst: wer `activated_at`
  zurücksetzt, macht jedes ausstehende Reset-Token zum Re-Aktivierer, und dann
  muss der Zweck gespeichert statt abgeleitet werden. **Die Function bleibt
  byte-identisch**, nur ihr Kommentar wächst.

  Verworfen: den Kommentar in `20260806080200` selbst ändern — die Migration ist
  auf beiden Projekten angewandt, eine nachträgliche Änderung wirkt nirgends und
  lässt Datei und Datenbank auseinanderlaufen. Ebenfalls verworfen: das
  Zurücksetzen technisch verbieten (Trigger/Check) — das verböte eine
  Sperrfunktion, die es geben darf; was fehlte, war die Information, nicht die
  Erlaubnis.

  Belegt statt behauptet: eine pgTAP-Zeile prüft `obj_description` auf die
  Warnung. Vor der Migration fiel sie (`Failed test 147`, der alte Kommentar
  wird im Protokoll wörtlich ausgegeben), nach `supabase db reset` 202/202 über
  alle drei Dateien. Damit verschwindet die Warnung auch nicht wortlos bei der
  nächsten Neudeklaration.

- [x] 8.7 Kleinkram, gesammelt: Adressvalidierung
      (`ActivationRedeemPage.tsx:127`) kehrt bei Tippfehler **wortlos** um, der
      Knopf wirkt kaputt (`noValidate` schaltet die Browser-Prüfung ab) ·
      `entwerten()` protokolliert `token_invalidated` auf `info`, auch wenn
      **null** Zeilen getroffen wurden (`index.ts:165`) · `EdgeRuntime?.waitUntil?.`
      überspringt den Versand still, wenn die Laufzeit es nicht hat ·
      `instrument.test.ts:41` prüft die Fragment-Aufräumung nur auf
      `/aktivierung`, nicht auf `/passwort-neu` · `LoginPage.test.tsx` belegt den
      Link, aber nicht die Bedingung `mode === "login"`.

  **Alle fünf behoben (08.08.).**

  1. **Adressvalidierung.** Sie kehrt nicht mehr wortlos um: „Bitte gib eine
     vollständige E-Mail-Adresse ein — mit @ und Domain." RED zuerst
     (`Unable to find an element with the text: /vollständige E-Mail-Adresse/i`).
     Der Zustand ist mit dem technischen Fehlschlag aus 8.2 zu EINEM
     `AnfrageHinweis` zusammengelegt (`"adresse" | "technisch" | null`), weil die
     beiden einander ausschließen und zwei Wahrheitswerte einen Zustand
     erlaubten, den es nicht gibt. Sie **müssen** verschiedene Texte haben: der
     eine sagt „der Aufruf ging nie raus", der andere „er kam nicht durch".
  2. **`entwerten()` bei null Treffern.** Eigener Zweig, `error` statt `info`:
     null Treffer heißt, das gerade ausgegebene Token ist nicht mehr da — also
     liegt entweder eines gültig herum oder das Entwerten greift am falschen
     Hash. Beides ist der Zustand, gegen den `entwerten` gebaut wurde.
  3. **Fehlendes `waitUntil`.** Statt `?.` ein Zweig mit `error`-Zeile.
     **Abwarten geht hier nicht** — das wäre die Zeitmessung, die den
     Adressbestand verrät. Nebenbei repariert: der Empfänger bleibt erhalten
     (`rt.waitUntil(...)` statt der herausgelösten Funktion), sonst hinge der
     Fix an einer Annahme über die Laufzeit.
  4. **Fragment-Aufräumung auf `/passwort-neu`.** Neuer Fall in
     `instrument.test.ts`.
  5. **Die Bedingung des Login-Links.** Neuer Fall: im Registrierungsmodus steht
     der Link **nicht**.

  **4 und 5 mit Sonden belegt, nicht behauptet** — ein fehlender Test wird von
  sich aus nie rot, beide waren also sofort grün. Sonde 1: Aufräumung an
  `/aktivierung` gebunden → **genau** der `/passwort-neu`-Fall fällt (1 von 4),
  der `/aktivierung`-Fall bleibt grün. Sonde 2: `mode === "login"` durch `true`
  ersetzt → **genau** der Registrierungs-Fall fällt (1 von 6). Beide Quellen
  danach unverändert (`git diff` leer). Suite 462 → 466.

  **Sichtprobe zu 1 (4.6):** `/passwort-vergessen`, `probe.example.invalid`
  eingegeben, gesendet — der rote Kasten „Bitte gib eine vollständige
  E-Mail-Adresse ein — mit @ und Domain." steht über dem Formular, und der Knopf
  wirkt nicht mehr kaputt. Damit ist genau der Eindruck weg, der den Befund
  ausgelöst hat.

### Aus dem Review des Fixes selbst (08.08.)

Der Fix zu 8.1 wurde vor dem Merge nochmals geprüft — dieselbe Kontrolle, die
den Change fand, auf die eigene Korrektur. Sie hat einen Blocker gefunden (oben
in 8.1 beschrieben) und danach noch das hier:

- [x] 8.8 **Der Wettlauf ist damit NICHT abschließend behoben — der andere
      Ablauf umgeht den Wächter ganz.** Läuft B's `update … set invalidated_at`
      **nach** A's Commit, bekommt es unter `read committed` einen frischen
      Snapshot, **sieht A's soeben angelegtes Token und entwertet es**. B's
      `insert` kollidiert dann mit nichts mehr und liefert `issued`. Ergebnis:
      zwei Mails, nur B's Link gilt — und das 24-Stunden-Schutzfenster, das
      genau das verhindern soll, ist umgangen. Der Exception-Handler wird dabei
      nie betreten.
      **Einordnung, die der Review nicht macht:** das ist **vorbestehend** und
      kein Rückschritt von 8.1. `update`-dann-`insert` ohne Sperre steht seit
      AGE-495 unverändert; der Diff zu 8.1 berührt diesen Pfad nicht. Deshalb
      hier erfasst statt in den Fix gestopft — er würde sonst zwei verschiedene
      Dinge auf einmal ändern.
      **Vorgeschlagener Fix:** die Profilzeile vor den drei Grenzen sperren
      (`select … for update`), und zwar in **beiden** ausgebenden RPCs — sonst
      bleibt der Wettlauf zwischen anonymem und angemeldetem Weg offen
      (`request_own_activation_token`, `20260806090000`). Das macht den
      23505-Zweig zum Gürtel neben den Hosenträgern, statt ihn zu ersetzen.
      Eigener Change: es ändert das Sperrverhalten beider Wege und gehört
      gemessen, nicht nebenbei mitgenommen.
      _**Geschlossen durch AGE-507** (`lock-activation-token-race`, gemergt als
      `#146`, auf PROD angewendet 2026-08-09). Der dort gebaute Fix ist genau der
      hier vorgeschlagene: `for update of p` in **beiden** ausgebenden RPCs, vor
      den drei Grenzen. Nicht behauptet, sondern gemessen — Szenario S1 der Sonde
      `scripts/probe-wettlauf-token-ausgabe.ts` trägt diesen Befund (Gruppe 1.5
      und 4 dort). Die Messung hat dabei zwei Erwartungen dieses Absatzes
      widerlegt: die Rollen sind vertauscht (A gewinnt, B fällt in die
      Sperrfrist), und die beiden Wege warten heute schon aufeinander — nur am
      **Index** statt an der Profilzeile. Die Sperre reicht weiter als hier
      angenommen: ein `insert` in `activation_tokens` nimmt für den Fremdschlüssel
      ohnehin ein `for key share` auf die Profilzeile._
- [x] 8.9 **Der Wächter-Fall selbst bleibt ungetestet.** Der `throws_ok`-Test
      belegt nur, was NICHT verschluckt wird; ein Tippfehler im Constraint-Namen
      des Handlers bliebe grün. Teilweise geschlossen: eine `has_index`-Zeile
      nagelt den Namen als Vertragsbestandteil fest (Sonde: mit falschem Namen
      fällt sie, `Failed test 171`). Vollständig belegen ließe sich der Zweig nur
      mit zwei echten Sitzungen außerhalb der pgTAP-Transaktion — dafür fehlen
      hier `dblink` und `pg_background`. Gehört zu 8.8: wer dort `for update`
      einzieht, braucht ohnehin einen Zwei-Sitzungs-Aufbau.
      _**Geschlossen durch AGE-507.** Genau dieser Aufbau ist dort entstanden:
      Szenario S2 der Sonde fährt den 23505-Wächter unter einem echten
      Zwei-Sitzungs-Wettlauf, außerhalb jeder pgTAP-Transaktion, und belegt das
      Warten über `pg_blocking_pids`. Der Zweig ist damit betreten worden, nicht
      nur umschrieben. Ein Nachtrag, der hierher gehört: S2 behauptet **keinen
      festen Statuswert** — ohne Sperre `pending`, mit ihr `rate_limited`. Beides
      ist ehrlich; auf „pending" zu prüfen hätte den **Weg** statt das
      **Ergebnis** gemessen._

**Geprüft und in Ordnung** — damit es nicht zweimal geprüft wird: Der Kopf der
Migration behauptet, gegen `20260806090000` seien ausschließlich Zweigreihenfolge
und Status geändert. **Rumpf-Diff ohne Kommentare: exakt wahr**, ein verschobener
Zweig, sonst byte-identisch. AGE-495/E2 wurde nicht still zurückgedreht
(`20260807190000` deklariert die Function nicht neu). `activated_at` überlebt
einen echten Reset (`coalesce`), und `rls_test.sql` nagelt das mit einer
Assertion fest, die rot wird, wenn jemand `coalesce` entfernt. `SECURITY DEFINER`
ist sauber: leerer `search_path`, qualifizierte Tabellen, `revoke` für `public`,
`anon`, `authenticated`. Empfänger ist immer die hinterlegte Adresse.

**Bewusst NICHT als Befund geführt:** Codex nennt die fehlende serverseitige
Zweckbindung (ein Aktivierungs-Token lässt sich unter `/passwort-neu` einlösen).
Das ist so **entworfen** und im Migrationskopf begründet — das Einlösen ist für
beide Zwecke identisch, die Route ist ein Etikett. Codex' Folgerung, die
Invariante „Reset ändert `activated_at` nicht" sei dadurch verletzt, trägt nicht:
`activated_at` ändert sich nur bei einem Konto, das **nie** aktiviert war — das
ist eine Aktivierung, kein Reset. Was bleibt, ist 8.6.
