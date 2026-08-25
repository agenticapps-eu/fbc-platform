## Context

AGE-587. Drei Flächen-Wünsche Donalds vom 25.08., zusammengefasst, weil sie alle
auf Admin- oder Profilflächen liegen. Der Bestand ist erhoben, nicht vermutet —
die Datei:Zeile-Belege stehen im Issue.

Drei Dinge aus dem Bestand bestimmen den Entwurf mehr als der Wunsch selbst:

1. **`admin_list_members` ist von Zusagen umstellt, die eine Änderung
   verhindern sollen.** Fünf Stellen in `admin_member_list_test.sql` casten auf
   `'public.admin_list_members(text,text,int,int)'::regprocedure` — ein
   zusätzlicher Parameter macht diese Casts *ungültig*, also einen Fehler statt
   eines Fails. Und Z. 335-342 sichert ausdrücklich zu, dass die Admin-Liste
   **genau acht** Zusatzspalten gegenüber `search_directory` hat. Beides ist als
   Wächter gebaut. Wer ihn umgeht, statt an ihm vorbeizuplanen, hat den Wächter
   abgeschafft. **Was sie NICHT schützen, ist der Rumpf** — und genau dort
   entsteht die geteilte Bedingung aus D3.
2. **`admin_list_feedback()` ist argumentlos, und sieben Zusagen hängen daran.**
   Paging bedeutet hier `drop` + `create`, nicht `create or replace` — der
   Rückgabetyp ändert sich, und den kann `replace` nicht anfassen.
3. **Für den Deeplink existiert nichts.** Keine Route, kein Parameter, kein
   Anker, kein `scrollIntoView`. Die Beitrags-`id` wird immerhin schon gelesen
   (`public-profile.ts:107-114`) und heute nur als React-`key` benutzt.

## Goals / Non-Goals

**Goals**

- QM-Feedback als eigene, blätternde Admin-Fläche mit Menüeintrag; die alte Karte
  entfällt.
- Zahlen an den fünf Reitern der Mitgliederliste, ohne Signatur oder Spaltensatz
  von `admin_list_members` zu berühren.
- Jede Zeile der Aktivitäten-Karte springt zu **ihrem** Beitrag; ein Beitrag ohne
  Text wird benannt.

**Non-Goals**

- **Der Chat am Feedback.** Donald hat dafür einen eigenen Prompt vorbereitet.
  Hier entsteht nur die Voraussetzung: `profile_id` verlässt die RPC.
- **Anonymes Feedback** (AGE-588). Heute strukturell unmöglich
  (`feedback.profile_id` ist `not null`).
- **Filter oder Bearbeitungsstand am Feedback.** Ausdrücklich abgewählt.
- **Paging-Gesamtzahl in der Mitgliederliste.** Die Zähler beantworten „wie viele
  sind in diesem Zustand", nicht „Seite 2 von 7". Das bleibt, wie es ist.
- **Die nackte Video-URL im Beitragstext** auf denselben Karten. Vermerkt,
  nicht angefasst.

## Decisions

### D1 — Der Deeplink ist ein Suchparameter, keine zweite Route

`/aktivitaet?post=<id>`, nicht `/aktivitaet/:postId`.

*Warum:* eine zweite Route hieße eine zweite Route auf dieselbe Seite, und der
Feed müsste beim Wechsel zwischen beiden neu einhängen. Der Suchparameter hängt
an derselben Seite, und `useSearchParams` ist im Repo bereits das Muster
(`MemberDirectory.tsx`, `AdminMitgliederPage.tsx`).

*Die Falle, die daran hängt:* `feedSeitenKey` trägt **die ganze Auswahl**, und
eine andere Auswahl ist eine andere Abfrage. `post` ist **keine** Auswahl — er
ändert nicht, *was* geladen wird, sondern nur, *wohin* gesehen wird. Er darf
deshalb **nicht** in den Schlüssel. Stünde er drin, verwürfe jeder Deeplink den
gesamten geladenen Feed und lüde ihn neu.

*Verworfen:* ein Anker (`#post-<id>`). Der Browser springt zu einem Anker, der
beim ersten Rendern noch nicht existiert, gar nicht — und der Feed lädt
seitenweise, der Beitrag ist also regelmäßig noch nicht da.

### D2 — Der adressierte Beitrag wird GEHOLT, nicht gesucht

Ein Deeplink lädt den Beitrag über seine Kennung (`posts?id=eq.<id>`, unter der
RLS) und stellt ihn dem Feed **voran**. Der Feed darunter bleibt der Feed.

*Der erste Entwurf durchlief stattdessen den Feed und kappte bei fünf Seiten. Er
ist an einem HIGH-Befund gescheitert, und der Befund trägt:* das Spec-Delta sagt
zu, dass **der** Beitrag geöffnet wird — ein sichtbarer Beitrag auf Seite 6
verletzte diese Zusage durch korrekten Code. Die Antwort darauf durfte nicht sein,
die Zusage auf „innerhalb der ersten hundert" abzuschwächen: die Karte, aus der
der Klick kommt, zeigt die fünf jüngsten Beiträge **dieses Mitglieds**, und die
liegen im globalen Feed beliebig weit hinten. Der Deeplink wäre also gerade für
ruhigere Mitglieder unzuverlässig gewesen.

*Was der direkte Zugriff besser macht:*

- Er erreicht **jeden** sichtbaren Beitrag, unabhängig vom Alter.
- Er kostet **eine** Anfrage statt bis zu fünf.
- Die Ununterscheidbarkeit ist nicht mehr argumentiert, sondern gebaut: ein
  unsichtbarer Beitrag liefert null Zeilen, ein nicht vorhandener liefert null
  Zeilen. Es gibt keine zwei Wege, deren Meldungen jemand später auseinanderziehen
  könnte — es gibt **einen** Weg mit **einem** Ergebnis.
- Die Fünf-Seiten-Grenze entfällt ersatzlos, und mit ihr die Frage, was sie
  bedeutet.

*Warum ein SELECT hier ungefährlich ist, wo ein INSERT es nicht war:* der
Existenz-Orakel-Befund aus AGE-582 traf einen **Fremdschlüssel**, dessen Prüfung
ausdrücklich an der RLS vorbeiläuft. Ein `select` läuft nicht daran vorbei. Beide
Fälle enden in einer leeren Antwort, nicht in zwei verschiedenen Fehlern.

*Der Preis:* der adressierte Beitrag steht zweimal auf der Seite, wenn er auch im
Feed darunter vorkommt. Er wird dort herausgefiltert — eine Zeile, und ohne sie
sähe es wie ein Fehler aus.

*Der Parameter bleibt ein Suchparameter und bleibt aus dem Schlüssel der
Feed-Abfrage heraus (D1). Die Abfrage des einzelnen Beitrags hat ihren eigenen.*

### D3 — Die Zustandsbedingung wird GETEILT, nicht abgeschrieben

`admin_member_counts()` → `(status text, anzahl bigint)`, eine Zeile je Zustand.
Die Bedingung, die die Zustände unterscheidet, wandert in eine gemeinsame
Funktion, die **beide** aufrufen — die zählende und die listende.

*Der erste Entwurf schrieb die vier WHERE-Zweige ab und hielt beide Fassungen mit
einer pgTAP-Kreuzzusage zusammen. Beide Reviewer haben daran gezogen, und sie
haben recht:*

- Dieses Repo hat die Regel am Vortag selbst aufgeschrieben. Die Sidebar-Migration
  aus AGE-582 begründet, warum ihre Zähler `security invoker` sind: *„Unter
  `invoker` ist die Zahl richtig, WEIL DIE REGEL WIRKT — nicht, weil eine
  Abschrift sie nachspricht. Eine Abschrift kann driften, eine Policy nicht."*
  D3 tat in seiner ersten Fassung das Gegenteil.
- Und die Kreuz-Zusage trug das Risiko nicht: **gleiche Kardinalität bleibt bei
  ausgewogenen Fixtures grün, obwohl ein Zweig falsch ist.** Zählt der `offen`-
  Zweig versehentlich Aktivierte, und steht je eine Zeile beider Arten im
  Bestand, sind beide Zahlen 1 und die Zusage hält.

*Warum das die Wächter nicht bricht:* sie schützen **Signatur und Spaltensatz**
von `admin_list_members` (`::regprocedure`-Casts, „genau acht Zusatzspalten"),
nicht ihren Rumpf. Eine gemeinsame Bedingung ändert den Rumpf und lässt beides
unangetastet. Der Rumpf ist zudem von sechzig Zusagen umstellt — ein Fehler dort
fällt laut aus, nicht still.

*Die Zeilenform bleibt* (eine Spalte je Zustand machte jeden neuen Zustand zu
einer Signaturänderung), *und ein Zustand ohne Mitglieder erscheint MIT der Zahl
null.* Das ist der bewusste Unterschied zu `feed_tag_counts`, wo ein Tag ohne
sichtbaren Beitrag ganz fehlt: dort verriete schon sein Erscheinen etwas, hier
stehen die Zustände ohnehin als Reiter auf dem Schirm.

*`mitgliedschaft` ist keine Zustandskennung*, sondern ein Darstellungsmodus über
derselben Menge wie `alle` — `admin_list_members(..., 'mitgliedschaft')` würfe
`22023`. Die Abbildung Reiter → Zustand gehört deshalb ausdrücklich in die
Fläche, nicht in die Funktion.

### D3b — Die Zahl ist global, die Liste ist gefiltert

Der Zähler kennt **keinen** Suchbegriff. Sucht der Admin nach „Anna", zeigt der
Reiter weiter, wie viele Mitglieder es in diesem Zustand *gibt* — nicht, wie
viele auf die Suche passen.

*Warum so herum:* die Frage am Reiter ist „wie viele sind noch nicht aktiviert",
und die Antwort darauf ändert sich nicht dadurch, dass jemand einen Namen
eintippt. Ein mitsuchender Zähler beantwortete stattdessen „wie viele meiner
Treffer sind noch nicht aktiviert" — eine Frage, die die Trefferliste schon
beantwortet.

*Der Preis ist ein scheinbarer Widerspruch:* Reiter sagt 70, Liste zeigt zwei.
Deshalb ist die Globalität **zugesichert** statt unterschlagen, und das Szenario
„die Zahl stimmt mit den Zeilen dahinter überein" ausdrücklich auf die leere
Suche eingegrenzt.

### D4 — `admin_list_feedback` klemmt, statt abzuweisen

`p_limit` auf 1..100, `null` wird zur Vorgabe; `p_offset` auf ≥ 0.

*Warum:* dem Vorbild von `feed_top_authors` folgend. Eine listende Funktion hat
keinen Fehlerfall, den ein Aufrufer sinnvoll behandeln könnte — ein `raise`
machte aus einer Liste einen Seitenfehler.

**Nicht geklemmt wird der Zugang:** ein Nicht-Admin bekommt weiterhin null
Zeilen. Die bestehende Bauart (`where public.is_admin()`) bleibt, statt auf ein
`raise` umgestellt zu werden — sieben Zusagen beschreiben genau dieses Verhalten,
und es zu drehen wäre eine Änderung, die niemand bestellt hat.

*Zur neuen Zähl-RPC dagegen gehört ein `raise`* (`42501`), wie `admin_list_members`
es tut. Der Unterschied ist gewollt und nicht schludrig: eine leere **Liste** ist
eine gültige Antwort, eine Zeile mit lauter Nullen wäre eine **Aussage über den
Bestand**. Wer kein Recht am Bestand hat, darf sie nicht bekommen.

### D5 — `profile_id` geht mit, obwohl sie heute keinen Aufrufer hat

Ein bewusster Verstoß gegen „keine Flexibilität für Aufrufer, die es nicht gibt".

*Warum trotzdem:* die Funktion wird für das Paging ohnehin abgerissen und neu
gebaut. Die Spalte jetzt mitzunehmen kostet ein Wort; sie später nachzureichen
kostet eine zweite Migration, die dieselbe Funktion ein zweites Mal abreißt —
samt der sieben Zusagen. Der Aufrufer ist außerdem nicht hypothetisch: Donald hat
den Prompt dafür angekündigt.

*Was sie nicht ist:* eine Preisgabe. Der Admin sieht den Namen des Verfassers
heute schon; die Kennung fügt keine Information hinzu, sie macht die vorhandene
nur benutzbar.

### D6 — Der Ersatztext lautet „Beitrag ohne Text"

*Die erste Fassung sagte „Beitrag mit Bild", und das war eine Behauptung, die die
Karte nicht geprüft hatte. Ein Review hat sie widerlegt, mit zwei Wegen:*

- `create_post_with_media` nimmt leeren Text **und** ein leeres Medienarray an —
  `canSubmit` schützt nur den Composer, nicht die RPC dahinter.
- Das Spalten-UPDATE-Recht auf `body` (aus AGE-582) lässt ein Mitglied den
  eigenen Text nachträglich leeren, ohne dass Bilder entstünden.

Ein textloser Beitrag **ohne** Bild ist damit möglich, und die Karte hätte dort
gelogen.

**Donald hat am 25.08. entschieden: „Beitrag ohne Text".** Immer wahr, egal was
dranhängt, keine zusätzliche Abfrage, und nichts, was später kippen kann.

*Verworfen:* `post_media` mitzulesen (eine Abfrage mehr auf jeder Profilseite für
ein Wort) und die Invariante serverseitig zu erzwingen (eine Migration auf die
meistbenutzte Tabelle, an der Altbestände scheitern könnten).

## Risks / Trade-offs

**Der Rumpf von `admin_list_members` wird angefasst** (D3). Das ist die
riskanteste Stelle des Changes — die Funktion trägt die Mitgliederverwaltung.
Dagegen steht, dass ihr Rumpf von sechzig pgTAP-Zusagen umstellt ist: ein Fehler
dort fällt laut aus. Und die Alternative wäre eine Abschrift gewesen, deren
Kreuz-Zusage nachweislich grün bleiben kann, während ein Zweig falsch ist.

**Zwei der sieben alten Zusagen werden umgeschrieben, fünf ausdrücklich NICHT.**
Die fünf argumentlosen SQL-Aufrufe bleiben stehen und werden dadurch zu Wächtern
über die Vorgabewerte der neuen Signatur. Vergisst die Migration die Defaults,
brechen sie — was hier die gute Nachricht wäre. Das Risiko liegt darin, sie beim
Nachziehen „der Ordnung halber" mitzuändern und damit fünf Wächter stillzulegen.

**Der Zähler ist global, die Liste gefiltert** (D3b). Bei aktiver Suche stehen
Reiter und Liste scheinbar im Widerspruch. Das ist gewollt und zugesichert — aber
es ist die Art Detail, die ein späterer Leser für einen Fehler hält und
„korrigiert".

**Der adressierte Beitrag steht zweimal**, wenn er auch im Feed vorkommt (D2). Er
wird dort herausgefiltert; wird das vergessen, sieht es wie ein Dublettenfehler
aus.

**Zwei Karten, ein Fehler** (D6). Wird nur eine angefasst, entsteht ein Defekt,
der *manchmal* auftritt — schwerer zu finden als einer, der immer auftritt.
Deshalb stehen sowohl der Ersatztext als auch der Deeplink im Spec-Delta
ausdrücklich auf **beiden** Flächen.

## Migration Plan

Eine Migration, forward-only:

1. `create function public.member_state_matches(...)` — die gemeinsame
   Zustandsbedingung, wörtlich aus dem heutigen `case p_status` von
   `admin_list_members`. `immutable`, `set search_path = ''`. Rechte
   ausdrücklich: `revoke execute … from public, anon`.
2. `create or replace function public.admin_list_members(...)` — **derselbe**
   Rumpf, nur dass der `case`-Ausdruck durch den Aufruf aus (1) ersetzt wird.
   Signatur und Spaltensatz bleiben Zeichen für Zeichen gleich; die Wächter
   müssen grün bleiben, und dass sie es tun, ist die Abnahme dieses Schritts.
3. `drop function public.admin_list_feedback()`, dann `create` mit
   `p_limit int default 25`, `p_offset int default 0`, `profile_id` in der
   Rückgabe und **`order by created_at desc, id desc`** — eine Ordnung, die bei
   gleichen Zeitstempeln keine Gesamtordnung ist, macht Offset-Paging zu einem
   Glücksspiel. `p_limit` auf 1..100 geklemmt, `null` zur Vorgabe.
4. `create function public.admin_member_counts()` mit `raise 42501` für
   Nicht-Admins und einer Zeile je Zustand einschliesslich der Nullen.
5. **Rechte für ALLE drei neuen Funktionen ausdrücklich aussprechen.** Neue
   Funktionen tragen in PostgreSQL EXECUTE für `PUBLIC`, solange es niemand
   entzieht — dieselbe Klasse wie AGE-312, und der erste Entwurf hatte sie nur
   für die Feedback-Funktion genannt.

Keine Tabelle, keine Spalte, kein Datenzugriff — `grants_test.sql` bleibt damit
unberührt (der Golden-Snapshot bricht an neuen **Tabellen**, nicht an Funktionen).
Das wird gemessen, nicht angenommen.

## Open Questions

- **Wie viele Feedbacks je Seite?** 25 wie die Mitgliederliste, falls Donald
  nichts anderes sagt.
- **Der Ort des Menüeintrags:** hinter „Mitglieder" oder dazwischen. Reine
  Geschmacksfrage, wird in der Sichtprobe entschieden.
- **Wie der vorangestellte Beitrag aussieht** — als gewöhnliche Karte mit einem
  Hinweis darüber, oder abgesetzt. Eine Gestaltungsfrage, die die Sichtprobe
  beantwortet; die Zusagen hängen nicht daran.
