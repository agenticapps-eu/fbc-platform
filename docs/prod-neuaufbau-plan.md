# PROD leeren und neu migrieren — Plan

Stand: 2026-08-17, alle Zahlen an diesem Tag an den echten Datenbanken gemessen,
nicht aus Dokumenten übernommen.

> **Nachgezogen am 2026-08-20 (AGE-576).** Zwei Dinge, die der Plan offen
> liess, sind entschieden bzw. gebaut: **Schritt 0 ist beantwortet** (Weg A),
> und **Schritt 1 hat sein Werkzeug** — es musste nicht geschrieben werden, es
> ist der Auszug des Spiegels mit `--sicherung`. Dazu ein Befund, der als
> Schritt 3b neu dazugekommen ist. Die Zahlen der Befunde 1–3 stammen weiter
> vom 17.08.; wo sie überholt sind, steht das dort.

> **Nachgezogen am 2026-08-22.** Drei Stellen waren überholt und sind ersetzt:
> **Befund 3** (PROD steht jetzt auf demselben Migrationsstand wie DEV, 71),
> **Schritt 3b** (die Bild-URLs sind relative Pfade, der Schritt entfällt) und
> die **Bestandstabelle** — PROD ist nicht mehr inhaltlich leer, sondern trägt
> seit dem Spiegel denselben Bestand wie DEV, samt der erfundenen Aktivität.
> Alle Zahlen an diesem Tag an beiden Datenbanken gemessen.

---

## Vorab: drei Befunde, die den Plan verändern

Diese drei stehen zuerst, weil sie die Aufgabe anders aussehen lassen, als sie
klingt.

### 1. Es gibt zwei Projekte, und das Deployment liest das FALSCHE

| | Projekt-Kennung | Was drin ist |
|---|---|---|
| „DEV" | `foelowldexkcqzewvrcf` | am 17.08.: 41 Profile, 34 Beiträge, 8 kommende Events, die ganze Demo-Welt. **Seit 20.08.: der Spiegel von PROD** — 72 Konten, 37 aktivierte Profile, 29 Beiträge, 8 Events, 125 Objekte; die Demo-Welt ist weg |
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

> **Seit dem 2026-08-20 ist das der gewollte Zwischenzustand, nicht das
> Versehen.** Die ausgelieferte Fläche bleibt bewusst auf DEV, bis PROD fertig
> ist — und DEV trägt seit dem Spiegel die echten Mitglieder, ist also nicht
> mehr die Demo-Welt. Umgestellt wird als **letzter** Handgriff (Schritt 5),
> nicht als erster. Am selben Tag am ausgelieferten Bundle nachgemessen: es
> enthält genau eine Projekt-URL, `foelowldexkcqzewvrcf`.

### 3. ~~PROD trägt die Korrektur-Migration NICHT~~ — erledigt am 2026-08-22

Am 17.08. war die letzte Migration auf PROD `20260817120000`; `20260817140000`
fehlte dort. **Das stimmt nicht mehr.** Seit dem `migrate-prod`-Lauf
32563367673 stehen DEV und PROD identisch auf **71 Migrationen**, letzte
`20260821120000` — genau die 71 Dateien in `supabase/migrations/`.
Nachgemessen am 2026-08-22 an beiden Datenbanken.

---

## Was auf PROD unwiederbringlich ist

Gemessen, damit die Antwort nicht geschätzt wird — **die Zahlen unten stammen
vom 2026-08-22**, die vom 17.08. stehen in der letzten Spalte daneben, weil sie
den Plan an mehreren Stellen noch tragen:

| Bestand | Heute (22.08.) | Am 17.08. | Ersetzbar? |
|---|---|---|---|
| `profiles` | **72** | 71 | **Nein ohne Quelle** — 71 aus dem WordPress-Export, eines danach dazugekommen |
| davon aktiviert | **37** | 2 | ja — der Aktivierungsstand wird über die Links neu erworben |
| `auth.users` mit je einer Anmeldung | **2** | 2 | die zwei sind die einzigen mit echter Historie |
| `posts` | **29** | 0 | **erfundene Aktivität** — 26 Urheber, Beiträge vom 03.–18.08. |
| `events` | **8** | 0 | dito |
| `storage.objects` | **125** | — | Profil- und Titelbilder, hängen an den Profilen |
| `messages`, `contact_requests`, `admin_audit` | **je 0** | je 0 | nichts zu verlieren |

**Die gute Nachricht des Plans steht weiter, nur anders begründet:** auf PROD
steht kein Gespräch, keine Nachricht und keine Protokollzeile — kein einziger
Datensatz, den ein Mitglied selbst erzeugt hat (nur 2 von 72 Konten haben sich
je angemeldet). Die 29 Beiträge und 8 Termine sind die **erfundene Aktivität**,
die der Go-Live ausdrücklich NICHT mitnehmen soll; sie zu löschen ist Ziel des
Neuaufbaus, nicht sein Preis.

> **Der Plan hiess PROD einmal „inhaltlich leer".** Das war am 17.08. wahr und
> ist es nicht mehr. DEV und PROD tragen seit dem Spiegel (20.08.) **denselben
> Bestand** — `posts`, `events` und `profiles` haben auf beiden Datenbanken
> identische Id-Mengen (md5 über die sortierten Ids, am 22.08. verglichen).

> **Seit dem 2026-08-20 ist „unwiederbringlich" die falsche Überschrift.**
> Schritt 1 hat ein Werkzeug, das den ganzen Bestand samt Storage sichert und
> dessen Rückweg gemessen ist. Die Zeile „Nein ohne Quelle" gilt nur noch für
> den Fall, dass niemand vorher den Auszug gefahren hat.

---

## Ausgeführt am 2026-08-22: der Reset statt des Neuaufbaus

**Die Schritte 2 bis 4 sind nicht gelaufen und werden nicht mehr gebraucht.**
Der Plan setzte voraus, dass PROD auf einem alten Migrationsstand steht und
inhaltlich leer ist. Beides gilt nicht mehr: PROD trägt seit dem
`migrate-prod`-Lauf dieselben 71 Migrationen wie das Repo, und die Inhalte, die
weg sollten, stammen sämtlich aus **einem** Seed mit **eigenem Rückweg**
(`supabase/seed/import_world_seed.ts`, AGE-566, Präfix `0ade0566`).

Gelaufen ist deshalb nur:

```bash
infisical run --env=prod -- env IMPORT_SEED_CONFIRM=fbc-import-vorschau \
  IMPORT_SEED_MODE=reset \
  IMPORT_SEED_CA_CERT=scripts/supabase-root-2021-ca.crt \
  npx tsx supabase/seed/import_world_seed.ts
```

`IMPORT_SEED_CA_CERT` ist Pflicht — ohne die Root-CA bricht der Lauf mit
„self-signed certificate in certificate chain" ab, vor dem ersten Statement.

**Ergebnis, unabhängig nachgemessen (nicht der Bilanz des Skripts geglaubt):**

| | vor dem Reset | danach |
|---|---|---|
| `profiles` / `auth.users` | 72 | **71** (das Vorschau-Konto ging mit) |
| aktiviert | 37 | **2** — die einzigen mit echter Anmeldung |
| `posts` | 29 | **3** (Detlevs echte, 0 mit Seed-Präfix) |
| `events` / `event_registrations` / `post_likes` | 8 / 97 / 88 | **0 / 0 / 0** |
| `comments` | 13 | **1** |
| `storage.objects` `event-covers` | 8 | **0** |
| Avatare / Titelbilder / `post-media` | 57 / 54 / 6 | **unverändert**, 0 tote Verweise |
| `staff_roles` | 3 | **2** (Donald, Detlev) |

**Zwei Dinge, die der Plan so nicht gesehen hatte:**

- **Detlev hat drei echte Beiträge geschrieben** (17./18.08.), einer mit sechs
  Bildern. Ein Wipe hätte sie gelöscht. Donalds Entscheidung am 22.08.: sie
  **bleiben** stehen. Von seinen zwei Kommentaren ist einer mitgegangen — er
  hing unter einem erfundenen Beitrag und kaskadierte mit ihm.
- **`staff_roles` legt keine Migration an.** Nach einem Wipe wäre niemand Admin
  gewesen, bis `supabase/seed/admin_roles.sql` von Hand läuft (und das braucht
  `psql`). Tags, `platform_settings`, Badges, Partner-Kategorien und Stufen
  kämen dagegen aus Migrationen zurück.

Bleibt aus diesem Plan: **Schritt 5**, die Umgebung nachziehen.

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

> ### Beantwortet am 2026-08-20: **Weg (A)**
>
> Donalds Festlegung nach Absprache mit Detlev. `viwntbodrtqxgmqyxluh` bleibt
> PROD und geht live; `VITE_SUPABASE_URL` in Infisical `prod` wird umgestellt,
> **aber erst, wenn PROD fertig ist** — bis dahin bleibt die ausgelieferte
> Fläche bewusst auf DEV.
>
> Vier Festlegungen, die daran hängen und den Rest des Plans präzisieren:
>
> - **PROD trägt am Ende alle Mitglieder, ist aber inhaltlich leer.** Keine
>   erfundenen Beiträge, Kommentare oder Termine.
> - **DEV behält die heutigen PROD-Daten** — echte Mitglieder samt der
>   erfundenen Aktivität. Das ist der Spiegel, er steht seit dem 20.08. Die
>   alten Demo-Personas sind gewichen, ebenso die Feedback-Zeilen; die
>   Demo-Zugänge werden **nicht** wiederhergestellt.
> - **Der Import setzt alle auf `impact`.** Der Go-Live gilt den heutigen
>   FBC-Mitgliedern aus WordPress; Neuzugänge gehen danach den normalen
>   Stufenweg ab `basic`, freigeschaltet etwa eine Woche nach dem Go-Live.
> - **Ein Downgrade fehlt und ist zu bauen** (AGE-516): `apply_upgrade` geht
>   nur hoch, `admin_update_profile` hat `tier` nicht auf der Weissliste.
>
> Damit ist auch der Abschnitt „Was dieser Plan nicht entscheidet" am Ende
> erledigt.

### Schritt 1 — Den Import sichern, BEVOR irgendetwas gelöscht wird

**Das Werkzeug musste nicht geschrieben werden.** Es ist der Auszug des
Spiegels (AGE-576) — derselbe, der DEV bespielt, nur in der anderen Rolle:

```bash
infisical run --env=prod -- npx tsx scripts/sync-dev-auszug.ts
```

Der Lauf **liest ausschliesslich** und öffnet keine Verbindung zu DEV. Was
entsteht, liegt ausserhalb des Arbeitsbaums (`~/.fbc-spiegel/…`, `0700`/`0600`):
`auth.sql`, `public.sql`, die Objekte der Ablage byteweise, und `manifest.json`
mit je Tabelle Zeilen und Hash, je Objekt Größe und Prüfsumme.

Das ist mehr, als dieser Schritt ursprünglich verlangte: nicht nur die 71
Profilzeilen samt `auth.users`-Adressen, sondern der ganze Bestand inklusive
Storage — und mit dem Manifest ein Vollständigkeitszeichen. **Ein Verzeichnis
ohne `manifest.json` ist ein abgebrochener Lauf** und darf nicht eingespielt
werden.

**Der Rückweg heisst `--sicherung`**, und ohne ihn ist der Auszug keine
Sicherung:

```bash
npx tsx scripts/sync-dev-ruecklauf.ts --ziel=lokal --sicherung <ablage>
```

`--sicherung` lässt die Hash-Neutralisierung **und** den DEV-eigenen Bestand
aus und stellt damit genau den Bestand des Manifests her — anmeldefähig, ohne
Dekoration. Ohne den Schalter wären die Konten nach dem Zurückspielen nicht
anmeldefähig. **Gegen `--ziel=dev` ist er abgelehnt**, vor jedem
Verbindungsaufbau.

**Prüfung:** `manifest.json` existiert, führt 71 Profilzeilen und die zwei
aktivierten Konten. Am 2026-08-20 belegt: derselbe Auszug in ein leeres, frisch
migriertes Schema ergibt den Bestand des Manifests, **72/72 Hashes byteweise**
und null Abweichungen.

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

Alle 71 Migrationen von vorn, in Reihenfolge. `db:push:prod` verlangt ein TTY —
das läuft im Terminal, nicht aus einem Agenten heraus.

**Prüfung, und diese ist die wichtigste:**

- `select count(*) from supabase_migrations.schema_migrations` = Zahl der
  Dateien in `supabase/migrations/` (heute **71**, letzte `20260821120000`).
- Der Grant-Test läuft durch: `supabase test db … grants_test.sql rls_test.sql
  directory_search_test.sql admin_member_list_test.sql` gegen PROD. **Nicht das
  ganze Verzeichnis** — die `probe_*.sql` sind kein pgTAP und lassen den Befehl
  fälschlich FAIL melden.
- Die vier Aktivierungs-Functions sind deployt. Ein Deploy wendet weder
  Migrationen noch Functions an; das sind drei getrennte Befehle.

### ~~Schritt 3b — Die Bild-URLs, die an der Projektkennung hängen~~ — gegenstandslos seit 2026-08-22

> **Dieser Schritt ist erledigt und entfällt.** AGE-580 hat die Spalten auf
> **relative Pfade** umgestellt: die Erzeuger schreiben Pfade, ein Auflöser
> baut die URL beim Anzeigen, und die Migration `20260821120000` hat den
> Bestand nachgezogen. Am 22.08. auf **beiden** Datenbanken nachgemessen:
> **0** absolute Werte, 56 `avatar_url` + 53 `cover_url` als Pfade. Ein Aufbau
> unter neuer Kennung liesse die Bilder damit nicht mehr ins Leere zeigen —
> das Risiko unten ist weg. Der Abschnitt bleibt als Befund stehen.

**Neu am 2026-08-20, gefunden auf der ausgelieferten Fläche.** Zwei Spalten
tragen keine Pfade, sondern **absolute URLs mit der Projektkennung darin**:

| Spalte | Zeilen mit absoluter URL |
|---|---|
| `profiles.avatar_url` | 56 |
| `profiles.cover_url` | 53 |

Keine einzige davon ist relativ. Ein Durchlauf über **alle** `text`-Spalten
aller `public`-Tabellen findet genau diese zwei — `event-covers` und
`post-media` laufen über Pfade und signierte URLs und sind nicht betroffen.

**Warum das hier steht:** Weg (A) behält die Kennung `viwntbodrtqxgmqyxluh`,
also überleben die URLs. **Wird PROD dagegen unter einer neuen Kennung
aufgebaut — oder fällt jemand auf Weg (B) zurück — zeigen alle 109 Bild-URLs
ins Leere**, obwohl die Objekte mitgezogen wären. Das sieht kein Grant-Test und
keine Zeilenzählung; es fällt erst im Browser auf, als leeres Profilbild.

Der Ausweg ist ein `update` über beide Spalten, das den Host austauscht, direkt
nach Schritt 4 — oder, dauerhafter, die Umstellung auf relative Pfade. Letzteres
ist Anwendungscode und gehört nicht in diesen Plan.

**Prüfung:** `select count(*) from public.profiles where avatar_url not like
'https://<neue-kennung>%'` = 0, und danach ein Profil im Browser ansehen. Die
Zählung allein reicht nicht — sie sagt nichts darüber, ob das Objekt unter der
neuen Kennung wirklich liegt.

### Schritt 4 — Import zurückspielen

Über den bestehenden Importweg, nicht über ein `insert` aus der Sicherung: der
Trigger `handle_new_user` legt die Profilzeile an, und reine Einfügespalten
kommen bei einem nachträglichen Update nie an.

**Prüfung:** 71 Profile aus dem Export (heute liegen 72 auf PROD — eines ist
nach dem 17.08. dazugekommen und gehört gesondert entschieden), davon 0
aktiviert (der Aktivierungsstand ist Absicht: er wird über die Links neu
erworben) — oder 2, wenn die beiden echten Konten ihren Stand behalten sollen.
Auch das ist eine Entscheidung, keine Technik. **Und 0 `posts`, 0 `events`** —
die erfundene Aktivität kommt nicht zurück.

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

## ~~Was dieser Plan nicht entscheidet~~ — entschieden

Welches der beiden Projekte am Ende PROD heißt. Alles andere hängt daran, und
die Antwort ist eine Produktentscheidung: ob die 71 importierten Mitglieder in
die Datenbank ziehen, in der heute die Demo lebt, oder ob das Deployment auf die
Datenbank umzieht, in der sie heute liegen.

**Am 2026-08-20 beantwortet: das Deployment zieht um** (Weg A, siehe Schritt 0).
Der Absatz bleibt stehen, weil er die Frage sauber stellt — nicht, weil sie noch
offen wäre.
