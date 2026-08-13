---
reviewers: [gemini, codex, opencode]
models: [gemini-cli (Modell nicht protokolliert), gpt-5.6-sol, Kimi-K3]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: f5ffb2ec041b9e0dfecfc4d510e52d4039e9263c1b7a000bbe60922f1fb0f5bf
---

# Change review — academy-lite-and-feed-weave (AGE-533 / C9)

Drei Anbieter, drei Modelle, keiner davon der Anbieter dieses Hosts. **Alle drei
verlangen Änderungen.** Zwei Befunde stehen unabhängig bei zwei Reviewern
(`host_id`-Lebenszyklus, Host-Grenze im Constraint) — die zuerst.

Die Reviewer haben den Stand von **vor** der Gemini-Einarbeitung gelesen (SHA
oben). Wo ein Befund dadurch schon erledigt war, steht es dabei.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- **[HIGH] proposal Bestandsaufnahme 1 / tasks 2.2** — `drop function` bricht
  andere Aufrufer; der Vorschlag nimmt an, das Frontend sei der einzige.
- **[MEDIUM] design §2 / tasks 1.4** — Backfill über einen zweiten Parser;
  „Abweichung dokumentieren" ist keine Lösung für ein Datenintegritätsproblem.
- **[LOW] design §1** — die Rang-Asymmetrie braucht eine Produktentscheidung,
  nicht nur eine Notiz.
- **[LOW] design §3** — „Like" ist ein soziales Signal, „gemerkt" eine private
  Handlung; die Vermischung überrascht Nutzer.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- **[HIGH] tasks 2.2** — die behauptete PostgREST-Mehrdeutigkeit ist **falsch**:
  Überladungen mit verschiedener Argumentzahl werden unterstützt. Und der Drop
  bricht ausgelieferte Clients im Fenster zwischen Migration und Deploy.
- **[HIGH] design §2** — „ein Parser, daher kein Drift" ist **nicht
  durchsetzbar**: `authenticated` hat weiterhin INSERT/UPDATE auf `posts`, und
  die RPC nimmt ein frei gewähltes `p_video_url` entgegen.
- **[HIGH] tasks 5.2–5.4 / `posts_write_own`** — Event-Beiträge sind **nicht**
  systemverwaltet: der Host kann seinen Event-Beitrag löschen, auf `member`
  umschreiben oder die Sichtbarkeit nach dem Trigger wieder ändern.
- **[HIGH] proposal Impact / tasks 6.7** — zwei `posts`-Leser fehlen:
  `src/lib/dashboard.ts` und `src/lib/public-profile.ts`.
- **[MEDIUM]** `host_id`-Lebenszyklus wird nicht nachgezogen.
- **[MEDIUM]** Likes/Kommentare auf Event-Karten sind zugesagt, aber nirgends
  verdrahtet oder getestet.
- **[MEDIUM]** Drop verliert Kommentar und Grants; neue Funktionen bekommen
  `PUBLIC EXECUTE`; Trigger-Funktionen werden nicht revoked.
- **[MEDIUM]** die „genau drei Stellen" sind **vier**: `post_media_lesbar`
  spiegelt dasselbe Prädikat.
- **[MEDIUM]** Backfill vergleicht nur Trefferzahlen.
- **[MEDIUM]** Host-Constraint unterbestimmt; Host-Spoofing
  (`youtube.com.evil.example`) ungetestet.
- **[MEDIUM]** Academy „Alle" ohne Pagination — PostgREST schneidet still ab.
- **[MEDIUM]** `rls_test.sql` hat ein festes `plan(342)`.
- **[LOW]** Szenario „Meine Academy zeigt nur die eigenen" widerspricht dem
  zweiten Regal.
- **[LOW]** Impact nennt zwei Migrationen, Tasks erzeugen drei; `pnpm gen:types`
  existiert nicht.

## Reviewer: opencode (Kimi-K3)

VERDICT: REQUEST-CHANGES

- **[HIGH]** die Host-Liste im Delta nennt `www.youtube.com` nicht.
- **[HIGH]** „der Check begrenzt, er parst nicht" ist genau die Lücke — ein
  Präfix-Check lässt `youtube.com.boese.tld` durch.
- **[HIGH]** Drop nimmt Grants, `security definer` und `search_path` mit;
  PostgRESTs Schema-Cache muss nachladen.
- **[HIGH]** der Trigger deckt den `host_id`-Lebenszyklus nicht ab.
- **[MEDIUM]** **Blast-Radius:** ab Migration B erzeugt *jedes* `insert into
  events` in *jedem* Bestandstest eine `posts`-Zeile. Zählungen brechen — oder
  bleiben zufällig grün auf falscher Basis.
- **[MEDIUM]** doppelter Index auf `ref_id`.
- **[MEDIUM]** `posts.body = ''` ist angenommen, nicht geprüft.
- **[MEDIUM]** kennt `events` einen Entwurfszustand?
- **[MEDIUM]** Deploy-Lücke beim RPC-Austausch ist nirgends entschieden.
- **[LOW]** die Host-Lösch-Kaskade ist benannt, aber durch keinen Test gepint.
- **[LOW]** die Autor-Seite des Aktivierungs-Gates ist unbenannt.
- **[LOW]** formale Brüche im Delta.

## Nicht gezählt

Keine. Alle drei Arme liefen durch (Exit 0). `claude` wurde nicht aufgerufen —
es ist der Anbieter dieses Hosts.

## Resolution

### Der Befund, der den Plan umbaut: HIGH (codex) — „ein Parser" ist nicht durchsetzbar

**Angenommen, und er kippt den Entwurf.** `posts_write_own` gibt
`authenticated` INSERT/UPDATE direkt auf `posts`. Ein Client kann also ein
`video_url` setzen, das nicht im Body steht — oder einen Videolink im Body
lassen und `video_url` leer. Die Zusage „`video_url` und das gerenderte Embed
können nicht auseinanderlaufen" war schlicht **falsch**.

**Die Ableitung wandert auf den Server.** Neu:

- eine SQL-Funktion `public.erste_video_url(text)`,
- ein `before insert or update`-Trigger auf `posts`, der `video_url` **immer**
  aus `body` neu berechnet — ein von Hand gesetzter Wert wird überschrieben,
- derselbe Funktionsaufruf im Backfill,
- die Karte bettet `post.video_url` ein statt den Body erneut zu parsen.

Damit gibt es genau **einen** Wert, er ist nicht fälschbar, und Backfill und
Laufzeit sind per Konstruktion identisch statt per Zusicherung.

`design.md` §2 hatte diesen Weg verworfen („zweiter Parser"). Die Begründung
war richtig beschrieben und trotzdem die schlechtere Wahl: der Preis des
SQL-Parsers ist eine *benannte, testbare* Parität zwischen zwei Erkennern; der
Preis des Client-Wegs war eine Zusage, die niemand einhalten kann. §2 ist
umgeschrieben, die verworfene Alternative ist jetzt die gewählte, und warum
steht dabei.

**Nebenwirkung, und sie ist gut:** die RPC wird gar nicht mehr angefasst. Damit
entfallen `drop function`, die Signaturfrage, der Default-Parameter, die
Grants-Wiederherstellung, der Schema-Cache und das Deploy-Fenster — also
**gemini HIGH, codex HIGH 1, codex MEDIUM 7, opencode HIGH 3 und opencode
MEDIUM „Deploy-Lücke" auf einen Schlag.** Der Change wird dadurch kleiner.

Die Paritätsprüfung bleibt und wird härter: **alle** Fixtures aus
`feed.test.ts` laufen durch `erste_video_url`, und beide Erkenner müssen
Zeichen für Zeichen übereinstimmen — inklusive `http`, Großschreibung, `www.`,
`m.`, Query-Parameter und der Präfix-Angriffe.

### codex HIGH 1 — meine Begründung war falsch

**Angenommen.** PostgREST unterstützt Überladungen nach Argumentnamen; „wählt
mehrdeutig" war falsch. Der Punkt ist mit dem Umbau oben gegenstandslos, die
falsche Behauptung wird trotzdem aus `proposal.md` entfernt — eine falsche
Begründung, die zufällig zur richtigen Handlung führt, ist beim nächsten Mal
eine falsche Handlung.

### codex HIGH 3 — Event-Beiträge sind nicht systemverwaltet

**Angenommen, schwerwiegend.** `posts_write_own` ist `for all` auf
`author_id = auth.uid()`, und der Host **ist** der Autor seines Event-Beitrags.
Er kann ihn löschen, auf `kind='member'` umschreiben oder die vom Trigger
gesetzte Sichtbarkeit danach wieder ändern. Eindeutigkeit und Sichtbarkeit
galten damit nur zufällig.

`posts_write_own` bekommt `kind = 'member'` ins `using` und
`kind = 'member' and ref_id is null` ins `with check`. Event-Zeilen sind danach
für jeden Nutzer unsichtbar beschreibbar — nur die DEFINER-Trigger schreiben
sie. Drei pgTAP-Umgehungsfälle dazu (neu 5.1).

### codex HIGH 4 — zwei übersehene `posts`-Leser

**Angenommen, nachgemessen.** `grep 'from("posts")' src/` liefert **drei**
Dateien: `feed.ts`, `dashboard.ts`, `public-profile.ts`. Beide letzteren
filtern `.eq("author_id", …)` und zeigen rohe Bodies mit `limit(4)` bzw.
`limit(5)` — ein Host sähe dort leere Karten, die echte Beiträge verdrängen.
Beide filtern künftig `kind = 'member'`, mit Test. Der Impact-Abschnitt nennt
sie.

### codex MEDIUM 1 + opencode HIGH 4 — `host_id`-Lebenszyklus

**Angenommen** (zwei unabhängige Reviewer). Der Update-Trigger hört künftig auf
`visibility` **und** `host_id`, und der Lebenszyklus ist vollständig
spezifiziert: `null → Host` legt den fehlenden Beitrag an, `Host → Host` zieht
`author_id` nach, `Host → null` entfernt den Beitrag. Je ein pgTAP-Fall.

### codex MEDIUM 4 — es sind vier Spiegelstellen, nicht drei

**Angenommen, und es stärkt die Entscheidung.** `post_media_lesbar`
(20260812090000) spiegelt dasselbe Prädikat als DEFINER. Ein Join in der Policy
müsste also in **vier** Stellen. `design.md` §1 ist korrigiert. Dazu die Frage,
die codex zu Recht stellt: Event-Beiträge tragen **keine** `post_media` — der
Trigger legt keine an, und nach dem Fix zu HIGH 3 kann sie auch niemand
nachtragen. Das steht jetzt als Anforderung da, statt sich aus dem Ablauf zu
ergeben.

### codex MEDIUM 6 + opencode HIGH 1/2 — die Host-Grenze

**Angenommen.** Mit dem Umbau entfällt der Check-Constraint (der Trigger ist die
Garantie), aber `erste_video_url` erbt die Anforderung vollständig. Zwei
konkrete Fehler in meinem Entwurf, beide von den Reviewern gefunden:

1. **`~` ist case-sensitive, `parseVideoUrl` lowercased den Host**
   (`feed.ts:165`). `https://WWW.YouTube.com/watch?v=X` hätte der SQL-Spiegel
   abgelehnt, der TS-Parser akzeptiert ihn. → `~*`.
2. **`youtube-nocookie` gehört NICHT dazu** (opencode schlägt es vor):
   `parseVideoUrl` kennt es nicht. Die Liste wird aus dem Code abgeleitet, nicht
   ergänzt.

Zur Präfix-Grenze: das Muster ist bereits verankert (`^https?://(www\.)?…$` mit
Pfadgrenze), `youtube.com.evil.example` fällt durch. Das war Glück im
Entwurf, nicht Absicht in der Spec — beides steht jetzt als Anforderung, mit
pgTAP-Negativfall.

### opencode MEDIUM — Blast-Radius auf die Bestandstests

**Angenommen, und niemand sonst hat es gesehen.** Ab Migration B erzeugt jedes
`insert into events` in jedem pgTAP-Fall und jeder JS-Fixtur eine zusätzliche
`posts`-Zeile. Bestehende Zählungen brechen — oder bleiben, schlimmer, zufällig
grün auf falscher Basis. Eigene Aufgabe (neu 5.8), und sie ist ausdrücklich
**nicht** „Suite läuft grün", sondern „jede Zählung auf `posts` ist einzeln
angesehen".

### codex MEDIUM 12 — `plan(342)`

**Angenommen, nachgemessen:** `rls_test.sql:15` trägt `select plan(342)`. Eigene
Aufgabe.

### codex MEDIUM 11 + Academy-Pagination

**Angenommen.** „Alle" verspricht alle sichtbaren Videos ohne Grenze; PostgREST
schneidet still ab. Die Academy übernimmt die Keyset-Paginierung des Feeds
(`FEED_SEITE`, Cursor über `(created_at, id)`) statt eine zweite Mechanik zu
erfinden. Für das Like-Regal gilt dasselbe.

### codex MEDIUM 2 — Likes und Kommentare auf Event-Karten

**Angenommen.** Die Spec sagt es zu, keine Aufgabe verdrahtete es. RED-Tests für
Like, Unlike, Kommentar öffnen, Kommentar anlegen (neu 6.4a).

### codex MEDIUM 7 — Grants und Revokes der neuen Funktionen

**Angenommen**, in reduzierter Form: es gibt keine RPC mehr zu droppen, aber
drei neue Funktionen (`erste_video_url`, zwei Trigger-Funktionen). Alle drei
bekommen `revoke execute … from public, anon, authenticated` und
`has_function_privilege`-Fälle in pgTAP.

### opencode MEDIUM — leerer Body, und Entwurfszustand

**Beide mit der 0.4-Messung beantwortet, nicht mit einer Meinung:**

- `posts` trägt genau einen Check-Constraint, `posts_visibility_check`. Es gibt
  **keinen** Not-Empty auf `body` — `body = ''` läuft durch.
- `events` hat **keine** Status-/Entwurfsspalte (die `status`-Spalte im
  Migrationsskript gehört zu `event_registrations`). `insert` heißt
  veröffentlicht. Steht jetzt als Satz in `design.md`.

### opencode MEDIUM — doppelter Index

**Angenommen.** Der partielle Unique-Index über `ref_id where kind = 'event'`
trägt den Join vollständig; der zusätzliche Index entfällt.

### opencode LOW — Kaskade und Autor-Seite des Gates

**Beide angenommen.** Die Host-Lösch-Kaskade bekommt ihren pgTAP-Fall. Zur
Autor-Seite: ein nicht aktiviertes Konto kann gar kein Event anlegen
(`events_write_host` trägt `is_activated()`), also entsteht der Fall nicht — das
steht jetzt dort, wo bisher die Begründung aus `posts_write_own` stand, die nach
dem Fix zu HIGH 3 nicht mehr trägt.

### gemini MEDIUM + codex MEDIUM 9 — der Backfill-Vergleich

**Bereits vor diesem Review eingearbeitet** (Token für Token statt Trefferzahl,
Schwelle null). Mit der Server-Ableitung wird er zusätzlich gegenstandslos für
die *interne* Konsistenz: Backfill und Laufzeit rufen dieselbe Funktion. Der
Vergleich bleibt für die **Parität SQL ↔ TypeScript**.

### codex LOW 1 — das widersprüchliche Szenario

**Angenommen.** „Meine Academy zeigt nur die eigenen" wird auf das Regal
„selbst geteilt" begrenzt. Dazu festgelegt, was codex zu Recht offen findet: ein
eigenes, zugleich geliktes Video erscheint in **beiden** Regalen — sie
beantworten verschiedene Fragen.

### codex LOW 2 — Zahlen und ein Kommando, das es nicht gibt

**Angenommen, nachgemessen.** Es sind wieder **zwei** Migrationen (die
RPC-Migration entfällt). Und `pnpm gen:types` existiert nicht — weder in
`package.json` noch in den Workflows. Die Aufgabe nennt jetzt den echten Weg
(`supabase gen types typescript`) statt eines erfundenen Skripts.

### gemini LOW 1 — die Rang-Asymmetrie

**Nicht geändert, bewusst.** Sie ist in `design.md` benannt und wird per pgTAP
gepint. Ein UI-Hinweis dazu wäre eine Erklärung für einen Zustand, den zum
Go-Live niemand erlebt (alle Konten sind `impact`, Rang 6). **Für Donald zur
Kenntnis** — das ist die Produktentscheidung, die gemini einfordert, und sie ist
hiermit ausdrücklich getroffen statt übergangen.

### opencode LOW — formale Brüche im Delta

**Teilweise angenommen.** Jede Delta-Datei trägt höchstens einen Abschnitt je
Art; das ist geprüft. Die Sprachmischung in den Szenario-Titeln bleibt: geänderte
Anforderungen behalten die Sprache ihres Originals (englisch), neue sind deutsch
— dasselbe Muster wie in C7 und C8. Eine Vereinheitlichung wäre ein Umbau der
Bestandsspecs und gehört nicht in diesen Change.

### Was NICHT angenommen wurde

- **opencode HIGH 1, Teil „`www.youtube.com` fehlt"** — die Regex trug
  `(www\.)?` von Anfang an; die Prosa im Delta zählte die Hosts ohne diesen
  Zusatz auf und hat den Eindruck erzeugt. Die Prosa wird präzisiert, das
  Muster war richtig. **Der zweite Teil desselben Befunds — `youtube-nocookie`
  aufnehmen — ist ausdrücklich abgelehnt:** `parseVideoUrl` kennt diesen Host
  nicht, und ihn nur in SQL zu ergänzen wäre genau die Drift, gegen die dieser
  ganze Abschnitt antritt.
- **opencode Annahme 7** („der Live-Beleg existiert vielleicht nicht") — die
  Academy bringt neue sichtbare Zeichenketten (Reiterbeschriftungen, leere
  Zustände) ins Bundle; der Beleg ist erreichbar. Keine Änderung.
