# Design — Admin liest QM-Feedback (Seed + Sicht)

**Repo:** `fbc-platform` · **Datum:** 2026-07-16
**Baut auf:** AGE-300 (QM-Feedback, PR #71) — `is_admin()`, `feedback_admin_read`, die vier
Feedback-Spalten stammen von dort. Dieser Branch zweigt von `donald/age-300-…` ab.
**Status:** entschieden mit Donald am 16.07.2026

---

## 1. Was gebaut wird

Zwei zusammengehörige Stücke, damit die `feedback_admin_read`-Policy aus AGE-300 endlich
einen Nutzer und eine Oberfläche bekommt:

- **Teil A — Admin-Seed:** eine manuell auszuführende SQL-Datei, die benannte Personen
  (Detlev, Donald) per E-Mail-Lookup zu `admin` in `staff_roles` macht.
- **Teil B — Admin-Feedback-Sicht:** ein nur für Admins sichtbarer Abschnitt in
  `/einstellungen`, der das QM-Feedback samt Autor listet, gespeist aus einer
  SECURITY-DEFINER-RPC.

## 2. Entscheidungen

### 2.1 Seed weist Rollen zu, legt keine Accounts an

`staff_roles.profile_id` → `profiles.id` → `auth.users.id`. Detlev und Donald sind echte
Betreiber, keine Demo-Personas; ihre Admin-Rechte sind Produktionsrechte, und das Repo ist
**öffentlich**.

**Entschieden:** Die Seed weist nur die Rolle zu (`insert … select id from auth.users where
email in (…)`). Detlev/Donald registrieren sich normal — ihr Passwort setzen sie selbst, es
liegt nie im Repo. Die Seed wirkt erst, wenn der Account existiert; vorher ist sie ein No-op.

*Verworfen — Accounts + Passwort anlegen:* ein festes Passwort im öffentlichen Repo ist ein
Secret-Leak (CLAUDE.md verbietet es), und für echte Betreiber-Accounts ohnehin untragbar.

### 2.2 Eigene Datei, manuell auszuführen — keine E-Mails im Repo

`supabase/seed/admin_roles.sql`, bewusst von einem Menschen im SQL-Editor / per psql zu
fahren. Trennt Betriebskonfiguration (wer ist Admin) von Demo-Daten, läuft nie automatisch
(kein versehentlicher Prod-Treffer). Entspricht ADR-0002: „staff_roles wird out of band
provisioniert".

Die echten E-Mails stehen **nicht** im Repo — die Datei nutzt psql-`\set`-Platzhalter, die
der Ausführende mit den echten Adressen belegt. Keine Personendaten im öffentlichen Repo.

*Verworfen — config.toml `seed.sql`:* liefe lokal bei jedem `db reset`, aber lokal existieren
die Accounts nicht (No-op), und Prod bräuchte trotzdem einen manuellen Lauf.
*Verworfen — in `demo_seed.ts`:* Admins sind keine Demo-Daten; der Reset-Modus dürfte sie
nicht mitlöschen. Vermischung von Betriebskonfig und Personas.

### 2.3 SECURITY-DEFINER-RPC statt direktem Join (weil der Autor gezeigt wird)

Die Sicht zeigt den **Autor-Namen**. Der kommt aus `profiles`, und dort gilt eine eigene
RLS: `profiles_public` filtert `where is_public`, die Tabellen-Policy heißt
`profiles_select_self_or_prime`. Ein direkter Join `feedback → profiles(name)` unter der
Admin-Identität zeigte bei nicht-öffentlichen oder niedrigstufigen Autoren einen **leeren
Namen** — „Autor anzeigen" wäre unzuverlässig.

**Entschieden:** eine RPC `public.admin_list_feedback()` — SECURITY DEFINER, `search_path =
''`. Sie gibt die Feedback-Zeilen mit Autor-Namen (Join auf `profiles`, mit Owner-Rechten,
RLS umgangen) neueste zuerst zurück, **aber nur wenn `public.is_admin()`** — sonst leer. Wie
`is_matching_manager`/`list_routing_queue` gesperrt: `revoke execute from public, anon` +
`grant execute to authenticated`. Das ist das etablierte Repo-Muster für kontrollierte
Cross-RLS-Reads.

*Verworfen — direkter Select + `profiles_public`-Join:* zeigte manche Autoren namenlos.
*Verworfen — profiles-RLS um einen Admin-Sonderfall erweitern:* größerer Eingriff in die
zentrale Sicherheitsgrenze für einen Nebenzweck.

### 2.4 Gating auf `staffRole === 'admin'`, nicht `matching_manager`

`feedback_admin_read` und `admin_list_feedback()` sind eng auf `admin`. Die Card wird nur
gerendert, wenn `useAuth().staffRole === 'admin'`. UI-Gating ist Komfort; die RLS/RPC ist die
echte Grenze (ein `matching_manager`, der die RPC direkt aufruft, bekommt leer).

## 3. Umfang

### Teil A — `supabase/seed/admin_roles.sql`

```sql
-- Admin-/Staff-Provisionierung (out of band, ADR-0002). MANUELL ausführen:
--   psql "$DB_URL" -v admin_1=… -v admin_2=… -f supabase/seed/admin_roles.sql
-- oder im SQL-Editor die \set-Zeilen mit den echten E-Mails füllen.
--
-- Weist nur ROLLEN zu, legt KEINE Accounts an: die Person registriert sich normal
-- (Passwort nie im Repo), diese Datei hebt sie zu admin. Wirkt erst, wenn der
-- Account existiert — vorher ein No-op. Idempotent.
\set admin_1 'DETLEV_EMAIL_HIER'
\set admin_2 'DONALD_EMAIL_HIER'

insert into public.staff_roles (profile_id, role)
select u.id, 'admin'
  from auth.users u
 where u.email in (:'admin_1', :'admin_2')
on conflict (profile_id) do update set role = 'admin';
```

Ein optionaler, auskommentierter `matching_manager`-Block dokumentiert, wie ein Deal-Manager
provisioniert wird (bisher nirgends geseedet). Kopf-Kommentar nennt ADR-0002.

### Teil B — Migration `supabase/migrations/20260716<HHMMSS>_admin_feedback_rpc.sql`

RPC `public.admin_list_feedback()`:
- `returns table(id uuid, rating int, likes text, misses text, idea text, route text,
  ref_type text, created_at timestamptz, author_name text)`
- `language sql`, `stable`, `security definer`, `set search_path = ''`.
- Body: `select f.…, coalesce(p.name, '—') from public.feedback f left join public.profiles p
  on p.id = f.profile_id where public.is_admin() order by f.created_at desc`.
  Der `where public.is_admin()`-Filter macht die Funktion für Nicht-Admins leer.
- `revoke execute … from public, anon;` + `grant execute … to authenticated;`
- Kopf-Kommentar mit Begründung (warum DEFINER, warum der is_admin-Filter).

### Frontend

| Datei | Änderung |
|---|---|
| `src/lib/feedback.ts` | `+ fetchAdminFeedback(): Promise<AdminFeedbackRow[]>` — ruft `supabase.rpc('admin_list_feedback')`, Fehler werfen. |
| `src/pages/EinstellungenPage.tsx` | Neue `<Card>` „QM-Feedback", nur wenn `staffRole === 'admin'`. Lädt via TanStack Query, listet je Zeile Sterne, die drei Texte, Route, Datum, Autor. Read-only. Leerzustand („Noch kein Feedback"). |

## 4. Wie es belegt wird

- **`supabase/tests/rls_test.sql`** (oder eine neue pgTAP-Datei, falls sauberer): `admin`
  bekommt aus `admin_list_feedback()` beide Fremdzeilen **mit** Autor-Namen; ein
  `matching_manager` und ein gewöhnliches Mitglied bekommen **0 Zeilen**; `anon` darf die
  Funktion nicht ausführen (`has_function_privilege` = false). `plan()` entsprechend erhöhen.
- **`src/lib/feedback.test.ts`** += `fetchAdminFeedback` ruft `rpc('admin_list_feedback')`,
  reicht Fehler durch.
- **`src/pages/EinstellungenPage.test.tsx`** += Card erscheint für `staffRole:'admin'`,
  **nicht** für `staffRole:null` und **nicht** für `staffRole:'matching_manager'`.

Kein `vi.mock` auf eigene Komponenten; die Datenschicht (`../lib/feedback`) zu mocken ist ok.

## 5. Bewusst nicht

| Weggelassen | Warum |
|---|---|
| Feedback löschen/verwalten in der UI | Die Sicht ist read-only (§3.5-Geist: einsammeln). Löschen wäre neuer Scope. |
| Filtern/Sortieren/Blättern | MVP zeigt die Liste, neueste zuerst. Bei Bedarf später. |
| Aktionsgebundenes Feedback getrennt darstellen | Die RPC liefert alle Zeilen; `ref_type` steht dabei, eine Trennung ist vorerst unnötig. |
| Anonymitätsschutz | Bewusste Entscheidung: der Autor wird gezeigt (fürs Nachfassen). Das Modul verspricht keine Anonymität. |

## 6. Git-Topologie

Branch zweigt von `donald/age-300-…` ab (braucht `is_admin()` + die Feedback-Spalten). Der
PR wird **gestapelt** gegen den AGE-300-Branch gestellt; GitHub richtet ihn nach dem Merge
von #71 automatisch auf `main` um. Eigenes Linear-Issue.
