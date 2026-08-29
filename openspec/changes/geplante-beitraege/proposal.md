# Einen Beitrag jetzt schreiben und später live schalten

Linear: **AGE-667**

## Why

Ein Mitglied kann heute nur **sofort** veröffentlichen. Wer einen Beitrag für
den nächsten Freitag vorbereiten will, muss ihn bis dahin irgendwo anders
liegen lassen und am Freitag von Hand einstellen.

`public.posts` trägt dafür nichts: `created_at` ist zugleich „geschrieben am"
und „sichtbar seit". Es gibt keine Spalte, die die beiden trennt.

Der Wunsch kam von Donald am 29.08. im Zuruf, zusammen mit den Terminreihen
(AGE-630) — aber davon unabhängig: dort geht es um Serien im Datenmodell, hier
um **einen Zeitstempel und die Tore, die ihn lesen müssen**.

## What Changes

- Im Composer steht neben „Veröffentlichen" ein Weg, den Beitrag **für einen
  Zeitpunkt zu planen** — Datum **und** Uhrzeit.
- Bis dahin sieht ihn **nur der Verfasser**, mit der Markierung „geplant für
  …". Niemand sonst — keine Admin-Einsicht, keine Freigabe durch andere.
- Der Verfasser kann bis zum Zeitpunkt **ändern, den Zeitpunkt verschieben oder
  ganz zurücknehmen** (auf „sofort" stellen oder löschen).
- Ist der Zeitpunkt erreicht, erscheint der Beitrag im Feed, als wäre er in
  diesem Moment geschrieben worden — **oben**, nicht an der Stelle seines
  Schreibdatums.
- Für alles Bestehende ändert sich **nichts**: ein Beitrag ohne Planung
  verhält sich wie heute.

## Capabilities

### New Capabilities

_Keine._ Der Change bleibt im Slot `community-feed`.

### Modified Capabilities

- `community-feed`: eine **neue** Anforderung, dass ein Beitrag einen
  Veröffentlichungszeitpunkt tragen kann und dass **jede** Stelle, die über
  seine Sichtbarkeit entscheidet, diesen Zeitpunkt mitliest.
- `community-feed`: die Anforderung **„Der Composer trägt Text, Bilder,
  Video-Link, Tags und Sichtbarkeit"** wird um den Planungsweg erweitert — und
  bei der Gelegenheit von einer Begründung befreit, die nicht mehr stimmt
  (siehe unten).
- `community-feed`: die Anforderung **„Das Schreibrecht auf `posts` nennt seine
  Spalten"** wird um die neue Spalte im Spalten-UPDATE-Grant und im
  Golden-Snapshot erweitert.

Die Anforderung **„Engagement counts are aggregate-only and visibility-scoped"**
wird **nicht** geändert: sie verlangt bereits ausdrücklich, dass „jede Änderung
der Sichtbarkeitsregel diese Abschrift mitzieht". Der Change löst diese Pflicht
aus, statt sie neu zu formulieren.

## Impact

### Kein Zeitplan-Job — und das ist der Kern des Entwurfs

Die Sichtbarkeit wird **gerechnet**, nicht geschaltet: `veroeffentlicht_ab <=
now()`. `pg_cron` läuft zwar seit AGE-641, aber ein Lauf, der Beiträge
freischaltet, führt einen Fehlerfall ein, den es sonst nicht gibt — fällt er
aus, bleibt ein Beitrag unsichtbar, und **niemand merkt es**, weil ein
fehlender Beitrag wie ein nicht geschriebener aussieht. Ein Vergleich in der
Regel kann nicht ausfallen.

### Wo die Sichtbarkeit heute entschieden wird — gemessen, nicht angenommen

Aus dem lebenden Katalog gelesen (`pg_policies` + `pg_proc`), nicht aus den
Migrationsdateien; dort stehen auch alle abgelösten Fassungen:

| Art | Objekt | Was der Change dort tut |
| --- | --- | --- |
| Policy | `posts_select_by_visibility` | Zeitpunkt ins Prädikat |
| Policy | `posts_select_public_anon` | Zeitpunkt ins Prädikat |
| DEFINER | `create_post_with_media(…)` | neuer Parameter, **neue Signatur** |
| DEFINER | `post_media_lesbar(objektname)` | Zeitpunkt ins Prädikat |
| DEFINER | `post_engagement_counts(uuid[])` | Zeitpunkt ins Prädikat |
| DEFINER | `former_member_entries(…)` | Zeitpunkt ins Prädikat |
| DEFINER | `event_feed_post_sync()` | **unberührt** — schreibt Event-Spiegelzeilen |

Views über `posts`: **keine**.

**`post_media_lesbar` ist der gefährlichste Posten.** Sie entscheidet, ob ein
Bild signiert werden darf. Käme der Zeitpunkt nur in die RLS, liesse sich das
**Bild** eines geplanten Beitrags vor der Veröffentlichung signieren und
abrufen — der Beitrag wäre unsichtbar und sein Bild trotzdem da. Das ist
dieselbe Bauart wie `profiles_public`: ein neues Tor braucht jede Stelle, an der
das Prädikat dupliziert ist.

**`comments` und `post_likes` erben.** `comments_select_visible` prüft
`exists (select 1 from public.posts p where p.id = comments.post_id)` — die
Unterabfrage läuft unter der RLS von `posts`, die Korrektur wirkt dort also von
selbst. Das ist zu **belegen**, nicht zu behaupten (Task B4).

**`feed_tag_counts` und `feed_top_authors` erben ebenfalls** — beide
`security invoker`.

### Zwei Fallen im Bestand

1. **`create_post_with_media` hat eine feste Signatur** (sechs Parameter). Ein
   siebter mit Vorgabewert erzeugt in Postgres eine **Überladung**, keine
   Ersetzung: zwei Funktionen, zwei Grants, zwei Zeilen in den Rechteproben, und
   der alte Weg bliebe offen. Der Change **löscht** die alte Signatur und legt
   die neue an, mit ausgesprochenen Rechten
   (`default-privileges-wirken-nicht-auf-funktionen`).
2. **`posts` trägt ein Spalten-UPDATE-Grant.** Die neue Spalte muss darin
   stehen, sonst kann der Verfasser den Zeitpunkt nicht mehr ändern — und der
   Golden-Snapshot in `supabase/tests/grants_test.sql` muss mitziehen, sonst
   bricht der CI-Job `migrations` ohne Namensnennung.

### Eine Ungenauigkeit in der Spec, die dieser Change mitnimmt

Die Composer-Anforderung begründet die serverseitige Video-Ableitung mit
„`posts_write_own` erlaubt `authenticated` INSERT und UPDATE direkt auf
`posts`". Die spätere Anforderung „Das Schreibrecht auf `posts` nennt seine
Spalten" sagt, `authenticated` hält **kein** INSERT mehr. Die Spec widerspricht
sich also selbst. Der `MODIFIED`-Block korrigiert die Begründung, statt sie
mitzubekräftigen — ein `MODIFIED` bekräftigt alles, was darin steht.

### Flächen

| Fläche | Was |
| --- | --- |
| neue Migration | Spalte, zwei Policies, vier DEFINER-Funktionen, Spalten-Grant |
| `supabase/tests/grants_test.sql` | Golden-Snapshot + Spalten-Grant-Zusage |
| neue pgTAP-Datei | dass ein geplanter Beitrag für Fremde nicht existiert — **auch nicht sein Bild, sein Zähler, sein Kommentar** |
| `.github/workflows/ci.yml` | die neue pgTAP-Datei in die Dateiliste (sonst läuft sie nie — AGE-659) |
| `src/lib/feed.ts` | `createPostWithMedia` reicht den Zeitpunkt durch; Sortierung |
| `src/lib/database.types.ts` | von Hand, **nicht** per `gen types` |
| `src/components/community/CommunityFeed.tsx` | Planungsweg im Composer, Markierung an der Karte |

**Nicht betroffen:** Edge Functions, Storage-Policies (nur die Lesefunktion),
Stripe, Push.

### Was dieser Change ausdrücklich NICHT tut

- **Keine Admin-Einsicht** in geplante Beiträge und **keine Redaktionsfreigabe**
  — beides von Donald am 29.08. entschieden.
- **Kein Planen für Event-Beiträge** (`kind = 'event'`): die schreibt ein
  Trigger aus `events`, nicht der Composer.
- **Keine Benachrichtigung** beim Freischalten.
