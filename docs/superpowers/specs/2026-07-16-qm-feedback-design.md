# Design — QM-Feedback (MVP)

**Repo:** `fbc-platform` · **Linear:** AGE-300 · **Datum:** 2026-07-16
**Setzt um:** `docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md` §3.5
**Status:** entschieden mit Donald am 16.07.2026

---

## 1. Was gebaut wird

Ein plattformweites Feedback-Modul für die Sommerfest-Präsentation: ⭐ 1–5 plus drei
Freitextfragen — „Was gefällt dir?" / „Was fehlt dir?" / „Welche Idee hast du?" — und die
Route, auf der das Feedback entstand. Schreibt eine Zeile in `public.feedback`. Ein `admin`
liest alles, jedes Mitglied nur sein eigenes.

**Kein autonomes QM** (Spec §4) — nur einsammeln.

## 2. Entscheidungen

### 2.1 Plattformweit, nicht aktionsgebunden

Die `feedback`-Tabelle (AGE-234) ist aktionsgebunden gebaut: `ref_type in ('event','match',
'course')` + `ref_id` beantworten „Wie war dieses Event?". Die alte Fassung von AGE-300
beschrieb es ebenso.

Spec §3.5 will etwas anderes: Fragen an *die Plattform*, gestellt von Gästen, die den
Prototyp gerade zum ersten Mal sehen. Der Route-Kontext tritt an die Stelle der Aktion.
Beim Sommerfest hat kaum ein Gast schon ein Event besucht — die aktionsgebundene Variante
liefe leer.

**Entschieden:** plattformweit. `ref_type`/`ref_id` bleiben bei diesen Zeilen `null`
(der bestehende CHECK lässt NULL durch, es gibt keine Kollision).
Die aktionsgebundene Variante bleibt als Phase-2-Scope in AGE-300 vermerkt.

### 2.2 Vier Spalten additiv, keine zweite Tabelle

`feedback` bekommt `likes`, `misses`, `idea`, `route` — alle `text`, alle nullable.
`note`, `ref_type`, `ref_id` bleiben unberührt und tragen weiter das aktionsgebundene
Feedback.

*Verworfen — eigene Tabelle `platform_feedback`:* trennt sauber, kostet aber eigene RLS,
eigene Grants und eine zweite Tabelle, die ein Admin später beide lesen muss. Die
bestehende Tabelle hat bis heute keinen einzigen Schreiber; sie zu teilen, bevor sie
überhaupt benutzt wird, ist eine Grenze ohne Anlass.

*Verworfen — ein JSONB `answers`:* Flexibilität für einen Fall, den es nicht gibt.
Die drei Fragen stehen im Spec fest. Kostet Typsicherheit und CHECK-Constraints.

### 2.3 `is_admin()` statt `is_matching_manager()`

Autorisierungsquelle ist `staff_roles` (server-kontrolliert), **nicht** `profiles.roles` —
letzteres ist member-writable (`grant update(roles) to authenticated`), ein Mitglied könnte
sich selbst zum Admin machen. ADR-0002 hält das ausdrücklich fest.

`is_admin()` spiegelt `is_matching_manager()` im Aufbau (SECURITY DEFINER, `search_path =
''`, `grant execute to authenticated`), prüft aber nur `role = 'admin'`.

*Verworfen — `is_matching_manager()` wiederverwenden:* spart eine Funktion, weitet aber die
Zuständigkeit des Matching-Managers (Deal-Queue, ADR-0002) stillschweigend aufs QM aus. Der
Name löge an der Aufrufstelle.

Die SECURITY-DEFINER-Form ist nicht dekorativ: `staff_roles` trägt selbst RLS
(`staff_roles_select_self`). Ein Inline-`exists(...)` in der Policy liefe als der abfragende
Nutzer und hinge davon ab, dass er seine eigene Staff-Zeile sehen darf — subtil und fragil.
DEFINER umgeht das, wie im Repo etabliert.

### 2.4 Schwebender Button, kein Nav-Eintrag

`src/config/nav.test.ts` nagelt die Navigation exakt an Spec §2 fest — 6 + 5 + 1, per
`expect(ist).toEqual(...)`. Unter „Service" steht genau ein Eintrag. Ein Feedback-Eintrag
machte daraus 6+5+2, verletzte Spec §2 und bräche den Test.

**Entschieden:** dezenter Button unten rechts im `AppShell`, öffnet einen Dialog. Nav, Spec
§2 und `nav.test.ts` bleiben unberührt. Überall erreichbar — genau dafür ist der
Route-Kontext da.

*Verworfen — Abschnitt in `/einstellungen`:* kein Gast sucht Feedback in den Einstellungen,
und `route` wäre immer `/einstellungen`, das Feld also wertlos.

### 2.5 Score-Kopplung mitfixen

`recompute_potential_score()` (Migration `20260613230000`) rechnet:

```sql
select count(*), avg(rating) into v_feedback_count, v_feedback_avg
from public.feedback
where profile_id = p_profile_id and rating is not null;
```

Kein `ref_type`-Filter, und `profile_id` ist der **Autor** der Zeile. Sobald dieses Modul in
die Tabelle schreibt, verändert ein Gast mit seiner Plattform-Bewertung **seinen eigenen**
Potenzial-Score: 5 Sterne rauf, 2 Sterne runter, beliebig oft wiederholbar.

Heute folgenlos, weil die Tabelle keinen Schreiber hat — das Frontend fasst sie nirgends an.
Dieses Issue macht die Falle scharf. Der Kommentar der Migration belegt die ursprüngliche
Absicht: *„Feedback: avg rating … Prototype proxy — feedback **received** is modelled later
(Ebene 2)."* Gemeint war Feedback ÜBER das Mitglied, implementiert ist Feedback VOM Mitglied.

**Entschieden:** `and ref_type is not null` in derselben Migration, mit Begründung im Kopf.
Fremder Code, aber dieser Commit macht die Falle erst scharf — der Waise gehört uns.

Dass `potential_score` im MVP „vorerst ausgeblendet" wird (Sommerfest-Prompt), entschärft
nichts: ausgeblendet heißt nicht, dass die Funktion nicht rechnet. Der Wert steht in der DB
und taucht später wieder auf.

## 3. Umfang

### Migration `supabase/migrations/20260716<HHMMSS>_platform_feedback.sql`

Ein Kopf-Kommentar mit Entscheidung, Begründung und verworfener Alternative (Repo-Konvention).

1. `alter table public.feedback add column likes/misses/idea/route text` — alle nullable.
   Tabellen-Grants bestehen bereits (`20260715140000_explicit_grants.sql`) und gelten
   tabellenweit; neue Spalten sind abgedeckt.
2. `create or replace function public.is_admin()` + `grant execute … to authenticated`.
3. `create policy feedback_admin_read on public.feedback for select to authenticated
   using (public.is_admin())` — ergänzt `feedback_own`, ersetzt es nicht.
4. `recompute_potential_score()` += `and ref_type is not null`.

### Frontend

| Datei | Zweck |
|---|---|
| `src/lib/feedback.ts` | `submitPlatformFeedback({ rating, likes, misses, idea, route })` — ein Insert. Fehler werden durchgereicht, nicht geschluckt. |
| `src/components/feedback/FeedbackButton.tsx` | Button + Dialog. ⭐-Auswahl, drei Textfelder im Wortlaut des Specs. Route aus `useLocation().pathname`. |
| `src/components/AppShell.tsx` | Einbau, nur wenn `user` gesetzt. |

**Validierung:** Sterne Pflicht (ohne sie Absenden deaktiviert), Texte optional — sonst
entstehen Zeilen ohne jede Aussage.

## 4. Wie es belegt wird

Jede Zusage bekommt eine Assertion, die ohne den Diff fehlschlägt:

- **`supabase/tests/rls_test.sql`** — ein `admin` liest fremdes Feedback; ein gewöhnliches
  Mitglied **und** ein `matching_manager` nicht. Der sicherheitskritische Teil.
  *Fallen (aus früheren Sessions):* pgTAP kennt kein `like()` → `alike()` verwenden;
  `try_as()` meldet jeden Fehler als DENIED, also den echten Fehler separat sichtbar machen.
- **`supabase/tests/probe_potential_score.sql`** — Plattform-Feedback (`ref_type is null`,
  `rating` gesetzt) bewegt den Score **nicht**. Muss vor dem Score-Fix fehlschlagen und
  danach halten; das ist der Beleg für §2.5.
- **`src/lib/feedback.test.ts`** — der Insert trägt die richtigen Felder, `route` wird gesetzt.
- **Komponententest** — Absenden ohne Sterne ist gesperrt; ein Fehler des Inserts erscheint
  im Dialog statt zu verschwinden.

Kein `vi.mock` auf eigene Komponenten, keine Assertions gegen Namen statt Verhalten.

CI führt `grants_test.sql` und `rls_test.sql` über `supabase test db` aus (`.github/workflows/ci.yml`).

## 5. Bewusst nicht

| Weggelassen | Warum |
|---|---|
| Screenshot-Upload | Spec §3.5 nennt ihn „optional"; bräuchte Storage-Bucket, Bucket-Policies, Größenlimit, Upload-UI. Die Route liefert den Kontext größtenteils schon. |
| Anonymes Feedback | `feedback.profile_id` ist `not null references profiles`. Bräuchte nullable FK + anon-Insert-Policy + Rate-Limiting auf einer öffentlichen Live-Instanz. |
| Automatisches Linear-Issue je Feedback | Spec §3.5: „MVP = nur speichern". |
| Admin-UI zum Lesen | §3.5 verlangt „für Admin sichtbar" — die Policy leistet das. Eine Oberfläche steht nicht im Spec. |

## 6. Offen

- **Wer ist `admin`?** `staff_roles` wird out of band provisioniert (service_role / SQL).
  Ob für das Sommerfest ein `admin` eingetragen ist, ist ungeprüft — ohne einen solchen
  Eintrag greift `feedback_admin_read` ins Leere. Vor der Präsentation zu klären.
