## Why

`drift-gate` vergleicht die Migrationshistorie des Repos fest verdrahtet gegen das
PROD-Projekt — aber der ausgelieferte Build spricht das DEV-Projekt an, weil
`prod` in Infisical bis zum Mitglieder-Import bewusst dorthin zeigt. Das Gate
misst damit eine Datenbank, die kein Nutzer anfasst, und hält währenddessen genau
das Frontend zurück, das zur tatsächlich gelesenen Datenbank passt.

Nach dem Merge von C9 (AGE-533) standen deshalb rund drei Stunden lang neun leere
Karten im Live-Feed: `migrate-dev` legte die Event-Beiträge in DEV an, `drift-gate`
fand Abweichung gegen PROD, und der Deploy des Frontends, das diesen Kartentyp
kennt, unterblieb. Linear: **AGE-536**.

## What Changes

- `drift-gate` löst sein Ziel aus derselben Quelle auf wie der Build — dem
  `VITE_SUPABASE_URL` der Infisical-Umgebung, mit der `deploy` baut — statt
  `SUPABASE_DB_URL_PROD` fest zu verdrahten. Kein Treffer gegen eine der beiden
  versionierten Ref-Dateien heißt rot.
- `drift-gate` wartet auf `migrate-dev` (`needs`), weil es das Live-Projekt sonst
  vor dessen Migration misst und an der eigenen Reihenfolge scheitert.
- Der Migrationsstand des jeweils **anderen** Projekts wird weiterhin gemessen,
  aber nur berichtet, nicht blockiert — Ersatz für die Frühwarnung, die durch die
  Umstellung des Ziels entfällt.
- Jeder Lauf nennt das gemessene Projekt im Protokoll, auch der unauffällige.

Keine **BREAKING**-Änderung: sobald `prod` nach dem Umzug wieder auf das
PROD-Projekt zeigt, ergibt dieselbe Regel dasselbe Ziel wie heute die feste
Verdrahtung.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `deployment-environments`: Die Anforderung „Migrationen erreichen DEV
  automatisch und PROD nur bewusst" bestimmt das Vergleichsziel des Gates
  derzeit als „das PROD-Projekt". Sie widerspricht damit sowohl der Anforderung
  „Bis zum Import trägt allein DEV die Rolle beider Umgebungen" als auch ihrem
  eigenen Szenario, das den Abbruch damit begründet, keine Oberfläche live zu
  stellen, *deren Datenbank sie nicht trägt*. Das Ziel wird zu „dem Projekt, das
  der ausgelieferte Build anspricht"; dazu kommen die Reihenfolge gegenüber dem
  automatischen DEV-Lauf und der nicht-blockierende Bericht über das andere
  Projekt.

## Impact

- `.github/workflows/deploy.yml` — Job `drift-gate`: Zielauflösung, `needs`,
  Infisical-Installation, Protokollzeile, zweite nicht-blockierende Messung.
- `scripts/` — ein neues reines Logikmodul für die Zielauflösung samt Test,
  nach der Hausform `*.logic.ts` neben `*.test.ts`.
- `scripts/migration-drift-gate.ts` bleibt **unverändert**: es nimmt die Ziel-URL
  bereits als `argv[2]`.
- Keine Änderung an `migrate-prod.yml`, an Migrationen, am Frontend oder an
  Secrets. Beide Verbindungen liegen bereits als Secrets vor.
- Ohne Wirkung auf den Umzug auf das PROD-Projekt; der bleibt ein eigenes
  Vorhaben und wird von dieser Änderung weder vorweggenommen noch verbaut.
