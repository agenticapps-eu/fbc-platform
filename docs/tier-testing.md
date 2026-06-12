# Mitgliedsstufen zum Testen umstellen (Prototyp)

Das Frontend bietet **bewusst keine** Selbst-Upgrades der Mitgliedsstufe an.
`profiles.tier` ist client-seitig nicht beschreibbar — die Spalte wird ausschließlich
vom Signup-Trigger (`handle_new_user`, immer `discover`) gesetzt und darf nur per
`service_role`/Admin geändert werden (siehe RLS in `docs/rls-policies.md`).

Zum Testen des Stufen-Gatings (Discover → Prime → Legacy) wird die Stufe daher
**außerhalb des Clients** gesetzt: im Supabase **SQL Editor** (Studio) oder via CLI
gegen die DB. Beides läuft mit erhöhten Rechten und umgeht den Client.

## Test-Accounts anlegen

Drei Accounts per Login-/Registrierungsseite der App anlegen, z. B.:

| E-Mail | Stufe (Ziel) |
| --- | --- |
| `discover@fbc.test` | `discover` (Default nach Signup) |
| `prime@fbc.test` | `prime` |
| `legacy@fbc.test` | `legacy` |

> Tipp: Ist in Supabase **„Confirm email"** aktiv, lässt sich das für lokales Testen
> unter _Authentication → Providers → Email_ deaktivieren, damit der Login direkt
> ohne Bestätigungsmail funktioniert.

## Stufe setzen (Supabase Studio → SQL Editor)

```sql
-- Eine Stufe per E-Mail setzen. Gültige Werte: 'discover' | 'prime' | 'legacy'
-- (allgemein: jeder membership_tiers.key).
update public.profiles p
set tier = 'prime'
from auth.users u
where u.id = p.id
  and u.email = 'prime@fbc.test';

update public.profiles p
set tier = 'legacy'
from auth.users u
where u.id = p.id
  and u.email = 'legacy@fbc.test';
```

Nach dem Update in der App **neu laden** (oder aus-/einloggen) — der `AuthProvider`
lädt `tier` + `level_rank` beim Session-Start.

## Verifizieren

```sql
-- Stufe + level_rank je Test-Account prüfen.
select u.email, p.tier, t.level_rank
from public.profiles p
join auth.users u on u.id = p.id
join public.membership_tiers t on t.key = p.tier
where u.email in ('discover@fbc.test', 'prime@fbc.test', 'legacy@fbc.test')
order by t.level_rank;
```

Erwartung im Frontend nach dem Setzen:

- **discover** (`level_rank 1`): `/verzeichnis` und `/matching` leiten auf `/` (Feed) um.
- **prime** (`level_rank 5`) und **legacy** (`level_rank 7`): `/verzeichnis` und `/matching`
  sind erreichbar.
- **nicht eingeloggt**: gatete Routen leiten auf `/login`; `/mein-bereich` ebenfalls.
