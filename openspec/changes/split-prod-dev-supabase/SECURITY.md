# SECURITY — Sicherheitsvermerk zu AGE-496 (C4: Supabase-Trennung)

**Datum:** 2026-08-05 · **Modus:** `/cso`, auf den Branch-Diff bezogen (35 Dateien,
+3.770/−83) · **Ergänzt** `DB-AUDIT.md` (Datenschicht), das hier Eingabe ist und
nicht wiederholt wird.

**Ergebnis: keine Critical. Zwei mittlere Befunde**, einer davon durch diesen
Change selbst entstanden.

---

## Was der Change an Angriffsfläche verändert

|                          | vorher                         | nachher                                                          |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------- |
| Supabase-Projekte        | 1 (geteilt)                    | 2 (getrennte DB-Zugangsdaten)                                    |
| Schreibpfade auf PROD-DB | `pnpm db:push` (Link-abhängig) | `pnpm db:push:prod` (2-stufig geprüft) + `migrate-prod`-Workflow |
| GitHub-Secrets           | 2                              | 4 (`SUPABASE_DB_URL_DEV`/`_PROD` neu)                            |
| Workflows mit DB-Zugriff | 0                              | 3 Jobs + 1 eigener Workflow                                      |
| Function-Secret-Speicher | 1 Projekt                      | 2 Projekte, **13 von 15 Werten identisch**                       |

---

## Was hält

- **Kein Geheimnis im Diff.** Kein `AKIA`, `sk_live_`, `ghp_`, `xoxb-`, `re_…`,
  kein JWT. Die `postgres://`-Treffer sind sämtlich Platzhalter (`pw`, `<pwd>`,
  `…`) in Doku und Testkonstanten.
- **Kein `.env` von git verfolgt**, `.env` ist in `.gitignore`.
- **Kein `pull_request_target`**, keine Script-Injection: nirgends steht
  `${{ github.event.* }}` in einem `run:`-Block.
- **Der Branch-Name geht über `env:` und wird gequotet** (`CF_BRANCH`) — das ist
  das sichere Muster für einen angreiferkontrollierten Wert, und es steht im
  Workflow auch so kommentiert.
- **Alle Secrets laufen über `secrets.*`**, keine Inline-Zugangsdaten in YAML.
- **`permissions:` sind minimal.** `migrate-prod` bekommt `contents: read` +
  `actions: read`, mehr nicht.
- **Die Drittanbieter-Actions sind SHA-gepinnt** (`supabase/setup-cli`,
  `pnpm/action-setup`).
- **Die Push-Skripte lassen sich nicht überreden.** `--include-seed` wird
  abgewiesen, `supabase link` nie aufgerufen, und Stufe 1 bricht bei falschem
  Ziel ab, bevor irgendetwas ausgegeben wird — belegt mit Live-Werten.
- **Die Verbindungs-URL wird nie geloggt.** `push-prod.ts` maskiert sie in der
  Befehlsausgabe (`--db-url ***`).

---

## Befund 1 — Die Trennung gilt für die Datenbank, nicht für die Function-Secrets

**MITTEL** · Vertrauen 9/10 · VERIFIED · Kategorie: Secrets-Verteilung
**Durch diesen Change entstanden.**

Gemessen (Digest-Vergleich, keine Werte ausgegeben): von 15 selbst gesetzten
Edge-Function-Secrets sind **13 auf beiden Projekten byte-identisch**. Nur
`APP_URL` und `APP_URLS` unterscheiden sich — die habe ich bewusst auf die
PROD-Adresse gesetzt.

Identisch sind unter anderem `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`RESEND_API_KEY` und `CONTACT_WEBHOOK_SECRET`.

Der Change verspricht „getrennte Zugangsdaten, nie geteilt" — und löst das für
die **Datenbank**. Für die Functions habe ich die Werte aus Infisical `dev`
kopiert, weil sie dort liegen. Das ist die bequeme Variante, nicht die
zugesagte.

**Konkreter Angriffsweg** (`CONTACT_WEBHOOK_SECRET`):

1. Jemand mit Zugriff auf das DEV-Projekt liest den Bearer — er steht **inline
   im Rumpf** von `notify_contact_request_webhook()` und damit in jedem
   Schema-Dump von DEV. Alternativ: Infisical `dev` oder DEVs Function-Secrets.
2. `notify-contact-request` läuft mit `verify_jwt = false` und prüft **nur**
   diesen Bearer.
3. `POST` gegen die **PROD**-Function mit selbst gebautem Payload →
   die Function verschickt eine FBC-gebrandete Mail über Resend.

**Was den Schaden begrenzt** (nachgelesen, nicht angenommen): die
Empfängeradresse kommt **nicht** aus dem Payload, sondern per Service-Role aus
dem RLS-geschützten `profile_contacts`. Umlenken auf eine beliebige Adresse geht
also nicht.

**Was bleibt:** der **Nachrichtentext** kommt aus dem Payload
(`decision.request.message`). Es lassen sich also FBC-gebrandete Mails mit
frei gewähltem Inhalt an echte Mitglieder schicken. Das ist ein Phishing-Weg in
die Postfächer der Mitglieder, ab 17.08. an ~70 echte Adressen.

`STRIPE_SECRET_KEY` ist heute **Test-Mode** — der Radius ist dort klein. **Er
wird groß, sobald in der Go-Live-Woche ein Live-Key gesetzt wird**, denn dann
läge derselbe Live-Key auch auf DEV.

**Empfehlung — eigenes `CONTACT_WEBHOOK_SECRET` für PROD.** Zwei Stellen, beide
im Runbook beschreibbar:

```bash
# 1. neuen Wert erzeugen und auf PROD setzen (nie ins Repo, nie in die History)
openssl rand -hex 32 > /tmp/whs && chmod 600 /tmp/whs
supabase secrets set "CONTACT_WEBHOOK_SECRET=$(cat /tmp/whs)" --project-ref viwntbodrtqxgmqyxluh
# 2. denselben Wert in den Trigger auf PROD (Vorlage: docs/secrets.md), dann
rm -f /tmp/whs
```

Danach `scripts/db-drift-scan.ts` gegen PROD — er muss weiter leer melden.

**Für die Go-Live-Woche in die Checkliste:** Stripe-Live-Keys **nur** auf PROD
setzen, nicht aus `dev` kopieren.

---

## Befund 2 — Auf produktives DDL wirkt nur noch ein Handgriff

**MITTEL** · Vertrauen 8/10 · VERIFIED · Kategorie: CI/CD
**Folge einer bewussten Entscheidung, hier nur benannt.**

`migrate-prod.yml` kann Schema-Änderungen auf die Produktivdatenbank anwenden.
Zwei Kontrollen waren dafür vorgesehen; von beiden ist heute keine wirksam:

- **Environment-Freigabe:** zurückgestellt am 2026-08-05 (Donald ist der
  einzige Entwickler). `apply` startet direkt hinter `plan` — der Dry-Run steht
  im Log, aber niemand muss ihn gelesen haben.
- **CODEOWNERS:** existiert im Repo **nicht**. Wer `main` schreiben darf, darf
  auch `migrate-prod.yml` ändern.

Was bleibt: der Workflow läuft nur per `workflow_dispatch`, und `plan` bricht
ab, wenn für denselben Commit kein erfolgreicher `migrate-dev`-Lauf vorliegt.
Beides ist echt und trägt — aber es ist **eine** Kontrolle, kein zweites Paar
Augen.

Bei einem Entwickler ist das vertretbar. **Es hört auf, vertretbar zu sein, in
dem Moment, in dem ein Zweiter Schreibrechte auf `main` bekommt** — dann ist es
nicht „eine Regel nachziehen", sondern eine offene Tür. Der Befehl steht in
`docs/supabase-environments.md`; eine `CODEOWNERS`-Datei für
`.github/workflows/` gehört dann daneben.

---

## Nachrangig

- **Erstanbieter-Actions nicht SHA-gepinnt** (NIEDRIG, 13 Stellen). Betrifft
  `actions/checkout@v7`, `actions/setup-node@v7`, `actions/github-script@v9`.
  **Bestand, nicht durch diesen Change entstanden** — `ci.yml` macht es seit
  Juni genauso. Die Drittanbieter-Actions _sind_ gepinnt, die Haltung ist also
  bewusst und vertretbar.
- **TLS-Prüfung im Objekt-Drift-Scan abgeschaltet** (NIEDRIG). Der Pooler zeigt
  eine selbstsignierte Kette; die projekt-eigene CA gibt es nur über das
  Dashboard. Steht sichtbar als `DB_SCAN_TLS_INSECURE: "1"` im Workflow, mit
  Begründung — nicht in einer Vorgabe versteckt. Schließen mit
  `DB_SCAN_CA_CERT`, sobald die CA vorliegt.
- **Der Webhook-Bearer liegt inline im Funktionsrumpf** auf beiden Projekten.
  Bekannt und begründet (deshalb steht das Paar in keiner Migration), aber es
  heißt: **jeder Schema-Dump enthält ihn**. Die Dumps unter `~/Backups/` tragen
  0600 und liegen außerhalb des Repos — geprüft.

## Aus `DB-AUDIT.md` übernommen

Keine Critical, keine High auf der Datenschicht. Ein MITTEL-Befund
(Verzeichnis-Sichtbarkeit für frisch registrierte Konten) ist bewusst auf **C3**
vertagt, mit Prüfauftrag. Details dort.

---

## Status

**DONE_WITH_CONCERNS.** Befund 1 stammt aus diesem Change und sollte vor dem
17.08. geschlossen werden — es ist ein `openssl rand` und zwei Handgriffe.
Befund 2 ist eine bewusste Entscheidung; er braucht keine Handlung, solange
Donald allein schreibt, aber er gehört auf den Zettel für den Tag, an dem das
nicht mehr stimmt.

---

_Dieser Vermerk ist kein Ersatz für ein professionelles Sicherheitsaudit.
`/cso` ist ein KI-gestützter Durchlauf, der verbreitete Schwachstellenmuster
findet — er ist weder vollständig noch garantiert. Für ein System, das ab dem
17.08. personenbezogene Daten von ~70 Mitgliedern hält, ist ein
Penetrationstest durch eine qualifizierte Firma die richtige Ergänzung, nicht
die Alternative._
