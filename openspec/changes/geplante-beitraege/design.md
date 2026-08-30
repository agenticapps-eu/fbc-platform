# Entwurf — geplante Beiträge

> **Überarbeitet nach der Plan-Review (29.08.).** Zwei HOCH-Befunde von
> opencode, beide berechtigt und beide gegen den lebenden Katalog nachgemessen.
> Der erste hat den Entwurf an seiner eigenen Regel erwischt: die Tor-Liste
> zählte nur die **lesenden** Tore und übersah das **schreibende**.
>
> geminis Befunde sind **nicht** eingearbeitet: sein „wichtigster und
> gefährlichster" Fund (`get_posts_for_feed`) existiert nicht, die drei von ihm
> zitierten Migrationsdateien tragen 2024er Namen in einem Repo, das nur 2026er
> hat, und sein zweiter HOCH-Befund behauptete eine Policy-Fassung, die gegen
> den Katalog widerlegt ist. Belegt in Entscheidung 8.

## Entscheidung 1: gerechnet, nicht geschaltet — für die SICHTBARKEIT

`veroeffentlicht_ab timestamptz not null default now()`. Sichtbar ist ein
Beitrag, wenn `veroeffentlicht_ab <= now()` — **oder** wenn der Betrachter sein
Autor ist.

**Verworfen: ein `pg_cron`-Lauf, der eine Fahne umlegt.** Er wäre ein
Fehlerfall, den es sonst nicht gibt: fällt der Lauf aus, bleibt der Beitrag
unsichtbar, und das sieht genauso aus wie „nicht geschrieben". Der Vergleich in
der Regel hat diesen Zustand nicht. Der Preis ist, dass jede Abfrage den
Vergleich mitträgt — messbar, aber einmalig zu prüfen (Task B6).

**Verworfen: eine eigene Spalte `geplant boolean`.** Zwei Quellen für einen
Zustand, die auseinanderlaufen können. Der Zeitstempel allein sagt alles.

## Entscheidung 1b: die ANKÜNDIGUNG braucht einen Lauf — und das ist vertretbar

`trg_hinweis_neuer_beitrag` feuert **after insert on public.posts** und ruft
`hinweis_rundruf('post_created', …)` mit `autor_name` im Payload — an **jedes
aktivierte Mitglied**. `notifications` hängt an Realtime (Glocke) und seit dem
28.08. am Push-Webhook.

Ohne Eingriff hätte ein geplanter Beitrag also **im Moment des Planens** die
Glocke und das Telefon aller Mitglieder erreicht, für etwas, das niemand sehen
darf — Autorenname und Existenz sofort preisgegeben, und der Tap führte auf
einen Deeplink mit null Zeilen.

**Donald hat am 29.08. entschieden: ein geplanter Beitrag SOLL beim Live-Gehen
ankündigen**, wie jeder andere. Damit zerfällt der Change in zwei Hälften mit
verschiedenen Fehlerprofilen, und der Unterschied ist der Grund, warum das
trotzdem trägt:

| | Mechanik | Fällt sie aus, dann … |
| --- | --- | --- |
| **Sichtbarkeit** | gerechnet (`veroeffentlicht_ab <= now()`) | **kann nicht ausfallen** |
| **Ankündigung** | Lauf zum Zeitpunkt | Beitrag erscheint trotzdem, nur unangekündigt |

Der Lauf verbirgt also **keinen Inhalt**. Das ist genau der Grund, aus dem
Entscheidung 1 einen Lauf für die Sichtbarkeit ablehnt und hier einen zulässt.

**Der Trigger bekommt ein zweites frühes `return null`** — er trägt schon eines
für `kind <> 'member'`, die Stelle ist vorgezeichnet:

```sql
if new.veroeffentlicht_ab > now() then
  return null;   -- der Lauf kuendigt an, nicht das Einfuegen
end if;
```

**Doppelte Ankündigung verhindert eine eigene Spalte**, nicht eine Suche in
`notifications`: dort steht je Empfänger eine Zeile, die Existenzprüfung wäre
ein Scan über den Fan-out. `angekuendigt_am timestamptz` ist billiger und sagt,
was gemeint ist.

**Offen und in den Aufgaben festgehalten:** ob der Lauf als Migration entstehen
kann. `pg_cron` fehlt im lokalen Stack und in der frischen CI-Abbildung — eine
Migration mit `cron.schedule` bräche den Job `migrations`. Zwei Wege, beide
gangbar, einer zu wählen: von Hand auf beiden Seiten (wie der
Wiederholungslauf, Vorlage in `docs/secrets.md`), oder in der Migration hinter
`if exists (select 1 from pg_extension where extname = 'pg_cron')`. Der zweite
ist neu für dieses Repo und deshalb zu messen, nicht anzunehmen.

## Entscheidung 2: `not null default now()`, nicht `null` für „sofort"

Ein `null` müsste überall als „sofort" gelesen werden — in sechs Prädikaten, je
mit `coalesce` oder `is null or`. Vergisst eine Stelle das, ist ein Beitrag
entweder unsichtbar oder zu früh sichtbar.

Mit `not null default now()` steht in jeder Bestandszeile ihr eigener
`created_at`-Moment, und `veroeffentlicht_ab <= now()` ist für sie **immer**
wahr. Der Vergleich ist damit für alle Zeilen derselbe, ohne Sonderfall.

**Die Fehlerrichtung ist dabei die schlechtere, und das gehört gesagt** (Befund
NIEDRIG aus der Plan-Review, berechtigt): mit `null` = „sofort" versagt eine
**vergessene** Stelle *fail-closed* — `null <= now()` ergibt `null`, die Zeile
fällt heraus, der Beitrag ist unsichtbar. Mit `not null` versagt sie
*fail-open*: das unveränderte Tor zeigt den geplanten Beitrag sofort, also genau
der Schaden, den dieser Change verhindern soll.

Die Entscheidung bleibt, aber sie steht und fällt mit zweierlei: die Tor-Liste
muss **geschlossen** sein (Entscheidung 4, gegen den Katalog gemessen), und die
Positivkontrolle in E2 muss zeigen, dass jede Zusage ohne die Änderung **rot**
ist. Ohne beides wäre `null` die sicherere Wahl.

Die Migration setzt für Bestandszeilen ausdrücklich `created_at`, nicht `now()`
— sonst trügen alle denselben Migrationszeitpunkt und die Feed-Sortierung
sortierte den ganzen Bestand um.

## Entscheidung 3: `created_at` bleibt unangetastet

`created_at` bleibt der **Schreib**zeitpunkt. Sortiert wird künftig nach
`veroeffentlicht_ab`. Zwei Gründe:

- Ein für Freitag geplanter Beitrag soll am Freitag **oben** stehen, nicht
  zwischen den Beiträgen von Montag.
- `created_at` als Schreibzeitpunkt zu behalten ist für Admin und Fehlersuche
  das ehrlichere Feld — es sagt, wann jemand getippt hat.

**Folge, die geprüft werden muss:** die Seitengrenze des Feeds (`Der Feed lädt
seitenweise`) hat einen Cursor. Sortiert die Abfrage nach einer anderen Spalte
als der Cursor vergleicht, überspringt sie Zeilen oder liefert sie doppelt —
dieselbe Klasse wie der zusammengesetzte Cursor in AGE-655. Cursor und
`order by` müssen dieselbe Spalte tragen (Task C2).

## Entscheidung 4: der Zeitpunkt gehört in ALLE sechs Tore

Gemessen aus dem lebenden Katalog. Die Regel lautet überall gleich:

```sql
(p.veroeffentlicht_ab <= now() or p.author_id = (select auth.uid()))
```

| Tor | Warum es nicht reicht, nur die RLS zu ändern |
| --- | --- |
| `posts_select_by_visibility` | — (das ist die RLS) |
| `posts_select_public_anon` | ohne Session gibt es keinen Autor; hier fällt die zweite Hälfte weg |
| `post_media_lesbar` | **signiert Bilder.** Ohne Zeitpunkt ist der Beitrag unsichtbar und sein Bild abrufbar |
| `post_engagement_counts` | eine Zahl für eine unsichtbare Zeile verrät, dass es sie gibt |
| `former_member_entries` | liest Beiträge ausgeschiedener Mitglieder |

`event_feed_post_sync()` bleibt unberührt: sie **schreibt** Spiegelzeilen für
Events und entscheidet über keine Sichtbarkeit.

**Für `anon` lautet das Prädikat nur `veroeffentlicht_ab <= now()`** — ohne
Session gibt es keinen Autor, und `auth.uid()` ist `null`. Die
Autoren-Ausnahme dort mitzuschreiben wäre wirkungslos, aber irreführend.

## Entscheidung 5: die alte RPC-Signatur wird gelöscht, nicht überladen

`create_post_with_media` hat heute sechs Parameter. Ein siebter mit Vorgabewert
erzeugt in Postgres eine **zweite** Funktion; beide existierten nebeneinander,
beide bräuchten Rechte, und der alte Weg bliebe offen. Deshalb:

```sql
drop function if exists public.create_post_with_media(uuid,text,text,text[],text[],jsonb);
create function public.create_post_with_media(…, p_veroeffentlicht_ab timestamptz) …;
revoke execute on function …(…) from public;
grant  execute on function …(…) to authenticated;
```

Die Rechte werden **ausgesprochen**, nicht geerbt — bei Funktionen wirkt
`alter default privileges … revoke` nicht.

**Der Parameter ist nicht optional.** Ein Vorgabewert brächte die Überladung
durch die Hintertür zurück, sobald jemand mit sechs Argumenten ruft. Der Client
übergibt `null` für „sofort", die Funktion setzt dann `now()`.

**Die Funktion prüft den Wert:** ein Zeitpunkt in der Vergangenheit wird auf
`now()` gehoben. Sonst könnte ein Beitrag rückdatiert oben im Feed erscheinen —
oder, schlimmer, unter älteren begraben werden, wo ihn niemand sucht.

## Entscheidung 6: der Spalten-Grant wächst, der Golden-Snapshot mit

`authenticated` hält auf `posts` ein **spaltenweises** UPDATE-Recht. Ohne
`veroeffentlicht_ab` darin könnte der Verfasser den Zeitpunkt nicht mehr
verschieben — genau das, was er können soll. Also in den Grant **und** in
`grants_test.sql`; sonst bricht der CI-Job `migrations` an einem
Golden-String, der die Spalte nicht kennt.

## Was gemessen werden muss, bevor der Change als fertig gilt

1. **Ein geplanter Beitrag existiert für Fremde nicht** — Zeile, Bild, Zähler,
   Kommentarzugang. Vier getrennte Zusagen, nicht eine.
2. **Für den Verfasser existiert er** und trägt die Markierung.
3. **Nach dem Zeitpunkt** erscheint er für alle, die seine Sichtbarkeit trägt.
4. **Positivkontrolle:** ohne die Änderung ist Zusage 1 **rot** — sonst belegt
   sie nichts (`negativbefund-braucht-positivkontrolle`).
5. **Der Bestand ist unverändert sichtbar** — kein Beitrag verschwindet durch
   die Migration.

Punkt 1 und 4 zusammen sind der Kern. Eine Zusage „Fremde sehen ihn nicht" ist
wertlos ohne den Nachweis, dass sie ihn **vorher** gesehen hätten.

## Entscheidung 7: was mit dem Spalten-UPDATE-Recht möglich wird

Sobald `veroeffentlicht_ab` im Spalten-Grant steht, kann der Verfasser den Wert
**direkt** setzen, an der RPC vorbei (`updatePost`, `src/lib/feed.ts`). Zwei
Folgen, beide aus der Plan-Review, beide zu entscheiden statt zu übersehen:

- **Ein vergangener Wert** lässt den eigenen Beitrag unter älteren versinken.
  Das ist Selbstschaden an der eigenen Zeile — **hinnehmbar**, keine Sperre.
- **Ein zukünftiger Wert an einem bereits sichtbaren Beitrag** ist ein
  **De-Publizieren**: der Beitrag verschwindet wieder. Likes und Kommentare, die
  inzwischen daran hängen, bleiben liegen und zeigen ins Leere.

**Entschieden: De-Publizieren wird zugelassen und ist kein Sonderfall.** Ein
Beitrag, den sein Verfasser wieder aus der Sicht nimmt, ist dasselbe wie einer,
den er löscht — nur reversibel. Die Zusage dazu gehört in die Tests, damit
niemand später annimmt, es sei unmöglich.

Die Anhebung eines vergangenen Werts auf `now()` gilt deshalb **nur beim
Anlegen** (RPC), nicht beim Ändern. Das steht so im Delta, statt eine
Invariante zu behaupten, die der zweite Schreibweg nicht hält.

## Entscheidung 8: was aus der Plan-Review NICHT übernommen wurde

Ein Reviewer (gemini) meldete zwei HOCH-Befunde, die gegen den lebenden Katalog
widerlegt sind. Das steht hier, weil ein späterer Leser sonst denkt, sie seien
übersehen worden:

| Behauptung | Gemessen |
| --- | --- |
| `get_posts_for_feed` sei ein ungenanntes DEFINER-Tor | **Existiert nicht.** Funktionen mit „feed" im Namen: `event_feed_post_sync`, `feed_tag_counts`, `feed_top_authors`, `admin_list_feedback` |
| `likes_write_own` prüfe nur `profile_id` | **Falsch.** `WITH CHECK` trägt `exists (select 1 from posts p where p.id = post_likes.post_id)` — die Policy erbt |
| `saved_posts` mit zitierter Policy | Die Tabelle heisst `post_saves`; ihr INSERT prüft die Existenz ebenso, SELECT/DELETE nur die eigene Zeile — trägt |

Die drei dabei zitierten Migrationsdateien tragen 2024er Namen; dieses Repo hat
ausschliesslich 2026er. Die Belege waren erfunden.

**Ein Rest bleibt trotzdem:** `post_saves` gehört in die Erbschaftszusage (B6)
aufgenommen — der Reviewer hat mit falschem Beleg auf eine richtige Stelle
gezeigt.

## Bekannter Rest: der Potential-Score

`recompute_potential_score` zählt `count(*) from public.posts where author_id =
…` ohne Zeitfilter; ein geplanter Beitrag hebt den Score seines Verfassers also
sofort, und der Score ist über `profiles_public` lesbar. Das ist ein schwaches
Timing-Orakel: +1 zum Planungszeitpunkt, ohne Inhalt, Name oder Gegenstand.

**Nicht in diesem Change behoben**, aber benannt — mit `and veroeffentlicht_ab
<= now()` wäre es eine Zeile, und die Entscheidung gehört zu dem Vorgang, der
den Score ohnehin anfasst.

## Zeitzone

Der Client schickt einen absoluten Zeitpunkt (`timestamptz`). „Nächster Freitag
18 Uhr" rechnet der Browser in der Zone des Mitglieds aus. Kein
Sommerzeitproblem: gespeichert wird der Moment, nicht die Wanduhr — anders als
bei Terminreihen (AGE-630), wo eine wiederkehrende Wanduhrzeit gemeint ist.
