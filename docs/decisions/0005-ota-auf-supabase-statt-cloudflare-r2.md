# ADR-0005: Der OTA-Dienst wohnt auf Supabase, nicht auf Cloudflare R2

**Status**: Accepted  **Date**: 2026-08-31  **Linear**: AGE-642

Korrigiert eine Festlegung aus `openspec/changes/capacitor-huelle/design.md` §8,
die auf einer Behauptung stand, die niemand nachgemessen hatte.

## Context

Der Entwurf zur Capacitor-Hülle legte den selbst gehosteten OTA-Dienst auf
**Cloudflare Pages Functions** für die drei Endpunkte und **R2** für die
Bündel-Zips. Die Begründung bestand aus einem Satz:

> „Damit ergibt sich: **Cloudflare Pages Functions** für die drei Endpunkte,
> **R2** für die Bündel-Zips. Beides steht bereits."

Am 31.08. nachgemessen, stimmt der Satz zur Hälfte:

- **Pages steht.** `deploy.yml` fährt
  `wrangler pages deploy ./dist --project-name=fbc-platform`, `wrangler` liegt
  als devDependency im Lockfile, `CLOUDFLARE_API_TOKEN` kommt über Infisical,
  und `functions/` wird automatisch mitgeliefert (`functions/api/log.ts`).
- **R2 steht nicht.** Kein `wrangler.toml` im Repo, keine `r2_buckets`-Bindung,
  kein `R2Bucket`-Typ. Die scheinbaren Treffer auf „R2" sind eine
  **Risiko-Kennung** `R2` in `docs/w2-acceptance.md` und `docs/w3-acceptance.md`
  — Namensgleichheit, keine Infrastruktur.

Damit trug die Wahl kein Argument mehr. Was tatsächlich steht, ist **Supabase
Storage**: vier Buckets (`avatars`, `covers`, `post-media`, `event-covers`),
jeder per Migration angelegt mit `public`, `file_size_limit` und
`allowed_mime_types`; die ersten beiden bereits öffentlich.

Der Anlass zur Nachmessung war eine Rückfrage von Donald: „Wofür brauchen wir
R2? Ist das Storage? Wir haben bisher Supabase Storage genutzt."

## Decision

**Der OTA-Dienst liegt vollständig auf Supabase.**

| Teil | Wo |
| --- | --- |
| Bündel-Zips | Storage-Bucket, per Migration angelegt, `application/zip` |
| Manifest (Fassung, URL, Prüfsumme, Vertragsnummer) | Tabelle, per Migration, mit RLS |
| `updateUrl`, `channelUrl`, `statsUrl` | drei Edge Functions mit `verify_jwt = false` |
| privater Signaturschlüssel | Infisical |
| Veröffentlichungs-Anlass | jeder Deploy auf `main`, im bestehenden `deploy.yml`-Job |
| Fassungsschema | `<Semver aus package.json>+<kurzer SHA>`, z. B. `1.4.0+8fbc49b` |

Die Entscheidung vom 27.08. bleibt unberührt: **„selbst gehostet"** war die Wahl
gegen den bezahlten Ionic-Dienst, nicht die Wahl eines Anbieters. Supabase ist
genauso selbst gehostet wie Cloudflare.

Gründe über „steht schon" hinaus:

1. **Ein Schlüssel weniger.** `SUPABASE_SERVICE_ROLE_KEY` liegt in Infisical
   (`docs/secrets.md:132`), und `deploy.yml` fährt ohnehin alles über
   `infisical run`. Eine Pages Function müsste das Manifest aus Supabase lesen
   und bräuchte dafür einen Schlüssel in einer zweiten Umgebung.
2. **Der unauthentifizierte Endpunkt ist hier eingespielt.** `verify_jwt = false`
   tragen bereits `stripe-webhook`, `send-activation` und
   `notify-contact-request`, jeweils mit ausgeschriebener Begründung in
   `supabase/config.toml`. Ein Gerät hat kein JWT.
3. **Öffentlich ist kein Zugeständnis.** Das Bündel ist byte-gleich mit dem
   `dist/`, das Cloudflare Pages ohnehin dem ganzen Internet ausliefert. Der
   Schutz gegen ein fremdes Bündel kommt aus der **Signatur** (`publicKey` plus
   Prüfsumme), nicht aus der Zugriffskontrolle des Speichers.
4. **Die Größe ist unerheblich.** Gemessen am 31.08.: `dist/` gezippt sind
   **2,71 MB** ohne Sourcemaps, 4,43 MB mit. Die Maps gehen zu Sentry, nicht
   aufs Gerät. Der eine echte Vorteil von R2 — kostenloser Egress — trägt bei
   dieser Größe und dieser Gerätezahl nichts.

## Consequences

**Die stille Falle dieses Wegs:** fehlt der `config.toml`-Block zu einer Edge
Function, gilt `verify_jwt = true`. Das Gateway antwortet dann mit **401, bevor
der Handler läuft** — die Schale sähe einen Fehler, den kein Log der Function
erklärt. Jede der drei Functions braucht ihren Block ausgeschrieben.

**Cloudflare bleibt, wo es ist.** Das Web-Frontend wird weiterhin über Pages
ausgeliefert; `functions/api/log.ts` bleibt unberührt. Diese Entscheidung
verschiebt nur den OTA-Dienst, nicht das Hosting.

**Ein Handgriff entfällt.** Der Entwurf führte „Ein Cloudflare-R2-Bucket" unter
dem, was Donald von Hand bereitstellen muss. Der Bucket entsteht jetzt wie die
vier bestehenden per Migration. Bereitzustellen bleibt allein das
Signaturschlüsselpaar — der private Teil nach Infisical, und dessen Login
braucht ein echtes Terminal.

**Nachgezogen wurden** `openspec/changes/capacitor-huelle/design.md` §8,
`proposal.md` (§8 und die Liste des von Hand Bereitzustellenden) und `tasks.md`
Phase D. Das **Spec-Delta blieb unberührt**: es sagt „Der Aktualisierungsdienst
SHALL **selbst gehostet** sein" und nennt keinen Anbieter. Dass diese Korrektur
keine Zeile Spec kostete, ist der Beleg, dass die Anforderung auf der richtigen
Flughöhe geschrieben war.
