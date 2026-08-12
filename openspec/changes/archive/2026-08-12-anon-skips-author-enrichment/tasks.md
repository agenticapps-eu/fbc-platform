# Tasks — ohne Session nicht abfragen (AGE-530)

## 1 · Rot vor grün

- [x] 1.1 Test: **ausgeloggt** (`uid = null`) setzt `fetchFeed` **keine**
      `profiles_public`-Abfrage ab — am gestubbten Client über die angefragten
      Relationen gezählt, nicht am Aussehen abgelesen. Muss vor der Änderung
      **rot** sein.
- [x] 1.2 Test: **ausgeloggt** fragt `fetchEvents` / `fetchEvent` **weder**
      `profiles_public` **noch** `partners` ab. Beide Hälften vorher rot.
- [x] 1.3 Gegenprobe: **eingeloggt** (`uid` gesetzt) werden `profiles_public`
      und `partners` weiterhin abgefragt, und Autor beziehungsweise Host sind
      aufgelöst. Muss vorher **und** nachher grün sein — sie fängt eine zu
      breite Bedingung.
- [x] 1.4 Gegenprobe: ausgeloggt trägt ein Event **keine** Host-Angabe und der
      Feed liefert seine Beiträge unverändert vollständig — die Sperre darf
      nichts anderes mitnehmen.

- [x] 1.5 Gegenprobe: **eingeloggt** löst `fetchComments` die Kommentar-Autoren
      auf. Diese Zeile ist der Grund, warum die Signatur sich ändern muss —
      siehe 2.6.

- [x] 1.6 Test auf die **Regel** statt den Einzelfall: ausgeloggt wird keine
      Relation angefragt, die nicht auf der `anon`-Positivliste aus
      `20260715140000_explicit_grants.sql` steht. Fängt einen vierten Verstoß,
      ohne dass jemand ihn erraten muss; die Rot-Fähigkeit ist nachgewiesen.

**Kein neuer Test auf „Ein Mitglied".** `src/lib/displayAuthor.test.ts` hält
das bereits und ist grün; die Anzeige ändert dieser Change nicht.

## 2 · Die Änderung

- [x] 2.1 `fetchAuthors(uid, ids)` gibt ohne `uid` eine leere Karte zurück,
      ohne zu fragen.
- [x] 2.2 `fetchFeed` reicht sein vorhandenes `uid` durch.
- [x] 2.3 `hostsFor(uid, rows)` gibt ohne `uid` eine leere Karte zurück —
      **beide** Hälften entfallen, `profiles_public` wie `partners`.
- [x] 2.4 `fetchEvents` / `fetchEvent` reichen ihr vorhandenes `uid` durch.
- [x] 2.5 Die Kommentarköpfe an beiden Stellen sagen den Grund, nicht die
      Mechanik: ohne Session ist beides nicht lesbar, also wird nicht gefragt —
      und das ist **keine** Sicherheitsgrenze, die bleibt das fehlende Grant.
      Der veraltete Halbsatz „für authenticated lesbar. Best-effort: hat der
      Aufrufer (anon) keinen Lesezugriff …" in `feed.ts:287` wird dabei
      richtiggestellt.
- [x] 2.6 `fetchComments(uid, postId)` reicht `uid` **doch** durch — Korrektur
      am eigenen Plan, beim Umsetzen aufgefallen. Die erste Fassung wollte die
      Funktion unberührt lassen; da sie `fetchAuthors` aufruft, hätte das
      **eingeloggten** Lesern an jedem Kommentar den Rückfall „Mitglied"
      gezeigt. Codex' Befund stimmte für den *anon*-Pfad (den gibt es nicht,
      Grant `authenticated`) — nicht für die Signatur.
- [x] 2.7 Test 1.5 hält genau das fest: eingeloggt sind die Kommentar-Autoren
      aufgelöst.

## 3 · Abnahme

- [x] 3.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün.
- [x] 3.2 Code-Review auf dem Diff (nicht auf dem Plan).
- [x] 3.3 **Auf der Live-Seite ausgeloggt nachgesehen** (2026-08-12, nach dem
      Deploy von PR #163 auf `fbc-platform.pages.dev`, Chrome/DevTools):

      | Fläche | Supabase-Aufrufe ausgeloggt |
      | -- | -- |
      | `/aktivitaet` | `posts` 200 · `tags` 200 · `post_media` 200 · `post_engagement_counts` 200 |
      | `/events` | `events` 200 · `event_registration_counts` 200 |
      | `/` | `posts`, `events`, `post_media` und beide Zähler-RPC — sonst nichts |

      **Kein `profiles_public`, kein `partners`, kein `comments`** — und die
      Konsole ist fehlerfrei. Vor dem Deploy war der 401 an derselben Stelle
      klar zu sehen (lokal gegen dasselbe Backend gemessen, siehe die
      EVIDENCE des Schwesterchanges).

      `/events/:id` wurde **nicht einzeln** aufgerufen: ausgeloggt gibt es dort
      derzeit nur ein vergangenes Event ohne Kartenlink. Der Pfad ist
      codegleich — `fetchEvent` ruft dasselbe abgesicherte `hostsFor` wie die
      Liste.
- [ ] 3.4 Eingeloggt gegengeprüft: Autorennamen, Avatare, Stufen-Badges und
      beide Host-Arten unverändert. **Braucht ein Konto** — offen für Donald.
