# ADR-0004: Zwei Supabase-Projekte — neues PROD, das bestehende wird DEV/DEMO

**Status**: Accepted  **Date**: 2026-08-05  **Linear**: AGE-496 (schließt AGE-257 mit)

Löst den Zustand ab, den ADR-0003 unter „dev == prod" als gegeben hinnehmen
musste.

## Context

Bis heute zeigten Infisical `dev` und `prod` auf **dasselbe** Supabase-Projekt
`foelowldexkcqzewvrcf` — identische URL, identischer Anon-Key, byte-gleiches
DB-Passwort (`sha256 b8e8809f5c6f73c9`). Der einzige Unterschied war
`VITE_ENVIRONMENT`.

Das hatte zwei Folgen, die mit echten Mitgliedern ab dem 17.08. nicht tragbar
sind:

1. **Jeder lokale Schreibzugriff traf die Produktivdatenbank.** ADR-0003 musste
   den Demo-Seed deshalb über eine Persona-Heuristik absichern statt über die
   Umgebung — ein Wächter, der „prod" am Projekt-Ref erkennt, konnte nicht
   funktionieren, weil es nur einen gab.
2. **Migrationen liefen von Hand.** Die Havarie vom 14.06.
   (`docs/w2-acceptance.md` §8/R1) war kein vergessener Handgriff: Code gemergt,
   Issues auf Done, CI grün, Frontend deployed — und drei Migrationen fehlten in
   prod, wodurch drei Features live kaputt waren. **Jede Anzeige stand auf
   grün.** AGE-257 blieb seither offen.

## Decision

**Ein neues Projekt `fbc-platform-prod` (`viwntbodrtqxgmqyxluh`,
`eu-central-1`, Org `factiv`) wird die Produktivumgebung. Das bestehende
Projekt wird DEV/DEMO.**

Getrennte DB-Zugangsdaten, getrennte Auth-Konfiguration, getrennte Function-
Secrets. Dazu vier Zusagen, die die Trennung erst tragfähig machen:

- **`supabase/config.toml` beschreibt ab jetzt PROD, nicht beide.** DEV behält
  seine Dashboard-Konfiguration. Eine gemeinsame Datei ginge nicht: PROD darf
  keine Loopback-Adresse in der Redirect-Allow-List tragen, DEV braucht sie für
  `pnpm dev`.
- **Schreibende Befehle bestimmen ihr Ziel explizit** (`--db-url`,
  `--project-ref`), nie über `supabase link`. Die Prüfung ist zweistufig:
  maschinell gegen `scripts/prod-project-ref.txt`, dann durch den Menschen.
- **AGE-257, Variante C:** `migrate-dev` automatisch auf `main`, `drift-gate`
  vor jedem Deploy, `migrate-prod` nur von Hand.
- **Der Umzug des Frontends passiert nicht hier.** `VITE_SUPABASE_URL` in
  Infisical `prod` zeigt weiterhin auf das alte Projekt; PROD ist vollständig
  aufgesetzt, aber unbenutzt, bis die Go-Live-Woche zwei Werte umstellt.

## Alternatives Rejected

**Nur ein Drift-Gate, kein Auto-Apply** (jede Migration bleibt zweimal
Handarbeit). Fängt den Juni-Fall vollständig und ist der kleinste Eingriff —
aber die Reihenfolge DEV-vor-PROD bliebe Konvention, und der blockierte Deploy
käme als Überraschung genau dann, wenn man deployen wollte.

**Auto-Apply auf `main` gegen PROD.** Drift würde strukturell unmöglich. Der
Einwand ist kein Bauchgefühl, sondern ein Prüflücken-Nachweis: `ci.yml` belegt
mit `supabase db reset` nur, dass eine Migration auf eine **leere** Datenbank
passt. Ein `not null` auf einer gefüllten Tabelle, ein Unique-Index auf Daten
mit Dubletten — das ist in CI grün und scheitert erst an Daten. Und ein
DDL-Rollback ist kein `git revert`.

**`env()`-Substitution in `config.toml`**, eine Datei für beide Projekte. Die
CLI unterstützt es, aber der gefährliche Wert (die Redirect-Allow-List) wäre
dann unsichtbar — man liest die Datei und weiß nicht, was auf PROD steht.

## Consequences

- **Kein Break-Glass am Drift-Gate.** Sobald ein Merge eine Migration enthält,
  blockiert es **jeden** Frontend-Deploy, bis `migrate-prod` gelaufen ist — auch
  einen eiligen, unabhängigen Fix. Gewollt: eine Zusage, die man im Eilfall
  umgehen darf, ist im Eilfall keine.
- **Was DEV nicht mehr fängt.** DEV trägt Demo-Personas. Alles, was an der
  *Beschaffenheit* echter Daten hängt — Dubletten unter einem neuen
  Unique-Index, gewachsene Altwerte —, sieht es nie. Der `--dry-run` von
  `migrate-prod` wird deshalb gelesen, nicht durchgeklickt.
- **Zwei Objekte wandern nicht mit `db push`:**
  `notify_contact_request_webhook()` und der Trigger
  `contact_requests_email_webhook`. Sie stehen bewusst in keiner Migration — der
  Bearer-Token liegt inline und das Repo ist öffentlich. `scripts/db-drift-scan.ts`
  meldet, wenn sie **fehlen**; ohne das stürbe der Mailversand still.
- **`config push` überträgt die ganze Datei, nicht die Absicht.** Am leeren
  PROD-Projekt gemessen: geplant waren fünf Felder, bewegt haben sich zehn.
  Jeder CLI-Vorgabewert in `config.toml` ist damit eine Aussage über PROD.
- **Die Auth-Mail-Rate lässt sich nicht erhöhen.**
  `rate_limit_email_sent` bleibt bei 2 pro Stunde, projektweit, solange kein
  eigener SMTP konfiguriert ist (`HTTP 401 Custom SMTP required`). Bis Resend
  in C3 kommt, ist „Passwort vergessen" kein verlässlicher Weg.
- **ADR-0003s Persona-Heuristik bleibt vorerst.** Sobald `prod` tatsächlich auf
  das neue Projekt zeigt, könnte der Demo-Seed am Projekt-Ref erkennen, wo er
  läuft. Das ist ein eigener Change, kein Nebeneffekt dieses.

## Verweise

- Runbook: `docs/supabase-environments.md`
- Change: `openspec/changes/split-prod-dev-supabase/`
- Abgelöst: [ADR-0003](0003-demo-seed.md) (nur die „dev == prod"-Prämisse)
