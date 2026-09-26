## Why

AGE-903.

Detlev hat am 23.09. eine neue Zugangsleiter vorgelegt (V5-Funktionsmatrix),
am 25.09. telefonisch nachgeschärft. Sechs Stufen bleiben, aber sie heissen
anders und sie **rutschen**: `basic` wird ACTIVE, `connect` wird BOOST,
`discover` wird CONNECT, `exchange` wird DISCOVER, `focus` und `impact`
behalten ihre Plätze als FOCUS und IMPACT. Der entscheidende Satz dahinter:
**der FBC beginnt erst bei DISCOVER.** ACTIVE, BOOST und CONNECT liegen
ausserhalb und werden nur technisch vorgehalten.

Damit ist die offene Namensfrage BOOST/Basic aus Lastenheft C.1 entschieden.

**Die Arbeit ist nicht das Umbenennen, sondern das Anheben der Schwellen.** Das
Gating vergleicht Rangzahlen, keine Schlüssel. Ein reines Umbenennen würde
Rechte nach unten verschenken: CONNECT (Rang 3) bekäme die heutigen
`discover`-Rechte, BOOST (Rang 2) die Mitgliederliste — beides sind Stufen, die
nach der neuen Leiter gar nicht im Club sind.

Gemessen, nicht angenommen: es gibt **elf** Stellen mit einer Rangschwelle,
sechs RLS-Policies, eine WITH-CHECK-Bedingung, drei RPC-Rümpfe und eine
`minTier`-Zeile in der Navigation. `has_level(1)` existiert nirgends.

## What Changes

- **Die sechs Stufen heissen neu** — ACTIVE · BOOST · CONNECT · DISCOVER ·
  FOCUS · IMPACT, in dieser Reihenfolge von Rang 1 bis 6. „Basic" und
  „Exchange" verschwinden aus der Oberfläche.
- **Der Club beginnt bei DISCOVER.** Alles, was heute ab Rang 2 oder Rang 3
  freigeschaltet ist, gilt künftig ab Rang 4: das Mitgliederverzeichnis mit
  Liste und Suche, die erweiterten Profilfelder (Kompetenzen, Interessen,
  Kompass-Themen, Suchen/Bieten), die Anmeldung zu Mitglieder-Events und die
  Kontaktanfragen.
- **Die Academy verlangt künftig DISCOVER.** Bisher stand sie jedem aktivierten
  Konto offen, ohne jede Stufenprüfung — das war so nie beschlossen, sondern
  nie gebaut.
- **Wer sich anmelden darf, darf auch absagen.** Heute darf ein Konto auf Rang 3
  sich zu einem Mitglieder-Event anmelden, seine Anmeldung danach aber nicht
  mehr ändern; bei einem öffentlichen Event kann sich jedes aktivierte Konto
  anmelden und **nie** absagen. Anmelden und Absagen tragen künftig dieselbe
  Bedingung.
- **Im Admin stehen beim Stufe-Setzen nur noch DISCOVER, FOCUS und IMPACT zur
  Wahl.** Ein Bestandskonto auf einer der drei unteren Stufen wird weiter
  angezeigt, aber nicht mehr dorthin gesetzt.
- **Bestandsmitglieder ziehen nicht rangtreu um.** Wer heute `impact` ist,
  bleibt IMPACT; `focus` bleibt FOCUS; alles zwischen `connect` und `exchange`
  wird DISCOVER; `basic` wird ACTIVE. Rangtreu umgezogen verlöre ein
  `discover`-Konto seinen Clubzugang.
- Neue Konten starten auf **ACTIVE** statt auf „Basic" — derselbe Platz auf der
  Leiter, neuer Name.

**BREAKING** — die Schlüssel in `membership_tiers` ändern ihre Bedeutung:
`discover` und `connect` existieren heute und danach, mit **anderem Rang**. Die
Migration führt deshalb Zwischenschlüssel, nach dem Vorbild von
`20260715150000_six_level_model.sql`. Wer `profiles.tier` ausserhalb dieses
Repos liest und Schlüssel mit Rechten gleichsetzt, liegt nach der Migration
falsch.

### Ausdrücklich nicht in diesem Change

- **Kein Stripe.** Der Kaufweg bleibt ruhend; `STRIPE_PRICE_*`-Namen werden nur
  so weit nachgezogen, dass nichts bricht. Kaufknöpfe entstehen keine.
- **Keine Navigation.** effbeezee geht als FBC live, die acht Hauptbuttons aus
  V5 kommen nicht, neue Module auch nicht.
- **BOOST bleibt bei 0 €.** Die 75 € aus der V5-Matrix werden bewusst noch
  nicht eingetragen (Donald, 25.09.) — eine Stufe, die niemand kaufen kann,
  braucht keinen Preis.
- **`platform_settings.open_contact` bleibt unangetastet** und steht auf PROD
  weiter auf `true`. Damit darf faktisch jedes aktivierte Konto
  Kontaktanfragen senden, auch unterhalb DISCOVER. Das Umlegen des Schalters
  gehört zu AGE-930 (Selbstregistrierung), nicht hierher.
- **Die Release-Geschichten bleiben stehen.** „Das Mitgliederverzeichnis ist ab
  Connect sichtbar" war am Tag seiner Veröffentlichung richtig; eine Chronik
  umzuschreiben, damit sie zur Gegenwart passt, wäre kein Nachziehen, sondern
  eine Fälschung.

## Capabilities

### New Capabilities

Keine. Der Change verschiebt Schwellen in bestehenden Capabilities; die einzige
neu ausgesprochene Zusage (Academy ab DISCOVER) gehört in die bestehende
`academy-library`.

### Modified Capabilities

- `membership-tiers`: die Leiter selbst — Schlüssel, Ränge, Labels, Preise —
  und die Stufe, auf der neue Konten starten.
- `access-control`: die Zusage „Sichtbarkeit folgt dem Rang" nennt heute
  `discover` als Beispiel für ein Konto, das ein fremdes Vollprofil liest. Nach
  der Umstellung ist genau das falsch.
- `directory-search`: die zweistufige Schwelle (Liste ab Rang 2, erweiterte
  Felder ab Rang 3) wird **eine** Schwelle bei Rang 4. Betrifft auch den
  Sucheinstieg in der Kopfzeile und den Reiter „Meine Kontakte".
- `member-profiles`: die Rangschwelle für Vollprofil und erweiterte Daten.
- `matching`: `offers`/`needs` lesen heute ab Rang 3.
- `contact-requests`: die Staffelung „`connect` darf nur an `connect`" entfällt
  ersatzlos — unter DISCOVER gar keine Anfragen, ab DISCOVER an jeden.
- `events`: die sichtbarkeitsabhängige Anmeldeschwelle, und neu die Zusage,
  dass Absagen dieselbe Bedingung trägt wie Anmelden.
- `academy-library`: neue Zusage — die Academy verlangt DISCOVER.
- `admin`: neue Zusage — die Stufenauswahl bietet nur DISCOVER, FOCUS, IMPACT
  an und zeigt eine bestehende tiefere Stufe trotzdem an.

## Impact

**Datenbank.** Eine neue Migration (nie eine bestehende ändern): Schlüssel,
Labels, Preise und Ränge in `membership_tiers` über Zwischenschlüssel;
`profiles.tier` DEFAULT von `'basic'` auf `'active'`; sechs RLS-Policies, eine
WITH-CHECK-Bedingung und drei Funktionsrümpfe neu deklariert. `profiles.tier`
ist Fremdschlüssel auf `membership_tiers(key)` — die Reihenfolge innerhalb der
Migration ist deshalb nicht frei.

Auf PROD betrifft die Umstellung **76 Profile**: 73 × `impact`, 1 × `discover`,
2 × `basic`, sonst keine (gelesen am 25.09.). Nach dem Merge blockt
`drift-gate` jeden Deploy, bis `migrate-prod` dispatcht und der Lauf mit
`gh run rerun --failed` wiederholt ist.

**Frontend.** `src/config/levels.ts` (Schlüssel, Labels, Preise, Ränge,
`DEFAULT_LEVEL`), `src/config/nav.ts` (`minTier` auf `/mitglieder`, neu auf
`/academy`), `src/pages/MitgliedschaftPage.tsx`, `src/components/ui/TierBadge.tsx`,
`src/lib/contact-requests.ts`, die Stufentexte in `HeaderSearch`,
`MemberDirectory` und `HomePage`, und die Stufenauswahl in
`AdminMitgliederPage`. `src/config/membershipVisuals.ts` braucht **keine**
Zeile — es rechnet nur mit `rank`.

**Tests.** pgTAP je Stufe 1–6 (was lesbar und erlaubt ist), eingetragen in die
Dateiliste in `.github/workflows/ci.yml`. Vitest für die Frontend-Schwellen.

**Doku.** `docs/lastenheft.md` Teil C (Namensfrage entschieden),
`docs/pruefer-zugang.md` (das Prüferkonto existiert noch nicht und entsteht
**nach** dieser Migration direkt auf DISCOVER — es wandert nicht mit),
`supabase/functions/create-checkout-session/README.md` (Schlüsselnamen).

**Edge Functions.** `create-checkout-session` leitet `STRIPE_PRICE_<KEY>_<INTERVAL>`
aus dem Schlüssel ab; mit den neuen Schlüsseln heissen die Variablen anders.
Stripe ist ruhend, es bricht nichts — die README-Liste wird trotzdem richtig
gestellt.
