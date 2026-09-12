## Why

AGE-718. Eine Release-Note erreicht ein Mitglied heute **einmal** — als Hinweis in
der Glocke. Wer ihn wegklickt, findet sie danach nur noch auf `/neues`, einer
Fläche, die man kennen muss. Die Aktivität, wo Mitglieder ohnehin täglich lesen,
zeigt sie gar nicht.

Das war Teil 3 des AGE-705-Zuschnitts und blieb dort ausgeklammert, weil er eine
Migration braucht: `posts.kind` ist per CHECK auf `member` und `event`
geschlossen. Die beiden anderen Teile — der öffentliche Blog und die Tutorials —
sind ausgeliefert.

**Was AGE-705 dabei nebenbei erledigt hat:** die Frage „wo lebt der lesbare
Text?", die der ursprüngliche Zuschnitt als erste Entscheidung nannte, ist
beantwortet. `src/content/release-geschichten.ts` trägt 23 redigierte
Geschichten, und ihr Kopfkommentar hat diesen Anschluss vorgesehen — „derselbe
Text kann in eine Zustellung wandern". Dieser Change muss daher **keinen Text
erzeugen**, sondern nur eine vorhandene Mitteilung an einer zweiten Stelle
zeigen.

## What Changes

- **Eine dritte Beitragsart** `kind = 'release'` auf `public.posts`, mit einer
  **eigenen** Spalte `release_note_id` (FK auf `public.release_notes`).
  `ref_id` kann sie nicht tragen: die Spalte hat einen Fremdschlüssel auf
  `public.events`.
- **Der Beitrag entsteht beim Zustellen**, nicht beim Entwerfen — ein Trigger am
  Übergang `draft → sent`. Er liegt damit hinter demselben Riegel, der die
  Doppelzustellung verhindert: nur `send_release_note()` kann diesen Übergang
  schreiben, weil die UPDATE-Policy `status = 'draft'` erzwingt.
- **Der Beitrag speichert keinen Text.** `body` bleibt leer, Titel und Text
  kommen zur Laufzeit aus `release_notes` — dasselbe Muster wie beim
  Event-Beitrag. Zwei Kopien desselben Textes könnten auseinanderlaufen, und die
  redigierte Fassung ist in `release_notes` schon da.
- **Eine Release-Karte im Feed**, chronologisch zwischen den übrigen Beiträgen,
  mit einem Weg zur vollen Mitteilung auf `/neues`.
- **Kein Autor an der Karte.** `posts.author_id` bleibt unverändert `not null`
  und trägt den versendenden Admin; die Oberfläche zeigt ihn nicht, sondern
  einen Absender „Neu in der App" — nach dem Muster von `ehemaligesMitglied()`,
  das für autorlose Karten bereits existiert.
- **Ein Backfill** für die bereits zugestellten Notes, mit `created_at` aus
  `sent_at` — sonst stünden alle Altbestände als frischeste Beiträge oben.

**Kein BREAKING Change.** Die beiden bestehenden Arten, der Modal-Weg (AGE-632)
und der öffentliche Blog (AGE-705) bleiben unberührt.

## Capabilities

### New Capabilities

Keine. Der Feed-Beitrag ist eine Erweiterung des bestehenden Feeds, kein neues
Vermögen.

### Modified Capabilities

- `community-feed`: Die Anforderung *„Beiträge tragen eine Art und einen Bezug"*
  schließt `kind` heute auf zwei Werte und verlangt, dass `kind = 'member'`
  **kein** `ref_id` trägt — beides muss die dritte Art aufnehmen. Die
  Anforderung *„Der Feed zeigt zwei Kartentypen"* wird durch die dritte Karte
  ihrem Titel nach falsch. Dazu kommen Anforderungen für den systemverwalteten
  Release-Beitrag, analog zu den bestehenden Event-Anforderungen.

**`notifications` wird ausdrücklich NICHT angefasst.** Die Anforderungen dort
beschreiben die `notifications`-Zeilen und die Fläche `/neues`; beide bleiben
unverändert wahr, weil dieser Change eine **zweite** Fläche hinzufügt statt die
erste zu ersetzen. Das ist kein Zufall, sondern nötig: der aktive Change
`push-fundament` hält einen `MODIFIED`-Block auf *„Eine Release-Note erreicht
jedes aktivierte Mitglied ohne Abbestellung"*. Beide Changes dieselbe Anforderung
ändern zu lassen, machte den zweiten unarchivierbar.

## Impact

**Datenbank** — eine Migration, forward-only:

| Gegenstand | Änderung |
| --- | --- |
| `posts.kind` | CHECK auf `('member', 'event', 'release')` erweitern |
| `posts.release_note_id` | neue Spalte, FK auf `release_notes (id)`, **ausdrücklich benannt** (der Client bezeichnet ihn in der PostgREST-Einbettung namentlich) |
| `posts_kind_ref_id_check` | dreifach: `event` → `ref_id`, `member` → keines von beiden, `release` → `release_note_id` |
| partieller Unique-Index | auf `release_note_id where kind = 'release'` — eine Note hängt an genau einer Zeile |
| `posts_write_own` | unverändert: hält `kind = 'member'` fest, der Release-Beitrag ist systemverwaltet |
| neuer Trigger | auf `release_notes`, `after update of status`, `security definer` mit leerem `search_path` |
| gesetzte Spalten | `created_at` **und `veroeffentlicht_ab`** aus `sent_at`, `visibility = 'members'` — alle drei ausdrücklich, keine aus dem Vorgabewert |
| `hinweis_auf_meinem_beitrag()` | überspringt `kind = 'release'`, sonst benachrichtigt jede Reaktion den zustellenden Admin |
| `grants_test` | Golden-Snapshot zieht nach |

Die zweite Zeitspalte ist kein Detail: **der Feed ordnet und blättert über
`veroeffentlicht_ab`**, und die Spalte trägt `default now()`. Ein Beitrag, der
nur `created_at` gesetzt bekommt, stünde trotzdem oben im Feed. Gefunden hat das
die Plan-Review; der erste Entwurf hatte die Vorlage des Event-Backfills
übernommen, die **älter ist als diese Spalte**.

**Frontend** — vier Stellen, alle in `src/lib/feed.ts` und `CommunityFeed.tsx`:

- `feed.ts:871` — `kind: r.kind === "event" ? "event" : "member"` mappt jede
  unbekannte Art **still** auf `member`. Der Kommentar darunter nennt das „die
  harmlose Richtung"; mit einer dritten Art hört es auf, harmlos zu sein.
- `feed.ts:603` — der Typ-Filter `text` ist als `kind.neq.event` definiert, ein
  Release-Beitrag fiele also in „Text".
- `feed.ts:706` / `feed.ts:1144` — die SELECT-Listen brauchen den zweiten
  Einbettungs-Join.
- `CommunityFeed.tsx` — die Karte.

**Nicht betroffen, weil sie bereits filtern:** `dashboard.ts:266` und
`public-profile.ts:124` schränken auf `kind = 'member'` ein. Das ist die
bestehende generische Regel der Anforderung *„Der Feed zeigt zwei Kartentypen"* —
„Ansichten, die ausschließlich Mitgliedsbeiträge zeigen wollen, SHALL auf
`kind = 'member'` filtern" — und sie trägt die dritte Art ohne Zutun.

**Belege für die Tatsachenbehauptungen oben:**

```
grep -n "check (kind in ("        supabase/migrations/20260813100000_posts_kind_event_trigger.sql
grep -n "posts_ref_id_fkey"       supabase/migrations/20260813100000_posts_kind_event_trigger.sql
grep -n 'kind: r.kind === "event"' src/lib/feed.ts
grep -n 'kind.neq.event'          src/lib/feed.ts
grep -rn 'from("posts")'          src --include='*.ts' | grep -v test
grep -rn 'eq("kind", "member")'   src --include='*.ts' | grep -v test
```
