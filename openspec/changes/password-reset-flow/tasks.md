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

- [ ] 6.1 Merge trägt nur das Frontend. Nach dem Merge prüfen, dass `migrate-dev`
      auf `main` gelaufen ist (auf dem PR ist es zu Recht übersprungen,
      `deploy.yml:36`).
- [x] 6.2 ~~`supabase functions deploy send-activation` auf **beiden** Refs — kein
      Workflow tut das.~~ **Erledigt durch AGE-506.** Der `functions`-Job in
      `deploy.yml` liefert geänderte Functions nach dem Merge auf beide Refs aus;
      die Handarbeit entfällt. Was bleibt, ist das **Nachlesen**: der Job
      protokolliert je Projekt `supabase functions list` und nennt Übergangene
      sowie die gewählte Vergleichsbasis namentlich. Genau diese Lücke hat
      AGE-495 schon einmal als „live" gemeldet, während nichts deployt war.
- [ ] 6.3 Am echten Konto messen, nicht am Testdoppel: aktiviertes Konto →
      `/passwort-vergessen` → Mail → `/passwort-neu` → Anmeldung mit dem neuen
      Passwort. Reihenfolge beim Messen: Mitschnitt leeren → handeln →
      **Netzwerk lesen** → Screenshot.
- [ ] 6.4 Belegen, dass `activated_at` dabei **unverändert** geblieben ist.

## 7. Nachlauf

- [ ] 7.1 AGE-505 in Linear auf Done — vorher `get_issue` lesen, die Automation
      schaltet den Status bei PR-Merge selbst.
- [ ] 7.2 11.7 in `member-activation-flow/tasks.md` als hierher verlagert
      abhaken, mit Verweis auf AGE-505.
- [ ] 7.3 `openspec archive` erst, wenn 6.3 gemessen ist — nicht, wenn der Code
      existiert.

## 8. Nach dem Review (08.08., 5.4)

Drei unabhängige Reviewer auf `c5862fd^..c5862fd`. Anders als bei AGE-506 fanden
sie **nicht** denselben Kern — jeder Blickwinkel fand etwas, das die beiden
anderen übersahen. Der schwerste Befund kam vom Reviewer des anderen Anbieters.

Was hier steht, ist nachgemessen, nicht übernommen. Drei Behauptungen der
Reviewer habe ich geprüft: zwei bestätigt, eine entschärft.

- [ ] 8.1 **Gleichzeitige Anfragen machen Adressen aufzählbar (Codex, schwerster
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
- [ ] 8.2 **Jeder technische Fehlschlag rendert die grüne Erfolgsmeldung**
      (Silent-Failure-Hunter). `ActivationRedeemPage.tsx:129-135` hat ein
      `finally` ohne `catch`; `setAngefordert(true)` läuft unabhängig vom
      Ausgang, und `angefordert` ist das Einzige, was Formular von „der Link ist
      unterwegs" trennt. **Nachgemessen an `index.ts:99-126`:** fehlendes Secret
      → 500, DB-Fehler → 502, kaputter Rumpf → 400; `requestActivationLink`
      wirft bei jedem Nicht-2xx. Alle drei enden in derselben grünen Meldung.
      Vorbestehend — aber `/passwort-vergessen` ist ab AGE-505 der **einzige**
      Rückweg eines aktivierten Kontos. Fix: `catch`, eigener Fehlerzustand, und
      er darf nicht klingen wie die drei Anti-Aufzählungs-Ausgänge.
- [ ] 8.3 **Die Route-Verdrahtung ist durch keinen Test geschützt** (Senior +
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
- [ ] 8.4 **Die Weiterleitung wurde nicht zweck-abhängig gemacht**
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
- [ ] 8.5 **Kein Zweig für einen unbekannten Status** (Silent-Failure-Hunter).
      `index.ts:139` fasst vier Status plus **alles Unbekannte** in eine
      `info`-Zeile. Der genannte Ablauf: Function deployt, Migration nicht →
      DB antwortet weiter `already_activated` → kein Mitglied bekommt je eine
      Reset-Mail, und das einzige Signal sieht aus wie der Normalfall.
      **Nachgemessen und entschärft:** `20260807200000` **ist** auf
      `foelowldexkcqzewvrcf` angewandt (dem Projekt, auf das das Deployment
      zeigt) — die Function trägt `issued_reset`. Nicht akut, aber die
      Absicherung fehlt: Erlaubnisliste + `error` für Unerwartetes.
- [ ] 8.6 **Der abgeleitete Zweck trägt nur, solange `activated_at` genau einen
      Schreiber hat** (Senior). `mark_activated` mit
      `coalesce(activated_at, now())` ist heute der einzige, eine Deaktivierung
      gibt es nicht. Genau das ist die unausgesprochene Bedingung des Entwurfs
      „Zweck ableiten statt speichern". Wer je eine Sperrfunktion baut, die
      `activated_at` auf `null` setzt, macht jedes ausstehende Reset-Token zum
      Re-Aktivierer. Gehört als Warnung an `mark_activated` in
      `20260806080200`, nicht nur in den Kopf von `20260807200000`.
- [ ] 8.7 Kleinkram, gesammelt: Adressvalidierung
      (`ActivationRedeemPage.tsx:127`) kehrt bei Tippfehler **wortlos** um, der
      Knopf wirkt kaputt (`noValidate` schaltet die Browser-Prüfung ab) ·
      `entwerten()` protokolliert `token_invalidated` auf `info`, auch wenn
      **null** Zeilen getroffen wurden (`index.ts:165`) · `EdgeRuntime?.waitUntil?.`
      überspringt den Versand still, wenn die Laufzeit es nicht hat ·
      `instrument.test.ts:41` prüft die Fragment-Aufräumung nur auf
      `/aktivierung`, nicht auf `/passwort-neu` · `LoginPage.test.tsx` belegt den
      Link, aber nicht die Bedingung `mode === "login"`.

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
