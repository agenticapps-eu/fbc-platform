# Mitgliedsstufen zum Testen umstellen (Prototyp)

Das Frontend bietet **bewusst keine** Selbst-Upgrades der Mitgliedsstufe an.
`profiles.tier` ist client-seitig nicht beschreibbar — die Spalte wird ausschließlich
vom Signup-Trigger (`handle_new_user`, immer `discover`) gesetzt und darf nur per
`service_role`/Admin geändert werden (siehe RLS in `docs/rls-policies.md`).

Zum Testen des Stufen-Gatings (Discover → Prime → Legacy) wird die Stufe daher
**außerhalb des Clients** gesetzt: im Supabase **SQL Editor** (Studio) oder via CLI
gegen die DB. Beides läuft mit erhöhten Rechten und umgeht den Client.

| E-Mail | Stufe (Ziel) |
| --- | --- |
| `discover@fbcdemo.com` | `discover` (Default nach Signup) |
| `prime@fbcdemo.com` | `prime` |
| `legacy@fbcdemo.com` | `legacy` |

## Test-Accounts anlegen

> ⚠️ **GoTrue erzwingt E-Mail-Validierung.** Der `/signup`-Endpoint lehnt unzustellbare
> Domains ab (`email_address_invalid`, u. a. reservierte TLDs wie `.test` und Domains
> ohne MX-Record). Für Test-Accounts mit Fantasie-Domains funktioniert die Registrierung
> über das App-Formular daher **nicht** — die drei Accounts werden im **SQL Editor**
> (Studio, service_role) direkt angelegt. Das passt zum Prinzip „keine Self-Service-
> Anlage im Client". Mit einer echten, zustellbaren Domain funktioniert das App-Formular
> regulär (ggf. „Confirm email" unter _Authentication → Sign In / Providers → Email_
> deaktivieren, damit ohne Bestätigungsmail eine Session entsteht).

### Anlegen + Stufen setzen (Supabase Studio → SQL Editor)

```sql
-- Drei bestätigte Test-Accounts direkt anlegen.
-- Das Passwort steht NICHT mehr in diesem Repository: es liegt als
-- DEMO_LOGIN_PASSWORD_DEV in Infisical (--env=prod) und wird unten eingesetzt.
-- Vor dem Ausführen im SQL-Editor :passwort durch den Wert ersetzen.
-- Der Trigger handle_new_user legt automatisch ein profiles-Row mit tier='discover' an.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data, confirmation_token,
   recovery_token, email_change_token_new, email_change)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
  'authenticated', 'authenticated', e.email,
  extensions.crypt(:'passwort', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''
from (values ('discover@fbcdemo.com'), ('prime@fbcdemo.com'), ('legacy@fbcdemo.com')) as e(email)
on conflict do nothing;

-- Stufen setzen. Gültige Werte: 'discover' | 'prime' | 'legacy'
-- (allgemein: jeder membership_tiers.key).
update public.profiles p set tier = 'prime'
  from auth.users u where u.id = p.id and u.email = 'prime@fbcdemo.com';
update public.profiles p set tier = 'legacy'
  from auth.users u where u.id = p.id and u.email = 'legacy@fbcdemo.com';
```

Eine Stufe später ändern: nur den `update`-Teil oben mit der gewünschten E-Mail/Stufe
ausführen. Danach in der App **neu laden** (oder aus-/einloggen) — der `AuthProvider`
lädt `tier` + `level_rank` beim Session-Start.

## Verifizieren

```sql
-- Stufe + level_rank je Test-Account prüfen.
select u.email, p.tier, t.level_rank
from public.profiles p
join auth.users u on u.id = p.id
join public.membership_tiers t on t.key = p.tier
where u.email in ('discover@fbcdemo.com', 'prime@fbcdemo.com', 'legacy@fbcdemo.com')
order by t.level_rank;
```

Erwartung im Frontend nach dem Setzen:

- **discover** (`level_rank 1`): `/verzeichnis` und `/matching` leiten auf `/` (Feed) um.
- **prime** (`level_rank 5`) und **legacy** (`level_rank 7`): `/verzeichnis` und `/matching`
  sind erreichbar.
- **nicht eingeloggt**: gatete Routen leiten auf `/login`; `/mein-bereich` ebenfalls.
