# Prompt für Claude Code — AGE-903 Stufen auf V5 glattziehen

Den Block in eine frische Claude-Code-Sitzung im Repo `fbc-platform` kopieren.

**Vorher von Hand:** nichts. Die zwei Fragen an Detlev (siehe Issue) blockieren
nicht — bis zur Antwort gilt der Standard aus dem Issue.

**Nachtrag 25.09. (Telefonat Detlev):** In der Oberfläche erscheinen nur
DISCOVER · FOCUS · IMPACT — auch im Admin bei „Stufe setzen". ACTIVE, BOOST,
CONNECT gibt es nur technisch. Kein Stripe.

---

```
Lies zuerst AGE-903 über das Linear-MCP. Das Issue trägt Ziel, Fallen und
Abnahme. Es ist die Anforderung, nicht dieser Prompt.

Ziel: die sechs Stufen heißen ACTIVE · BOOST · CONNECT · DISCOVER · FOCUS ·
IMPACT (Ränge 1–6, Jahrespreise 0/75/150/300/600/1200), und der FBC beginnt
mit DISCOVER (Rang 4). Die Navigation bleibt unverändert.

Beginne mit /opsx:propose für einen Change namens `stufen-v5`.

## Vorwissen, das nicht im Issue steht

**Die eigentliche Arbeit ist das Anheben der Schwellen, nicht das Umbenennen.**
Gating läuft über `has_level(rank)` in RLS/RPCs und `minTier` in
`src/config/nav.ts`. Heute gibt es Schwellen bei 1, 2, 3 und 4. Zähl als
Erstes jede Stelle mit `has_level(2)`, `has_level(3)`, `has_level(4)` in der
JEWEILS JÜNGSTEN Definition jeder Funktion/Policy (nicht in alten Migrationen,
die später überschrieben wurden) und liefere mir die Tabelle
„Objekt · heutige Schwelle · neue Schwelle". Erwartung: alles, was heute bei
2 oder 3 liegt, geht auf 4. Was bei 1 liegt (u. a. öffentliche Events für
Eingeloggte, `20260722070000`), bleibt.

Besonders: `20260902150000_verzeichnis_ab_connect` (Liste ab 2, erweiterte
Felder ab 3), `20260902180000_kontaktanfrage_staffelung` (connect→connect,
ab discover alle), `20260826110000_abgestufte_namensaufloesung`,
`20260722070000_event_register_visibility_threshold`. Die Staffelung
„connect darf nur connect anschreiben" entfällt: unter DISCOVER keine
Kontaktanfragen, ab DISCOVER alle. Prüf auch, welchen Wert
`platform_settings.open_contact` auf PROD hat, und sag es mir — nicht ändern.

**Key-Migration mit Zwischenschlüsseln.** `discover` und `connect` gibt es alt
und neu mit anderem Rang. `profiles.tier` ist FK auf `membership_tiers(key)`.
Vorbild für eine Key-Migration: `20260715150000_six_level_model.sql`.

**Bestandsmitglieder sind NICHT rangtreu umzuziehen.** Zähl auf PROD (nur
lesen) die Konten je Stufe und leg mir die Zahlen vor, bevor du die
Zuordnung festschreibst. Vorschlag aus dem Issue: impact→IMPACT,
focus→FOCUS, connect/discover/exchange→DISCOVER, basic→ACTIVE.

**Stripe bleibt ruhend.** `STRIPE_PRICE_*`-Namen in
`create-checkout-session/checkout.ts` nur so weit anfassen, dass nichts
bricht; der Kaufweg wird in AGE-907/AGE-908 behandelt, nicht hier.

**Prüferkonto:** `docs/pruefer-zugang.md` von `connect` auf `discover` (neu)
umschreiben, mit Begründung.

## Fallstricke in diesem Repo

- Nach JEDEM `pnpm build`, vor jedem `git add`:
  `git checkout -- src/content/release-entries.generated.ts`
- Neue Migration, nie eine bestehende ändern. Nach dem Merge blockt
  `drift-gate` jeden Deploy, bis `migrate-prod` dispatcht und der Lauf mit
  `gh run rerun --failed` wiederholt ist — in den PR-Text schreiben.
- Conventional Commits, ein Commit je logischer Änderung, signiert.
  Branch `donald/age-903-...` nur für den letzten PR; Teil-PRs auf einem
  Branch OHNE Kürzel, sonst setzt der Merge das Issue auf Done.
- pgTAP für jede Stufe 1–6: was lesbar/erlaubt ist. In die CI-Dateiliste
  (`.github/workflows/ci.yml`) eintragen.
- `openspec validate --all` grün. Delta auf `membership-tiers`, dazu
  `access-control`, `contact-requests`, `directory-search`, `events`, wo
  eine Schwelle in einer Anforderung steht.
- Lastenheft Teil C (`docs/lastenheft.md`) nachziehen: Namensfrage
  BOOST/Basic ist entschieden.

## Was ich von dir erwarte, bevor du Code schreibst

1. Die Schwellen-Tabelle (alt → neu), vollständig.
2. Die Verteilung je Stufe auf PROD und deine Zuordnung.
3. Wo das Frontend Stufennamen/Preise außerhalb von `levels.ts` hart
   kodiert (Pricing-Karten, `membershipVisuals`, Onboarding-Texte,
   Release-Geschichten).
4. Stellen, an denen du unsicher bist, statt eine Seite zu wählen.
```
