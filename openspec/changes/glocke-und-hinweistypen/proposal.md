# Glocke verdrahten und vier Hinweistypen

Linear: **AGE-620**

## Why

Die Glocke in der Kopfzeile ist ein toter Knopf. Gemessen in `AppShell.tsx:566`:
ein `<button>` mit `aria-label="Benachrichtigungen"`, ohne `onClick`, ohne
Zähler. Und im Frontend gibt es **null** Lesezugriffe auf `notifications`.

Gleichzeitig schreiben schon **drei** Typen in die Tabelle (`contact_request`,
`contact_request_accepted`, `contact_request_declined`), aus
`SECURITY DEFINER`-Funktionen. Diese Hinweise entstehen seit Juni und hat noch
nie jemand gesehen.

## What Changes

- Die Glocke liest die eigenen `notifications`, zeigt die Ungelesen-Zahl und
  markiert gelesen — einzeln und alle. Bei null zeigt sie **keine** Zahl.
- **Vier** neue Typen, geschrieben von Triggern auf `posts`, `events`,
  `comments` und `post_likes`.
- **Opt-out je Mitglied und je Typ** in den Einstellungen, per Default AN.
- Die Anforderung für die Glocke wird aus `add-lifecycle-notifications`
  (AGE-299) **herausgelöst**; jener Change behält den Mail-Teil.

## Zwei Korrekturen aus der Plan-Review, beide nachgemessen

Der erste Entwurf hatte einen **falschen Kernbefund** und einen Typ zu viel.

### 1. Die Stufenschwelle für Beiträge gibt es nicht mehr

Der erste Entwurf behauptete, ein Fan-out „an alle aktivierten" umgehe eine
RLS-Grenze, weil `posts_select_by_visibility` bei `visibility='members'` ein
`has_level(4)` verlange — und `'members'` ist der Default.

**Das war an einer überholten Fassung gemessen.** `20260826100000_members_sind_alle_aktivierten.sql`
(AGE-601) hat die Policy am **26.08.** ersetzt, einen Tag vor der Messung:

```sql
public.is_activated()
and ( visibility = 'public' or visibility = 'members' or author_id = auth.uid() )
```

Keine Schwelle. Der Kommentar der Migration sagt auch warum: *„in PROD trägt
jeder Beitrag `members`, eine Schwelle darüber machte den Feed nicht dünner,
sondern leer."*

Dazu: `prime` und `legacy` sind seit `20260715150000` per **Check-Constraint**
verboten (`check (visibility in ('public','members'))`) — für `posts` wie für
`events`. Die Beispiele des ersten Entwurfs („ein Beitrag, den nur sein Autor
lesen darf") sind damit nicht einmal herstellbar.

**Die Empfängermenge ist also schlicht: jedes aktivierte Mitglied außer dem
Auslöser.** Das ist weniger dramatisch als der erste Entwurf, und es ist wahr.

### 2. Der Typ „neues Mitglied" entfällt

Donald am 27.08., nachdem die Startwoche durchgerechnet war: aktivieren sich
~70 Mitglieder nacheinander, bekommt das zuletzt aktivierte **69** Hinweise
„neues Mitglied" auf einmal. Keine Lastfrage — eine Bedienfrage: die Glocke
wäre in Woche eins praktisch nur dafür da, und die übrigen Typen gingen darin
unter.

Der Typ ist zugleich der mit dem geringsten Nutzen — wer neu ist, steht ohnehin
im Verzeichnis. Nachzurüsten ist trivial, sobald der Zustrom bei ein bis zwei
pro Woche liegt.

**Damit entfällt der Trigger auf `profiles` ganz** — und mit ihm die gesamte
Frage nach dem richtigen Ereignis (INSERT? UPDATE von `activated_at`?), nach
Reaktivierung, nach dem Import und nach einem Schutzschalter. Vier von
opencodes Pflicht-Änderungen lösen sich dadurch auf, statt beantwortet zu
werden.

## Der Befund, der stattdessen trägt

Ein Event mit Host wird von `trg_event_feed_post`
(`20260813100000_posts_kind_event_trigger.sql:220`) **synchron als
`posts`-Zeile gespiegelt**, mit `kind='event'`, gleicher `visibility` und dem
Host als Autor. Ein Fan-out über `posts` ohne Rücksicht darauf kündigte jedes
Event **zweimal** an, an denselben Empfängerkreis.

Der Trigger auf `posts` feuert deshalb nur für `kind = 'member'`. Der Trigger
auf `events` bleibt eigenständig — sonst bekäme ein Event **ohne** Host gar
keine Ankündigung, weil für dieses kein Spiegelbeitrag entsteht.

## Wie der Fehler oben NICHT wiederkommt

Der erste Entwurf schrieb das Sichtbarkeits-Prädikat ein zweites Mal hin. Genau
davor warnt `20260826100000:36-40` selbst — und genau daran ist dieser Plan
binnen 24 Stunden gescheitert.

**Der Test prüft deshalb Parität, nicht Mitgliedschaft in einer eingefrorenen
Menge.** Je geschriebener Hinweiszeile wird der Empfänger per
`request.jwt.claim` impersoniert (das Muster steht 13× in `rls_test.sql`) und
behauptet, dass er den angekündigten Gegenstand **sieht**. Eine Abschrift hat
ein Verfallsdatum; eine Paritätszusage fängt das nächste AGE-601.

## Impact

- Betroffene Fähigkeit: `notifications`.
- **Migration**, entgegen der ersten Einschätzung des Handoffs. Die Glocke selbst
  braucht keine: `notifications` hat `read_at`, Grants
  `select, insert, update, delete` für `authenticated` und `notifications_own`.
  Das **Opt-out** braucht eine — `member_settings` trägt heute **keinen einzigen
  In-App-Schalter** (nur `notify_email_requests/_events/_digest` plus
  `visible_in_directory`, `contactable_by_prime`, `onboarded_at`, `updated_at`).
- Vier neue Spalten auf `member_settings`, je Typ eine, `not null default true`.
- Vier Trigger plus **eine** `SECURITY DEFINER`-Funktion für das Opt-out. Sie
  wird ausschließlich aus den Trigger-Funktionen gerufen und bekommt deshalb
  **kein** Ausführrecht zurück — anders als `is_contactable`, das aus
  Policy-Ausdrücken als die anfragende Rolle läuft. Ihre Entzüge nennen alle
  vier Rollen (AGE-622).
- **Keine neuen Grants nötig**, am Testfile gemessen: `grants_test.sql:51` führt
  `member_settings` tabellenweit; die Spalten-Assertion (`:113-127`) deckt eine
  feste Tabellenliste ab, in der `member_settings` nicht vorkommt.
- Kein Mailversand, keine neue Tabelle, keine Änderung an den drei bestehenden
  Typen.

## Entscheidungen, festgehalten statt übersehen

**Der Name des Handelnden bleibt in der Nutzlast**, auch wenn der Empfänger das
Profil sonst nicht sähe (unter `discover` greift
`profiles_select_self_or_discover`, und `profiles_public` zeigt nur
`is_public = true`). Begründung: wer auf einem fremden Beitrag handelt, tut
einen öffentlichen Akt gegenüber genau dieser Person; der Name gehört zur
Handlung. Das bestehende `contact_request` hält es seit Juni ebenso
(`from_name` in der Nutzlast). Beim Go-Live ohnehin gegenstandslos, weil der
Import alle Konten auf `impact` setzt.

**Kein Beitragstext in der Nutzlast.** Eine Hinweiszeile unterliegt nach dem
Schreiben nicht mehr der Sichtbarkeit ihres Gegenstands; Text darin überlebte
eine spätere Verschärfung. Kennungen und ein kurzer Anzeigetext genügen.

**Die Nutzlast ist mitgliederkontrollierter Text** — `contact_request` trägt
seit Juni ein frei formuliertes `message`. Die Glocke rendert sie als **Text**,
nie als Markup.

**Kein Dedup beim Like.** Ein Like, zurückgenommen und neu gesetzt, erzeugt
zwei Hinweise, und der erste bleibt stehen. Bewusst nicht behandelt: die
kleinste Lösung wäre ein Löschen beim Unlike, und das ist eine
Verhaltensänderung an einer fremden Tabelle für einen Randfall.

## Die Kosten, offen benannt

Ein Beitrag erzeugt bei rund 70 aktivierten Konten bis zu 69 Zeilen, **synchron
in der Transaktion**, die den Beitrag schreibt. `opencode` hat es
durchgerechnet: ~15 kB WAL, einstellige Millisekunden, und selbst der
theoretische Massenfall wäre trivial. Bedingung: Fan-out als **ein**
`insert … select`, nicht als Schleife in plpgsql.

Der Präzedenzfall steht im Repo: `event_feed_post_sync` ist ein synchroner
`after insert`-Row-Trigger, der in derselben Transaktion schreibt. Statement-
Level oder Deferred gibt es nirgends.

Donald hat am 27.08. entschieden: **sofort scharf, Opt-out per Default AN.** Die
Alternative — über eine zentrale Flagge bis nach dem Go-Live ausgeschaltet —
wurde erwogen und verworfen.
