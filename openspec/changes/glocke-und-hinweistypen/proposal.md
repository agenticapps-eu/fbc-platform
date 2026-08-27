# Glocke verdrahten und fünf In-App-Hinweistypen

Linear: **AGE-620**

## Why

Die Glocke in der Kopfzeile ist ein toter Knopf. Gemessen in `AppShell.tsx:566`:
ein `<button>` mit `aria-label="Benachrichtigungen"`, ohne `onClick`, ohne
Zähler. Und im ganzen Frontend gibt es **null** Lesezugriffe auf
`notifications` — die einzigen Treffer stehen in einem Kommentar und in den
generierten Typen.

Gleichzeitig schreiben schon **drei** Typen in die Tabelle
(`contact_request`, `contact_request_accepted`, `contact_request_declined`),
jeweils aus `SECURITY DEFINER`-Funktionen. Diese Hinweise entstehen seit Juni
und hat noch nie jemand gesehen.

Fünf weitere Anlässe fehlen ganz: neues Mitglied, neuer Beitrag, neues Event,
Kommentar auf meinen Beitrag, Like auf meinen Beitrag.

## What Changes

- Die Glocke liest die eigenen `notifications`, zeigt die Ungelesen-Zahl und
  markiert gelesen. Die Anforderung dafür wird aus
  `add-lifecycle-notifications` (AGE-299) **herausgelöst**; dieser Change
  behält den Mail-Teil und bleibt im Nach-Go-Live-Backlog.
- Fünf neue Typen, geschrieben von Triggern auf `profiles`, `posts`, `events`,
  `comments` und `post_likes`.
- **Opt-out je Mitglied und je Typ** in den Einstellungen, per Default AN.
- Kein Mailversand. Keine Änderung an den drei bestehenden Typen.

## Der Befund, der den Entwurf dreht

Der Vorgang sagt „Fan-out je aktiviertem Mitglied". So gebaut wäre er ein Leck.

Jeder der drei Fan-out-Gegenstände hat eine **eigene** Sichtbarkeitsgrenze in
der RLS. Gemessen in `20260806080100_activation_gate.sql`, Ränge aus
`20260715150000_six_level_model.sql` (`basic=1 connect=2 discover=3 exchange=4
focus=5 impact=6`):

| Gegenstand | Policy | Wer darf ihn sehen |
| --- | --- | --- |
| Profil | `profiles_select_self_or_discover` | `has_level(3)` — **discover+** |
| Beitrag | `posts_select_by_visibility` | `public` → alle · **`members` → `has_level(4)`, exchange+** · `prime`/`legacy` → nur der Autor |
| Event | `events_select_by_visibility` | `public`/`members` → alle · `prime`/`legacy` → nur der Host |

Und `posts.visibility` hat den **Default `'members'`**. Der Normalfall eines
Beitrags ist also exchange-und-höher.

Ein Hinweis „Neuer Beitrag von Max Mustermann" an ein `connect`-Mitglied gäbe
diesem sowohl den Namen als auch die Tatsache preis, die die RLS ihm gerade
verweigert — und führte auf einen Beitrag, den es nicht öffnen kann. Ein Hinweis
ist keine Ausnahme von der Sichtbarkeit; er ist eine zweite Kopie davon.

**Die Empfängermenge folgt deshalb je Typ genau dem Prädikat des Gegenstands.**
Das ist kein Zusatzaufwand, sondern dieselbe Bedingung ein zweites Mal
hingeschrieben — und der Grund, warum sie in **einer** Funktion steht und nicht
fünfmal abgeschrieben wird.

Zwei Typen brauchen das gar nicht: Kommentar und Like gehen an den
**Beitragseigentümer**, und der sieht seinen Beitrag immer.

Beim Go-Live ist der Effekt gedämpft, weil der Import alle Konten auf `impact`
setzt. Der Stufenweg kommt laut Zielbild rund eine Woche später — dann greift
die Grenze, und dann wäre der Fehler live.

## Impact

- Betroffene Fähigkeit: `notifications`.
- **Migration**, entgegen der ersten Einschätzung. Die Glocke selbst braucht
  keine: `notifications` hat `read_at`, Grants `select, insert, update, delete`
  für `authenticated` und die Policy `notifications_own` (aktiviert + eigene
  Zeile). Das **Opt-out** braucht eine — `member_settings` trägt heute nur
  `notify_email_requests`, `notify_email_events`, `notify_email_digest`.
- Fünf neue Spalten auf `member_settings`, je Typ eine, `not null default true`.
- Fünf Trigger plus **eine** gemeinsame `SECURITY DEFINER`-Funktion. `DEFINER`
  ist nötig, weil die Funktion die `member_settings` **des Empfängers** liest
  und `member_settings_own` streng eigene-Zeile ist — als anfragende Rolle sähe
  sie die fremde Zeile nie und das Opt-out liefe still ins Leere. Dasselbe
  Muster wie `is_contactable`.
- **Keine neuen Grants nötig, und beide Grant-Prüfungen bleiben grün** — am
  Testfile gemessen, nicht angenommen: `grants_test.sql:51` führt
  `member_settings/authenticated=INSERT,SELECT,UPDATE` **tabellenweit**, neue
  Spalten ändern daran nichts; und die Spalten-Grants-Assertion (`:116`) deckt
  eine feste Tabellenliste ab, in der `member_settings` nicht vorkommt.
- Kein neuer Server, kein Mailversand, keine neue Tabelle.

## Die Kosten, offen benannt

Ein Beitrag erzeugt bei rund 70 aktivierten Konten bis zu 70 Zeilen, **synchron
in der Transaktion, die den Beitrag schreibt**. Dasselbe für jedes Event und
jedes neu aktivierte Mitglied.

Donald hat das am 27.08. entschieden: **sofort scharf, Opt-out per Default AN.**
Die Alternative — Trigger bauen, aber über eine zentrale Flagge bis nach dem
Go-Live ausgeschaltet lassen — wurde erwogen und verworfen.

Die Sorge bleibt hier festgehalten, damit sie nachlesbar ist und nicht als
Überraschung wiederkehrt: das sind Schreib-Trigger auf fünf Tabellen, wenige
Tage vor dem Go-Live, und die erste echte Fan-out-Last trifft PROD in derselben
Woche.

## Nutzlast

Die Nutzlast trägt Kennungen **und** einen kurzen Anzeigetext (Name des
Handelnden, Titel des Events). Das folgt dem bestehenden Muster: die drei
Kontaktanfrage-Typen legen seit Juni `from_name` und `message` in die Nutzlast
(`20260614100000_contact_request_flow.sql:45-56`).

Das ist vertretbar, weil die Empfängermenge bereits garantiert, dass der
Empfänger den Gegenstand lesen darf. Was es **nicht** heilt: wird die
Sichtbarkeit eines Beitrags später verschärft, bleibt der alte Hinweis stehen.
Der Hinweis trägt deshalb **keinen Beitragstext**, nur Herkunft und Anlass.
