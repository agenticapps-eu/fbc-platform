# Review 8.7 — Unabhängiges Code-Review

**Datum:** 2026-08-07 · **Umfang:** `ac8d73f..27e903b` (PRs #120/#127/#128),
39 Code-Dateien, ~11.400 Zeilen · **Verfahren:** vier Reviewer in je eigenem
Kontext, ohne die Sitzungsgeschichte, nur lesend. Linsen: RLS-Gate · Edge
Functions · Frontend/Token · Test-Substanz.

Jeder Reviewer bekam die im Repo bereits aufgetretenen Fehlermuster mit — die
`try_as()`-Falle, die Drei-Stellen-Regel für `profiles_public`, die
Mock-Zirkelschlüsse. Ein Reviewer, der die `try_as()`-Falle nicht kennt, hält
einen Syntaxfehler für eine bestandene Sicherheitsprüfung.

**Nachgeprüft:** Befunde B1, R1, R2, F1, F2, F3 und T-D sind gegen den Code
bzw. gegen die laufende Instanz selbst nachgemessen, nicht übernommen. Der
Rest steht als Reviewer-Aussage.

---

## B1 — BLOCKER · Kein CORS-Preflight, der Browserweg ist tot

`send-activation/index.ts:68` · `resend-activation/index.ts:61` ·
`redeem-activation/index.ts:58`

Alle drei beantworten jede Nicht-POST-Methode mit `405` **ohne**
`Access-Control-*`-Header. Gemessen gegen `foelowldexkcqzewvrcf`:

| Function                  | OPTIONS | `Access-Control-Allow-Origin` |
| ------------------------- | ------- | ----------------------------- |
| `send-activation`         | 405     | fehlt                         |
| `resend-activation`       | 405     | fehlt                         |
| `redeem-activation`       | 405     | fehlt                         |
| `create-checkout-session` | 200     | `*`                           |

Die Antwort trägt `x-deno-execution-id` und `x-served-by:
supabase-edge-runtime`, Body `Method Not Allowed` — **die Function antwortet,
nicht das Gateway.** Das Frontend ruft alle drei über
`supabase.functions.invoke` (`src/lib/activation.ts:68,83,91`); das setzt
`Content-Type: application/json` und erzwingt damit einen Preflight.

**Warum es bis heute unsichtbar war.** Die Ende-zu-Ende-Belege aus 8.3 und
10.5/10.8 sind HTTP-Antworten der Functions — über den Preflight sagen sie
nichts. Der Serverweg ist gemessen, der Browserweg nie. Dieselbe Klasse wie
die zwei Blocker vom 06.08.: die Prüfung bestand, weil sie die falsche Fläche
traf.

`notify-contact-request` verhält sich identisch, ist aber **kein**
Gegenbeweis — sie wird von nirgends im Frontend aufgerufen (`grep` über `src/`
und `supabase/migrations/` ist leer).

**Fix:** die vier Zeilen aus `create-checkout-session/index.ts:18-32` in jede
der drei Functions. Danach **am Browser** gegenmessen, nicht per curl.

### Behoben 07.08. — rot vorher, grün nachher

`CORS`-Konstante, `OPTIONS`-Zweig und die Header auf **jeder** Antwort (auch
den Fehlerantworten — sonst kann der Browser die Fehlermeldung nicht lesen).
`deno check` grün, deployt gegen `foelowldexkcqzewvrcf`. Gemessen:

|                        | vorher             | nachher                                    |
| ---------------------- | ------------------ | ------------------------------------------ |
| `OPTIONS` (alle drei)  | `405`, kein `ACAO` | `200`, `ACAO: *`, `ACAH` gesetzt           |
| `POST send-activation` | —                  | `202`, `ACAO: *`, Body `{"accepted":true}` |

Der zweite Wert ist der wichtigere: ein bestandener Preflight allein reicht
nicht, die eigentliche Antwort muss den Header auch tragen.

**Ehrliche Grenze dieser Messung.** Sie ist mit `curl` gemacht, und `curl`
erzwingt CORS nicht. Was sie belegt, ist die **Serverseite** vollständig —
also genau das, was der Browser prüft, und genau das, was vorher fehlte.
Was sie **nicht** belegt, ist der Client-Pfad durch `functions.invoke`.
Ein echter Klick auf „Bestätigungslink senden" bleibt die letzte Abnahme;
er gehört zu 10.4. **Nicht dieselbe Prüfung wiederholen, die den Befund erst
möglich gemacht hat** — der Serverweg war auch am 06.08. grün.

---

## B2 — HOCH (operativ) · Auf PROD existiert keine der drei Functions

`viwntbodrtqxgmqyxluh` antwortet für `send-/resend-/redeem-activation` mit
`404 NOT_FOUND`, während `notify-contact-request` und
`create-checkout-session` dort liegen. Vermutlich die offene Freigabe 10.3 —
aber der Umschaltweg in `docs/supabase-environments.md:436` ist „zwei
Infisical-Werte + Re-Deploy". Danach zeigt das Frontend auf ein Projekt ohne
Aktivierungs-Functions, und C10 liefe in ein Feld gesperrter Konten.
→ gehört auf die Vorbedingungsliste 11.2.

**Behoben 07.08.**, rot vorher / grün nachher gemessen. Rot: `OPTIONS` auf alle
drei → `404`. Deploy mit `supabase functions deploy send-activation
resend-activation redeem-activation --project-ref viwntbodrtqxgmqyxluh`. Grün:

|                                                | belegt womit                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Code ist **derselbe**, nicht nur ein ähnlicher | `ezbr_sha256` byte-gleich mit `foelowldexkcqzewvrcf`: `2d58d7e4c077` · `7788f54b506c` · `3f649770921c`                     |
| B1 gilt auch auf PROD                          | `OPTIONS` → `200` mit `ACAO: *` und `ACAH` auf allen dreien                                                                |
| `verify_jwt` stimmt                            | `false` / `true` / `false` — aus `config.toml`, nicht von Hand gesetzt                                                     |
| die drei Function-Secrets **stehen**           | `POST send-activation` → `202`; der `missing_config`-Zweig (`index.ts:94`) liegt **vor** dem RPC und hätte `500` geliefert |

_Grenze der letzten Zeile: das `202` belegt die Secrets, **nicht** den
Datenbankweg — es ist dieselbe Antwort, die die Function zur Abwehr von
Adressaufzählung in fast jedem Zweig gibt. Dass `issue_activation_token` auf
PROD existiert, folgt aus der am 07.08. beidseitig nachgemessenen Migration,
nicht aus dieser Zahl._

_Der Deploy war benannt, nicht pauschal: `notify-contact-request` trägt auf PROD
einen abweichenden `ezbr_sha256` (`6c0358f462eb` gegen `046dfb9d9619`) und
wurde bewusst nicht mitgezogen — eigener Nachlauf, festgehalten als 11.4._

---

## RLS-Gate

### R1 — MITTEL · `recompute_potential_score(uuid)` ist ungegatet

Grant `20260613230000_potential_score.sql:219` (`to authenticated,
service_role`), Rumpf `20260804200100_potential_score_kompass_label.sql:22-191`.
`security definer`, **kein** `is_activated()` im Rumpf (nachgeprüft).
Einziger Schutz: `v_caller <> p_profile_id` (`:57`) — also „nur auf mich
selbst".

**Der Change überführt sich hier selbst.** `20260806080100_activation_gate.sql:24`:

> „Ein `or id = auth.uid()`-Zweig waere deshalb keine Ausnahme, sondern die
> Luecke."

Und aus gutem Grund: der Angreifer _ist_ für die Datenbank das Mitglied. Die
RPC liefert Zählungen über Beiträge, Kommentare, Angebote, Gesuche,
Event-Anmeldungen, angenommene Kontaktanfragen und Feedback — und **schreibt**
`profiles.potential_score` (`:129`) sowie `profile_theme_scores` (`:154`), an
zwei gegateten Write-Policies vorbei. `INVENTORY.md:125` rechtfertigt die
Ausnahme mit eben jener Eigenprüfung; die Begründung trägt nach der eigenen
Doktrin nicht.

**Fix (eine Zeile, hinter der `v_caller`-Prüfung):**
`if v_caller is not null and not public.is_activated() then raise exception
'not activated' using errcode='42501'; end if;`
Die `v_caller is not null`-Bedingung ist nötig, weil Seeds und `service_role`
mit `auth.uid() = null` laufen.

### Behoben 07.08. — rot vorher, grün nachher **gemessen**

Migration `20260807090000_activation_gate_nachlauf.sql`. Die Rot-Messung war
schärfer als die Code-Lektüre: `try_as()` lieferte für das nicht aktivierte
Konto **`'OK'`** — die Funktion lief glatt durch —, und `profile_theme_scores`
trug danach **4 Zeilen**. Der Write-Bypass war damit nicht hergeleitet, sondern
beobachtet. Nach dem Fix: `DENIED:…not activated`, 0 Zeilen. Gegenprobe in
13.10: nach der Bestätigung läuft die Funktion wieder durch (`'OK'`) — die
Sperre ist ein Gate, keine kaputte Funktion.

### R2 — NIEDRIG · `is_activated_profile(uuid)` ist ein ungegatetes Orakel

`20260806080100_activation_gate.sql:53-71`, `grant execute … to
authenticated`, kein Gate im Rumpf (nachgeprüft). Ein Bit pro UUID: _wer sitzt
noch auf dem Rundmail-Passwort_. Die UUIDs sind ausgeloggt über
`posts.author_id` / `events.host_id` abgreifbar (die Anon-Policies geben alle
Spalten frei). Keine Datenpreisgabe, aber Zielauswahlhilfe in genau diesem
Bedrohungsmodell. Fix: `select public.is_activated() and coalesce(…)`.

### R3 — Zählbasis · `INVENTORY.md` zählt zwei neue DEFINER, es sind vier

Dazu `is_activated_profile(uuid)` und `request_own_activation_token(text,
interval)`. Für das nächste Gate ist die Basis damit falsch.

### Was hält

52 lebende Policies — 46 gegatet, 5 gewollte Anon-Policies, 1
Plattform-Flag ohne Personenbezug. **Keine permissive Altpolicy hat
überlebt** (Policies ODERn — die gefährlichste Ausfallform). Alle 31
DEFINER-Funktionen mit gesetztem `search_path`. `activated_at` client-seitig
nicht schreibbar (`revoke update` + reine Spalten-Grants, in denen die Spalte
fehlt). `activation_tokens`/`activation_attempts`: RLS an, null Policies, null
Grants. `search_directory` ist INVOKER und damit transitiv gedeckt. Realtime
führt nur `messages`, und die ist gegatet.

---

## Edge Functions

- **E1 MITTEL** — Stiller Versandfehler sperrt bis zu 24 h aus.
  `send-activation/index.ts:149-157` protokolliert einen Resend-Fehlschlag nur;
  der Aufrufer sah längst `202`. Das Token liegt danach **gültig** in der
  Tabelle, und `20260806090000:190-201` antwortet auf jeden weiteren anonymen
  Anlauf mit `pending` — kein Versand, kein neues Token, 24 Stunden. Genau der
  10.5-Fall erzeugt das.
- **E2 MITTEL** — `resend-activation` entwertet erst, sendet dann
  (`index.ts:85-147`). Scheitert Resend, ist der alte Link ungültig, der neue
  Klartext weg, 60-s-Sperre und Tageskontingent verbraucht.
- **E3 MITTEL** — Die Einlöse-Drossel bremst nichts (bestätigt 14.6).
  `redeem-activation/index.ts:104` nimmt die IP aus `x-forwarded-for`, frei
  wählbar. Schlimmer: pro Fehlversuch läuft `claim_activation_token` **plus**
  `note_failed_activation` mit `DELETE + INSERT + COUNT` — auch im gesperrten
  Zustand. Ein Angreifer erzeugt mit der Drossel mehr DB-Arbeit als ohne.
- **E4 MITTEL** — Secrets werden auf Vorhandensein geprüft, nicht auf
  Brauchbarkeit (`send-activation/index.ts:79-89`). `APP_URL` gegen `^https://`
  prüfen und einen Resend-`403` als eigenen, lauten Logfall behandeln.
- **E5 NIEDRIG** — Enumerationsleck über `502`: zwei gleichzeitige Aufrufe mit
  derselben Adresse laufen in den partiellen Unique-Index
  (`20260806080000:65-67`) → `502`. Für eine unbekannte Adresse unmöglich (die
  endet vorher mit `202`). Der einzige Statuscode, der die 202-Bauart
  durchbricht.
- **E6 NIEDRIG** — Die Antwortzeit ist nicht konstant, der Kommentar
  (`index.ts:18-20`) sagt es aber zu: der RPC-Aufruf liegt **vor** der Antwort.
- **E7 NIEDRIG** — `redeem-activation/index.ts:127` setzt kein
  `email_confirm: true`. Heute folgenlos; wird die Bestätigung je
  eingeschaltet, sind alle aktivierten Mitglieder ausgesperrt.

**Sauber geprüft:** Token 32 Byte aus `crypto.getRandomValues` (256 Bit),
base64url, gespeichert nur als SHA-256. Klartext **nur** im Fragment — nicht
im Body, in keiner Logzeile, in keiner Fehlermeldung. `claim_activation_token`
(`20260806080200:128-134`) beansprucht in _einer_ Anweisung; zwei parallele
Einlösungen können nicht beide durchkommen. `verify_jwt` false/true/false je
Function stimmig — und richtig erkannt, dass `verify_jwt = true` allein nicht
trägt (der anon-Key ist selbst ein gültiges JWT); die Sicherung ist der Grant
auf `request_own_activation_token`. Kein Mail-Relay: Versand geht immer an
`login_email` aus `auth.users`. Reihenfolge Claim → Passwort → Sitzungen →
Aktivieren ist richtig herum.

---

## Frontend / Token

- **F1 MITTEL** — `/onboarding` liegt außerhalb des Gates (`App.tsx:152`; der
  gategeschützte Zweig endet `:143`, die Route trägt nur `RequireAuth`).
  Nachgeprüft. Ein unbestätigtes Konto sieht den vollen Kompass-Assistenten
  statt der Wand und bekommt am Ende einen rohen RLS-Fehlertext. Kein
  Datenabfluss — die RLS hält —, aber `ActivationGate.tsx:8` sagt „egal welche
  Route".
- **F2 MITTEL** — `isActivated === null` endet im weißen Bildschirm.
  `AuthProvider.tsx:113` sagt ausdrücklich _„die Oberfläche soll hier einen
  Fehler zeigen"_; `ActivationGate.tsx:34` gibt `return null` zurück.
  Nachgeprüft. Die Absicht steht da, die Umsetzung fehlt: nach drei
  Fehlversuchen dauerhaft nichts, ohne Meldung, ohne Ausweg. Die Entscheidung
  _fail closed heißt warten_ ist richtig — es fehlt die Unterscheidung
  zwischen „warte noch" und „aufgegeben".
- **F3 NIEDRIG** — Kein `path="*"`: ein Tippfehler zeigt einem unbestätigten
  Konto nichts statt der Wand. `App.redirects.test.tsx:30` hält es selbst fest.
- **F4 NIEDRIG** — `ActivationRedeemPage.tsx:32` liest das Token in einem
  `useState`-Initializer, und `leseTokenAusFragment()` ist **zerstörend**. Unter
  `StrictMode` (`main.tsx:22`) ruft React den Initializer im Dev-Build mehrfach
  auf → der committete Aufruf findet `null`. Prod unbetroffen; wer den Weg
  lokal nachstellt, misst ein falsches Verhalten.
- **F5 NIEDRIG** — `neuenLinkAnfordern` (`ActivationRedeemPage.tsx:74-84`) ist
  `try/finally` **ohne** `catch`: bei Transportfehler unhandled rejection, und
  die Oberfläche meldet trotzdem „Link ist unterwegs".

**Klarstellung, wichtiger als ihr Schweregrad:** Passwort**ändern** braucht nur
eine Session, nicht das Token (`AuthProvider.tsx:175`). Das Konstrukt hält —
`activated_at` setzt ausschließlich `redeem-activation` —, aber der Anspruch
„Passwortsetzen ist ohne gültiges Token nicht möglich" aus der Abnahmeliste
stimmt so nicht. Richtig ist: _Aktivieren_ geht nur mit Token.

**Sauber geprüft:** kein Token-Leck über Referrer, History, Storage, Logs oder
Sentry-Replay; `/aktivierung` trägt `no-referrer` (`public/_headers`). Der
Schutz hängt aber an einer einzigen Zeile (`instrument.ts:18`) und greift nur,
solange der Fragment-Parameter exakt `token` heißt — ein `beforeSend` als
zweite Sperre fehlt.

---

## Test-Substanz

### T-D — MITTEL · Stille Verhaltensänderung auf der öffentlichen Seite

`post_engagement_counts()` und `event_registration_counts()` sind weiterhin
`to anon, authenticated` gegrantet (`20260806080100:536`, `:558`), tragen aber
seit diesem Change `and public.is_activated()` als unbedingten Konjunkt
(nachgeprüft). Für einen ausgeloggten Aufrufer ist das `false` → **beide
liefern anon leer.** Vorher filterte die Fassung `20260615120000` für anon nur
auf `visibility = 'public'` und lieferte die Zahlen.

Folge: Das Schaufenster zeigt ausgeloggten Besuchern **0 Likes, 0 Kommentare,
0 Teilnehmer**. Und zwar still — `src/lib/feed.ts:313` und
`src/lib/events.ts:256` melden nur einen _Fehler_ an Sentry; es kommt aber kein
Fehler, nur ein leeres Ergebnis. Kein Test würde davon rot.

**Behoben 07.08.**, rot vorher / grün nachher gemessen. Der Konjunkt lautet
jetzt `((select auth.uid()) is null or public.is_activated())`: anon passiert,
angemeldet gilt das Gate. Rot war er eindeutig — anon bekam `0`, erwartet `1`.
Vier neue Assertions in 13.7a decken beide Richtungen ab, plus eine Gegenprobe
in 13.10, dass die Zahlen nach der Bestätigung wiederkommen.

_Verworfene Alternative: den Grant `to anon` entziehen und die Zahlen im
Schaufenster ausblenden. Kleinere Codeänderung, kehrt aber Detlevs erklärten
Wunsch um — und der Grant war ja gerade der Hinweis, dass die Sperre nicht
gewollt war._

### Tests, die etwas anderes messen als ihren Namen

- `ActivationGate.test.tsx:52-55` — der ausgeloggte Fall wird nicht geprüft:
  `isActivated: true` erreicht den Inhalt schon über Zeile 38. Löscht man
  Zeile 29 — die Zeile, die der Test schützen soll — bleibt er grün.
- `ActivationGate.test.tsx:16` — die Factory ersetzt das **ganze** Modul und
  exportiert nur `requestActivationLink`; `ActivationScreen` importiert aber
  `resendActivationLink` (`ActivationScreen.tsx:4`), die im Test `undefined`
  ist. Nachgeprüft. Grün nur, weil kein Fall den Knopf drückt — während der
  Docstring darüber beansprucht: „Gemockt wird ausschließlich der Netzwerkrand."
- `instrument.test.ts:46-52` — Assertion auf den Zustand, den der Test zwei
  Zeilen vorher selbst gesetzt hat. Bleibt grün, wenn `instrument.ts` gar nicht
  läuft.
- `probe-activation-gate.ts:233-241` — misst immer 0: `profiles_public` trägt
  `is_activated()` im Rumpf, auf einer nackten `pg`-Verbindung ist `auth.uid()`
  NULL. Die gedruckte Zahl liest sich wie ein Beleg, ist aber Kulisse.
- `probe-activation-gate.ts:84-95` — 6 der 10 „eigenen Daten" belegen nichts:
  für `compass_responses`, `feedback`, `message_threads`, `messages`,
  `contact_requests`, `staff_roles` hatte das Sondenkonto nie eine eigene Zeile.

### Lücken — was schlicht ungeprüft ist

`20260806080100` gatet **46 Policies**; Abschnitt 13 von `rls_test.sql` berührt
davon **18**.

- **SELECT ungeprüft (9):** `profile_badges`, `event_registrations`, `matches`,
  `contact_requests`, `message_threads`, `messages`, `partners`,
  `routing_queue`, `staff_roles`.
- **Schreibend ungeprüft (19)**, darunter `storage.objects` mit drei gegateten
  Policies und **null** Assertions.
- **Das „drei statt acht"-Muster wiederholt sich:** `goals_own`,
  `notifications_own`, `member_settings_own` sind `for all`, geprüft ist nur
  SELECT. Umgekehrt bei `posts/offers/needs_write_own`: nur INSERT, nicht
  UPDATE/DELETE.
- **`activation_attempts`** bekommt 2 von 8 Rechten geprüft — während die
  Zwillingstabelle `activation_tokens` bei `:707-725` alle 8 + 1 hat, mit dem
  Kommentar, dass ein späteres `grant update` sonst unbemerkt durchginge.
  Dieselbe Asymmetrie in `grants_test.sql`.
- **`is_activated_profile()`** steht in sieben Policies; geprüft ist eine.
- **Keine Testdatei für `redeem-activation`** — die sicherheitskritische
  Reihenfolge (Passwort → `revoke_sessions` → `mark_activated` **zuletzt**)
  entscheidet, ob ein Teilfehlschlag das Gate offen lässt. Nichts prüft sie.
- `rate_limited_day` (5/Tag) in keiner Datei getestet. `revoke_sessions()` nur
  über Grants belegt, nicht in der Wirkung.
- `ActivationRedeemPage.test.tsx:14` verspricht „die sieben Fälle"; `not_found`,
  `retry_needed` und `error` fehlen — `retry_needed` ist der heikelste.

### Was hält

`plan(153)` stimmt exakt (136 `is`, 15 `alike`, 1 `cmp_ok`, 1 `throws_ok`, alle
unbedingt). `like(` kommt nirgends vor. Die fünf RPC-Gate-Assertions
(`:655-667`) ankern **richtig** auf `'DENIED:%not activated%'` statt auf
`'DENIED:%'` — genau die Vorsichtsmaßnahme, die die `try_as()`-Falle
entschärft. Keine Mock-Zirkelschlüsse auf eigene Komponenten. Die Fixtures
legen dem Sondenkonto eigene Zeilen an, um „0 aus leerer Tabelle" zu vermeiden.

---

## Reihenfolge

1. **B1** — der einzige Befund, der den ganzen Weg blockiert. Vier Zeilen.
2. **B2** — auf die Vorbedingungsliste 11.2.
3. **T-D** — stille Regression auf der öffentlichen Seite, ohne Test und ohne
   Signal.
4. **R1**, **F1**, **F2** — je eine bis wenige Zeilen.
5. **E1/E4** — beide sind Wiedergänger der zwei Blocker vom 06.08. in der
   nächsten Verkleidung: gesetzt und falsch, statt fehlend.
6. Testlücken nach der Liste oben; **R2**, **E3**, **F3-F5** danach.
