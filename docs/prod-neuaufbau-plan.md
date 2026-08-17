# PROD leeren und neu migrieren — Plan

Stand: 2026-08-17, alle Zahlen an diesem Tag an den echten Datenbanken gemessen,
nicht aus Dokumenten übernommen.

---

## Vorab: drei Befunde, die den Plan verändern

Diese drei stehen zuerst, weil sie die Aufgabe anders aussehen lassen, als sie
klingt.

### 1. Es gibt zwei Projekte, und das Deployment liest das FALSCHE

| | Projekt-Kennung | Was drin ist |
|---|---|---|
| „DEV" | `foelowldexkcqzewvrcf` | 41 Profile, 34 Beiträge, 8 kommende Events, die ganze Demo-Welt |
| „PROD" | `viwntbodrtqxgmqyxluh` | **71 Profile** (der WordPress-Import), sonst so gut wie nichts |

Das Bundle auf `fbc-platform.pages.dev` — die **einzige** erreichbare Fläche,
`app.fairbusinessclub.de` und `effbeezee.com` antworten nicht — redet mit
`foelowldexkcqzewvrcf`. Nachgemessen an der ausgelieferten Datei.

**Folge: die 71 importierten Mitglieder sind über keine Fläche erreichbar.** Sie
liegen in einer Datenbank, die kein Frontend liest. Das ist kein Detail des
Neuaufbaus, sondern vermutlich sein eigentlicher Anlass.

### 2. `VITE_SUPABASE_URL` zeigt auch in der `prod`-Umgebung auf DEV

In Infisical `prod` steht `SUPABASE_DB_URL_PROD` → `viwntbodrtqxgmqyxluh`, aber
`VITE_SUPABASE_URL` → `foelowldexkcqzewvrcf`. Ein Build „gegen prod" redet also
mit DEV. Solange das so bleibt, ändert ein Neuaufbau von PROD **nichts an dem,
was jemand im Browser sieht**.

Wer PROD neu aufbaut, ohne diese Zeile zu ändern, hat am Ende eine saubere
Datenbank, die weiterhin niemand benutzt.

### 3. PROD trägt die Korrektur-Migration NICHT

Letzte Migration auf PROD ist `20260817120000`. `20260817140000`
(Zeilensperre gegen den Wettlauf, `coalesce` gegen `limit null`) fehlt dort —
auf DEV liegt sie seit dem heutigen `migrate-dev`-Lauf. Was auch immer heute
nach PROD geschoben wurde, diese Migration war nicht dabei.

---

## Was auf PROD unwiederbringlich ist

Gemessen, damit die Antwort nicht geschätzt wird:

| Bestand | Zahl | Ersetzbar? |
|---|---|---|
| `profiles` | 71 | **Nein ohne Quelle** — aus dem WordPress-Export erzeugt |
| davon aktiviert | **2** | die zwei sind die einzigen mit echter Historie |
| `auth.users` mit je einer Anmeldung | **2** | dito |
| `posts`, `events`, `messages`, `contact_requests`, `admin_audit` | **je 0** | nichts zu verlieren |

**Das ist die gute Nachricht des Plans:** auf PROD steht kein Gespräch, kein
Termin, keine Nachricht und keine Protokollzeile. Der gesamte schützenswerte
Bestand sind 71 Profilzeilen, von denen 69 noch nie jemand benutzt hat.

---

## Der Plan

### Schritt 0 — Entscheiden, WELCHES Projekt am Ende das echte ist

Vor jedem Befehl. Es gibt zwei sinnvolle Antworten, und sie führen zu
verschiedenen Plänen:

- **(A) `viwntbodrtqxgmqyxluh` bleibt PROD.** Dann muss `VITE_SUPABASE_URL` in
  Infisical `prod` darauf umgestellt und neu gebaut werden — sonst siehe Befund 2.
- **(B) `foelowldexkcqzewvrcf` wird PROD.** Dann ist nicht PROD zu leeren,
  sondern die Demo-Welt aus der laufenden Datenbank zu entfernen
  (`pnpm demo:reset`) und der Import dorthin zu wiederholen.

**(B) ist der kürzere Weg** und entspricht dem, was heute tatsächlich läuft.
(A) ist der sauberere, wenn PROD dauerhaft getrennt bleiben soll.
Diese Entscheidung gehört Donald und Detlev, nicht dem Plan.

### Schritt 1 — Den Import sichern, BEVOR irgendetwas gelöscht wird

```
infisical run --env=prod -- tsx scripts/<export>.ts   # zu schreiben
```

Die 71 Zeilen aus `profiles` **samt der zugehörigen `auth.users`-Adressen** in
eine Datei. Der WordPress-Export allein reicht nicht: der Import hat Kennungen
vergeben, und wer sie verliert, kann einen bereits verschickten Aktivierungslink
nicht mehr zuordnen.

Zwei Konten haben sich angemeldet — die beiden gesondert notieren, sie sind die
einzigen mit echtem Zustand.

**Prüfung:** Zeilenzahl der Datei = 71, und die zwei aktivierten sind darin.

### Schritt 2 — Leeren

Nicht Tabellen einzeln leerräumen, sondern das Schema fallen lassen und neu
aufbauen — sonst überleben Trigger, Policies und Funktionen aus alten
Migrationen und die neue Historie beschreibt nicht, was wirklich da ist:

```sql
drop schema public cascade;
create schema public;
delete from auth.users;                      -- kaskadiert in profiles
truncate supabase_migrations.schema_migrations;
```

`storage.objects` gesondert prüfen: Avatare und Event-Titelbilder hängen nicht
an `public` und blieben sonst als verwaiste Objekte liegen.

**Prüfung:** `select count(*) from pg_tables where schemaname='public'` = 0,
`select count(*) from auth.users` = 0.

### Schritt 3 — Neu migrieren

```
infisical run --env=prod -- supabase db push --db-url "$SUPABASE_DB_URL_PROD"
```

Alle 70 Migrationen von vorn, in Reihenfolge. `db:push:prod` verlangt ein TTY —
das läuft im Terminal, nicht aus einem Agenten heraus.

**Prüfung, und diese ist die wichtigste:**

- `select count(*) from supabase_migrations.schema_migrations` = Zahl der
  Dateien in `supabase/migrations/` (heute **70**, mit `20260817140000`).
- Der Grant-Test läuft durch: `supabase test db … grants_test.sql rls_test.sql
  directory_search_test.sql admin_member_list_test.sql` gegen PROD. **Nicht das
  ganze Verzeichnis** — die `probe_*.sql` sind kein pgTAP und lassen den Befehl
  fälschlich FAIL melden.
- Die vier Aktivierungs-Functions sind deployt. Ein Deploy wendet weder
  Migrationen noch Functions an; das sind drei getrennte Befehle.

### Schritt 4 — Import zurückspielen

Über den bestehenden Importweg, nicht über ein `insert` aus der Sicherung: der
Trigger `handle_new_user` legt die Profilzeile an, und reine Einfügespalten
kommen bei einem nachträglichen Update nie an.

**Prüfung:** 71 Profile, davon 0 aktiviert (der Aktivierungsstand ist Absicht:
er wird über die Links neu erworben) — oder 2, wenn die beiden echten Konten
ihren Stand behalten sollen. Auch das ist eine Entscheidung, keine Technik.

### Schritt 5 — Die Umgebung nachziehen

Je nach Schritt 0: `VITE_SUPABASE_URL`, die Function-Secrets, die
`uri_allow_list` und `APP_URL` in der Auth-Konfiguration. Ein Neuaufbau, der
diese Zeilen vergisst, schickt Aktivierungslinks auf die alte Adresse.

**Prüfung:** eine Anmeldung von außen, einmal ganz durch — Link anfordern,
einlösen, Profil sehen.

---

## Was schiefgehen kann

- **`drift-gate` blockt danach jeden Frontend-Deploy**, bis `migrate-dev` und
  `migrate-prod` für denselben Commit gelaufen sind. Das ist kein Fehler,
  sondern die Absicht — es kostet aber einen Extra-Lauf, und `deploy.yml` hat
  kein `workflow_dispatch`: der Neustart geht nur über `gh run rerun --failed`.
- **Ein `migrate-prod`-Dispatch WENDET AN.** `apply` startet direkt hinter
  `plan`, ohne Reviewer-Regel. Wer den Trockenlauf lesen will, muss das
  außerhalb des Workflows tun.
- **Die Demo-Welt ist kein Backup.** Sie lebt auf `foelowldexkcqzewvrcf` und
  hat mit dem Import nichts zu tun. Bei Weg (B) wird sie mit `pnpm demo:reset`
  entfernt — und `demo:reset` löscht die drei `@fbcdemo.com`-Logins bewusst
  NICHT.

## Was dieser Plan nicht entscheidet

Welches der beiden Projekte am Ende PROD heißt. Alles andere hängt daran, und
die Antwort ist eine Produktentscheidung: ob die 71 importierten Mitglieder in
die Datenbank ziehen, in der heute die Demo lebt, oder ob das Deployment auf die
Datenbank umzieht, in der sie heute liegen.
