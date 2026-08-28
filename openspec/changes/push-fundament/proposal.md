# Push-Fundament: ein Transport auf den Hinweisen, die es schon gibt

Linear: **AGE-641**

## Why

Push ist hier **kein neues Gerüst**. Die Ereignis-Ebene steht seit Juni und
wurde am 27.08. ausgebaut: `notifications` trägt jede Zeile, die jemand sehen
soll, die Glocke liest sie über Realtime, und `member_settings` hält je Typ
einen Schalter. Was fehlt, ist ein zweiter Zustellweg für dieselben Zeilen.

Gemessen im Worktree am 27.08. — und in mehreren Punkten **anders als das Issue
annimmt**:

| Typ | schreibt seit | Opt-out heute |
| --- | --- | --- |
| `contact_request` | 14.06. | **keiner** |
| `contact_request_accepted` | 14.06. | **keiner** |
| `contact_request_declined` | 14.06. | **keiner** |
| `post_created` | 27.08. | `notify_inapp_post` |
| `event_created` | 27.08. | `notify_inapp_event` |
| `comment_on_post` | 27.08. | `notify_inapp_comment` |
| `like_on_post` | 27.08. | `notify_inapp_like` |
| `release_note` | 27.08. | **keiner — mit Absicht** |
| **`message`** | **fehlt ganz** | **fehlt ganz** |

Also **acht** schreibende Typen, nicht vier. Weitere Messungen: keine
Check-Constraint auf `notifications.type` (blankes `text`), und **null**
`pg_net`-Aufrufe im Migrationsbaum — die Edge Functions hängen an Database
Webhooks, die in der Supabase-Konsole stehen.

> **Diese Tabelle stand zuerst falsch hier.** Die erste Fassung zählte sieben
> Typen und übersah `release_note` (`20260827140000:140`), obwohl er am selben
> Tag dazukam. Gefunden hat es die Plan-Review, nicht ich. Der Fehler war nicht
> folgenlos: aus ihm folgte die Behauptung „jeder Typ hat einen Schalter", die
> dem geltenden Spec widerspricht (`specs/notifications/spec.md:340`), der genau
> für diesen Typ **keinen** Schalter verlangt. Siehe `REVIEWS.md`.

**Die drei Kontaktanfrage-Typen schreiben seit Juni Zeilen**
(`20260614100000:45,73,90`) und die Glocke rendert sie
(`HinweisGlocke.tsx:166-180`). Für Abschnitt 4 des Issues heißt das: „Kontakt-
anfrage erhalten oder angenommen → Push: Ja" braucht **keinen neuen Trigger**.
Es heißt aber auch, dass genau diese drei heute **nicht abschaltbar** sind — und
ein Push ohne Abschalter ist genau der, der jemanden dazu bringt, Push ganz
abzuschalten.

**Und ihre Nutzlast trägt Freitext.** `20260614100000:54` schreibt
`'message', new.message` — eine von einem Mitglied geschriebene Nachricht. Das
ist ausgerechnet der Typ, den Abschnitt 4 pushen will, und der einzige mit
echtem Menschentext in der Zeile. Beim Nachmessen kam heraus, dass die Glocke
ihn **nie anzeigt** (`HinweisGlocke.tsx:166-168` baut den Satz aus `from_name`):
er wird seit Juni geschrieben und nirgends gelesen.

**Chat-Nachrichten schreiben gar keine Zeile.** Der Hauptgrund für die App ist
der einzige Vorgang der Plattform ohne Hinweis.

**Und der Name lügt, sobald Push mitfährt.** `member_settings` trägt
`notify_email_requests/events/digest` **neben** `notify_inapp_post/event/
comment/like`. Die Konvention ist `notify_<transport>_<ereignis>` — sie trägt
bereits einen zweiten Transport. `notify_inapp_*` für Push mitzubenutzen
widerspricht damit nicht nur dem Wortsinn, sondern einer Regel, die in derselben
Tabelle schon Arbeit leistet. Donald am 27.08.: umbenennen auf `notify_app_*`.

## What Changes

- **`push_tokens`, owner-only, mehrere Geräte je Mitglied.** Ein Gerätetoken ist
  ein Zustellweg zu einer Person; wer fremde Token liest, kann fremde Menschen
  benachrichtigen. Kein `unique (profile_id)` — mehrere Geräte sind der
  Normalfall. Per pgTAP belegt, nicht behauptet.
- **Fünfter Typ `message`**, Trigger auf `messages`, eigener Schalter. Der
  Hinweis nennt **wer** geschrieben hat und **in welchem Gespräch** — und trägt
  den Text nicht. Nicht erst der Push filtert ihn heraus: er steht schon in der
  `notifications`-Zeile nicht drin, also kann kein Transport ihn ausliefern.
- **Derselbe Schnitt für Kontaktanfragen.** Der Juni-Trigger schreibt seinen
  Freitext künftig nicht mehr in die Nutzlast. Die Glocke verliert nichts, weil
  sie ihn nie las.
- **Umbenennung `notify_inapp_*` → `notify_app_*`**, plus `notify_app_message`
  und `notify_app_contact`. Ein Schalter je Ereignis, der **beide** Wege steuert
  — Glocke und Push. Zwei Schalter für dasselbe Ereignis wären eine Falle.
- **Der Juni-Trigger wird an den Schalter verdrahtet.** `notify_app_contact`
  allein anzulegen genügt nicht: `handle_contact_request_change()` schreibt
  heute **unbedingt** und ruft `hinweis_erwuenscht` mit keinem einzigen Aufruf.
  Ohne diese Verdrahtung stünde in den Einstellungen ein Schalter, der nichts
  tut — schlimmer als keiner.
- **Edge Function `send-push`**, angestoßen von einem Database Webhook auf
  `notifications` — derselbe Bau wie `notify-contact-request`. Sie liest **und
  löscht** über DEFINER-RPCs, weil `service_role` in `public` keine
  Tabellenrechte hält (AGE-623), prüft Aktivierung und Schalter, schickt an FCM
  und APNs und entfernt dauerhaft abgelehnte Token.
- **Die Benachrichtigung wird aus einer festen Feldliste gebaut**, nie aus der
  durchgereichten Nutzlast. Die alten Zeilen tragen den Freitext weiter; nur
  dieser Filter schützt sie.
- **`push_routing` als Tabelle, nicht als `case`.** Welcher Typ gepusht wird,
  ist eine Zeile, kein Deploy. Ein Typ **ohne** Eintrag wird nicht gepusht —
  eine fehlende Zeile ist keine Erlaubnis.

## Was ausdrücklich NICHT dazugehört

- **Kein zweites Ereignissystem.** Push liest `notifications`. Kein Polling,
  keine eigene Warteschlange, keine parallele Wahrheit darüber, wer was sehen
  soll.
- **Kein Push für `release_note`.** Der eine Typ ohne Abschalter ist der eine,
  der niemandem aufs Gerät gehört. Er bleibt in der Glocke.
- **Keine Bündelung.** Abschnitt 4 will neue Events „gebündelt statt sofort".
  Bündelung ist eine Zustellzeit-Mechanik, kein Transport; `event_created` steht
  darum vorerst auf `push = false` und bekommt einen eigenen Vorgang.
- **Keine Änderung an bestehenden Zeilen.** Die seit Juni geschriebenen
  Kontaktanfrage-Nutzlasten behalten ihren Freitext (Donald, 27.08.): eine
  schreibende Änderung an echten Mitgliederdaten auf PROD ist der Schutz nicht
  wert, den der Transportfilter ohnehin liefert.
- **Kein Rich Push, keine Antwort aus der Benachrichtigung, keine geplanten
  Zustellzeiten** (Issue, ausdrücklich).
- **Der tote `member_joined`-Zweig** in `HinweisGlocke.tsx:172` bleibt liegen —
  kein Schreiber im Migrationsbaum, aber fremder Code und eigener Vorgang.
- **Genau zwei Web-Komponenten, beide erzwungen.** `EinstellungenPage.tsx`, wo
  die Umbenennung acht Bezeichner und zwei neue Schalter erzwingt (Donald,
  27.08.: eine Spaltenumbenennung ist atomar und darf nicht halb landen), und
  `HinweisGlocke.tsx`, das für einen fünften Typ einen Renderer braucht — ein
  Hinweis ohne Renderer stünde als „Es gibt etwas Neues." in der Glocke.
  *(Die erste Fassung dieses Absatzes sagte „keine außer EinstellungenPage" und
  widersprach damit der eigenen Aufgabenliste. Gefunden von Reviewer 2.)*

## Reihenfolge

Dieser Change hat **zwei Phasen mit einem Halt dazwischen** (Donald, 27.08.).
Phase A ist ohne App baubar und messbar. Phase B braucht eine native Hülle —
ohne sie gibt es kein Gerätetoken. Dazwischen liegt **AGE-642**.

| Phase | Inhalt | Wann |
| --- | --- | --- |
| **A — Server** | Tabellen, Umbenennung, Trigger, RPCs, `send-push`, pgTAP | jetzt |
| ⏸ | **AGE-642 Capacitor-Hülle** | dazwischen |
| **B — Client** | Registrierung, Erlaubnis-Dialog, Zustellung am Gerät | danach |

## Bekannte Flächen außerhalb des Diffs

Der Webhook, der `send-push` anstößt, wird **in der Supabase-Konsole**
eingetragen, nicht im Repo — genau wie der für `notify-contact-request`. Er
taucht in keinem Diff auf und muss in **DEV und PROD getrennt** gesetzt werden.
Ebenso liegen FCM- und APNs-Schlüssel als Function-Secrets, nicht im Baum.
