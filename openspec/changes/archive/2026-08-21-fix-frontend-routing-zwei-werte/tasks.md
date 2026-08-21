## 1. Den Befund festhalten, bevor er korrigiert wird

- [x] 1.1 Am Code belegen, dass `SUPABASE_DB_PASSWORD` keinen Frontend-Verbraucher
      hat (`grep -rn SUPABASE_DB_PASSWORD`), und dass das Frontend-Routing an
      genau zwei Werten hängt (`src/lib/supabase.ts`). Ausgabe in die Change.
- [x] 1.2 Gegenprobe zur Annahme des Plan-Reviews: genau ein `createClient` im
      Frontend, kein hart geschriebenes `supabase.co`-Literal in `src/`.

## 2. Den Spec korrigieren

- [x] 2.1 MODIFIED-Delta für „Zwei getrennte Supabase-Projekte mit festen Rollen":
      zwei Werte statt drei, `SUPABASE_DB_PASSWORD` gestrichen.
- [x] 2.2 Szenario „Der Wechsel des Frontend-Routings lässt die Infrastruktur
      unberührt" auf „die zwei Frontend-Werte" ziehen — **Titel unverändert**.
- [x] 2.3 MODIFIED-Delta für „Bis zum Import trägt allein DEV die Rolle beider
      Umgebungen": das Szenario „Das Aufsetzen von PROD lenkt keinen Verkehr um"
      nennt die drei Werte ein zweites Mal. **Titel unverändert.**
- [x] 2.4 Die abschließende Aufzählung fordern, **ohne den Mechanismus zu
      begründen**: nicht „weil kein `VITE_`-Präfix", sondern „SHALL NOT im
      Client-Bundle erscheinen". Eine Begründung über die heutige Vite-Voreinstellung
      gehört nicht in eine normative Anforderung.
- [x] 2.5 `openspec validate --all` grün.

## 3. Gegenprobe: sagt sonst noch jemand „drei"?

- [x] 3.1 **Nicht** mit einer einzelnen Zeichenkette. Die Specs sind hart
      umbrochen, „drei Frontend-Werte" steht über einen Zeilenumbruch verteilt,
      und das Runbook sagt „drei prod-Werte". Über Varianten suchen
      (`drei`, `SUPABASE_DB_PASSWORD`) und jeden Treffer einzeln prüfen.
- [x] 3.2 Fundstelle `docs/supabase-environments.md:578` („Umzug der drei
      prod-Werte") korrigieren — sie widersprach der eigenen Anleitung darüber.

## 4. Die Streichung messen statt behaupten

- [x] 4.1 Build mit Sentinel-`SUPABASE_DB_PASSWORD` und Sentinel-`VITE_`-Werten.
- [x] 4.2 Im Erzeugnis nach dem Passwort suchen: **kein Treffer**.
- [x] 4.3 **Gegenprobe**, sonst belegt 4.2 nichts: dieselbe Suche findet
      `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` im Bundle.

## 5. Abschluss

- [x] 5.1 Plan-Review (2b) mit ≥2 Reviewern anderer Anbieter, `REVIEWS.md`.
- [x] 5.2 `openspec archive` — das Delta faltet sich in `openspec/specs/`.
- [x] 5.3 **Nach** dem Archivieren erneut `openspec validate --all`, und die
      Varianten-Suche aus 3.1 gegen den gefalteten Hauptspec wiederholen.
- [ ] 5.4 Commit als Conventional Commit mit `(AGE-579)`, Feature-Branch, PR
      gegen `main`; Merge per `gh pr view --json state` gegengeprüft, nicht am
      Exit-Code.
- [ ] 5.5 Linear-Status prüfen (`get_issue`) — die GitHub-Automation schaltet
      In Progress/Done selbst; nur schreiben, wenn sie es nicht getan hat.
