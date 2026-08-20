## Context

Gemessen am 20.08.2026 an beiden Datenbanken, nicht aus Dokumenten übernommen:

| Bestand | PROD `viwntbodrtqxgmqyxluh` | DEV `foelowldexkcqzewvrcf` |
|---|---|---|
| `profiles` | 72 (71 Import + `vorschau@fbc.invalid`), alle `impact` | 41 Personas über alle sechs Stufen |
| `profile_contacts` | 54, davon **38 mit Anschrift** | 26, davon **0** |
| `auth.users` | 72, davon 2 je angemeldet | 41, davon 18 |
| `posts` / `comments` / `events` | 29 / 13 / 8 | 34 / 13 / 13 |
| `feedback` | 1 | 21 |
| Storage-Objekte | **125** (57 `avatars`, 54 `covers`, 8 `event-covers`, 6 `post-media`) | 18 |
| Migrationen | 70 | 70 |

**Beide Schemata sind deckungsgleich** — 70 Migrationen auf beiden Seiten. Das
ist die Voraussetzung, unter der ein reiner Datenauszug überhaupt trägt; ohne
sie wäre der Spiegel eine Migration mit Datenanhang.

Werkzeuge auf der Maschine: `pg_dump`/`pg_restore`/`psql` 18.4, `supabase` CLI
2.111.0.

Der Auslöser für die Trigger-Frage steht in
`20260611115655_community_foundation.sql:82`: `on_auth_user_created`, AFTER
INSERT auf `auth.users`, legt über `handle_new_user()` eine Zeile in
`public.profiles` an — mit `tier = 'discover'`.

## Goals / Non-Goals

**Goals:**

- Ein wiederholbarer Befehl, der DEVs Datenbestand durch den von PROD ersetzt,
  Datenbank und Ablage gemeinsam.
- Der dabei entstehende Auszug ist die Sicherung, die Schritt 1 des
  PROD-Neuaufbaus verlangt — nicht ein zweites Werkzeug.
- Die drei Demo-Zugänge und `staff_roles` überleben jeden Lauf.
- Ein Lauf mit PROD als Ziel bricht ab, bevor er schreibt.

**Non-Goals:**

- **Kein Zeitplan.** Jeder Lauf verwirft den Arbeitsstand auf DEV.
- **Keine Anonymisierung.** Der Nachbereitungsschritt ist der Ort, an dem sie
  später ansetzt; gebaut wird sie hier nicht.
- **Kein Rückweg DEV → PROD.** Nicht „ungebaut", sondern ausgeschlossen.
- **Kein Leeren und Neu-Migrieren von PROD.** Das ist der Neuaufbau selbst.
- **Keine inkrementelle Übertragung.** Siehe Entscheidung 1.

## Decisions

### 1. Vollersatz per Auszug, nicht zeilenweiser Abgleich

Ein Vollersatz ist bauartbedingt idempotent: derselbe Lauf, derselbe
Zielzustand, unabhängig von der Vorgeschichte. Ein zeilenweiser Abgleich müsste
für **jede künftig angelegte Tabelle und Spalte** `upsert`-treu bleiben.

Der ausschlaggebende Punkt ist nicht der Aufwand, sondern die
Unbemerkbarkeit des Verfalls: eine neue Spalte, die der Abgleich nicht kennt,
wird schlicht nicht übertragen — und **kein Test kann das aufdecken**, weil
kein Test „DEV sieht aus wie PROD" prüfen kann, ohne selbst die Liste zu führen,
die veraltet ist.

*Verworfen:* ein `spiegel.ts` nach dem Muster von `wp_import.ts`. Es umginge die
Trigger-Falle bauartbedingt und wäre testbar wie der Import (343 Zusagen als
Vorbild) — aber sein Ergebnis wäre ein Vorgang, keine wiederherstellbare Datei,
und als Sicherung vor dem Leeren damit schwächer. Ein Werkzeug, das beide Rollen
trägt, schlägt zwei, von denen eines selten läuft und deshalb verrottet.

### 2. Der Trigger wird nicht abgeschaltet, sondern eingeplant

`on_auth_user_created` feuert beim Zurückspielen von `auth.users` und legt 72
Profilzeilen mit `tier = 'discover'` an. Danach kollidiert das Zurückspielen von
`public.profiles` auf dem Primärschlüssel.

Der Ablauf umgeht das **ohne erhöhte Rechte**:

```
1. auth.users in DEV leeren      → kaskadiert in public.profiles
2. public.* leeren
3. auth.users zurückspielen      → Trigger legt 72 Zeilen in profiles an
4. public.profiles leeren        (cascade; alles andere in public ist leer)
5. public.* zurückspielen
6. Nachbereitung
```

Schritt 4 ist der ganze Kunstgriff: die vom Trigger erzeugten Zeilen werden
weggeräumt, **nachdem** er gefeuert hat, statt ihn am Feuern zu hindern.
`truncate public.profiles cascade` folgt Fremdschlüsseln, die **auf** `profiles`
zeigen — `auth.users` wird von `profiles` referenziert, nicht umgekehrt, und
bleibt unberührt.

*Verworfen:* `alter table auth.users disable trigger on_auth_user_created`. Es
ist der kürzere Weg, verlangt aber Eigentümer- oder Superuser-Rechte an einer
Tabelle im `auth`-Schema. Ob die `postgres`-Rolle sie auf dem gehosteten Projekt
hält, ist **nicht gemessen** — und im lokalen Stack ist `postgres`
nachweislich kein Superuser. Ein Weg, der ohne die Frage auskommt, ist der
sicherere. Bleibt der Trigger versehentlich abgeschaltet, legt ausserdem jede
spätere Anmeldung auf DEV kein Profil mehr an, und das fällt erst Tage später auf.

### 3. Der geschützte Bestand wird hergestellt, nicht ausgespart

`staff_roles` und die drei `@fbcdemo.com`-Zugänge werden vom Vollersatz
mitgenommen und danach **neu angelegt** — statt sie beim Ersetzen zu übergehen.

Was ausgespart wird, ist nicht prüfbar: eine Aussparung, die ins Leere greift,
sieht aus wie eine, die getroffen hat. Was hergestellt wird, ist prüfbar — die
Zusage lautet „danach anmeldefähig", und die lässt sich messen.

`supabase/seed/admin_roles.sql` trägt die `staff_roles` bereits; der
Nachbereitungsschritt ist damit kein neues Wissen, sondern ein Aufruf.

### 4. Die Zielprüfung liest den Benutzernamen, nicht den Host

Der Pooler-Host ist regionsweit gleich und unterscheidet die Projekte nicht —
die Kennung steht im Benutzernamen (`postgres.<ref>`). Ein Wächter, der den Host
prüft, hielte PROD und DEV für dasselbe Projekt und ginge durch.

Der WP-Import löst dieselbe Aufgabe bereits so (`wp_import.ts`, Aufgabe 1.4);
der Spiegel nimmt denselben Weg statt eines zweiten.

### 5. Die Ablage wird gespiegelt, nicht neu erzeugt

Objekte werden aus den vier Buckets von PROD gelesen und in DEV geschrieben, mit
`upsert: false`. In privaten Buckets verlangt `ON CONFLICT` ein Leserecht, das
für ein noch unverknüpftes Objekt verweigert wird — der Fehler zeigt dann auf
die RLS, obwohl die Policy richtig ist. Da DEVs Buckets vorher geleert werden,
gibt es ohnehin nichts zu überschreiben.

## Risks / Trade-offs

**`pg_dump` über den Pooler schlägt fehl** → Der Transaktions-Modus (Port 6543)
trägt kein `pg_dump`. Gebraucht wird die direkte Verbindung oder der
Session-Modus. `SUPABASE_DB_URL_PROD` löst auf die Pooler-Form auf — **das ist
vor allem anderen zu messen**, es entscheidet, ob dieser Entwurf überhaupt
trägt. Fällt es aus, ist `supabase db dump` der Ersatz, der die Frage für uns löst.

**Versionssprung `pg_dump` 18.4 gegen einen älteren Server** → Ein neueres
`pg_dump` gegen einen älteren Server ist der unterstützte Fall, der umgekehrte
nicht. Beide Seiten sind derselbe Dienst und dieselbe Version; zu prüfen ist es
trotzdem einmal, nicht zu unterstellen.

**Der Auszug trägt Personendaten in den Arbeitsbaum** → Ablage ausserhalb des
Arbeitsbaums, Rechte `0600`, und `git status --porcelain --ignored` als Zusage.
Das Repository ist öffentlich, und der Arbeitsbaum trägt dauerhaft untrackte
Dateien — eine falsche Ablage fiele in keinem Diff auf.

**Ein Abbruch mitten im Lauf lässt DEV halb ersetzt zurück** → Hingenommen. DEV
ist per Entscheidung 1 ein ersetzbares Abbild; die Antwort auf einen halben Lauf
ist ein zweiter. Deshalb ist der Auszug vollständig, **bevor** DEV angefasst
wird: der teure und unwiederholbare Teil ist das Lesen aus PROD, nicht das
Schreiben nach DEV.

**Nach dem Go-Live kopiert derselbe Lauf echte Gespräche** → Nicht in diesem
Change gelöst, aber verortet: der Nachbereitungsschritt ist die Stelle, an der
eine Anonymisierung ansetzt. Sie hier zu bauen, hiesse sie ohne echte Daten zu
entwerfen.

## Migration Plan

Kein Deploy, keine Migration, kein Anwendungscode. Der erste Lauf ist von Hand
und wird gemessen: Zeilenzahlen je Tabelle und Objektzahlen je Bucket vorher und
nachher, auf beiden Seiten.

**Rückweg:** DEVs heutiger Bestand ist die Demo-Welt, die
`supabase/seed/demo_seed.ts` erzeugt — sie ist reproduzierbar und braucht keine
Sicherung. Das ist der Grund, warum dieser Change ohne Netz gegen DEV laufen darf
und der Neuaufbau gegen PROD nicht.

## Open Questions

- **Sollen die 21 Feedback-Zeilen auf DEV den Ersatz überleben?** Donald hat für
  `demo:reset` gesagt, sie stören nicht. Beim Spiegel ist die Lage anders:
  `feedback` wird mit ersetzt, PROD trägt genau eine Zeile. Täglich synchron
  **und** eigenen Bestand behalten geht bei derselben Tabelle nicht beides. Bis
  zur Antwort führt der Entwurf `feedback` **nicht** im geschützten Bestand —
  die Zeilen sind Testeingaben, keine Arbeit.
- **Trägt `SUPABASE_DB_URL_DEV` eine direkte Verbindung?** Entscheidet zusammen
  mit dem Pooler-Risiko über das Werkzeug. Vor der ersten Zeile Code zu messen.
