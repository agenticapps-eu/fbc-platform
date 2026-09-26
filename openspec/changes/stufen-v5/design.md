## Context

Die Leiter rutscht um einen Rang, und zwei Schlüssel wechseln dabei ihre
Bedeutung, ohne ihren Namen zu wechseln. Das ist derselbe Vorgang wie beim
Sechs-Stufen-Modell am 15.07.2026 (`20260715150000_six_level_model.sql`), und
dieser Change folgt bewusst seinem Muster, bis in die Reihenfolge der
SQL-Schritte.

**Gemessener Ausgangsstand, nicht angenommener.** Alle Zahlen unten stammen aus
dem Katalog des lokalen Stacks (136 von 137 Migrationen angewendet; die fehlende
ist AGE-905s Daten-Backfill und rührt kein Gating an) und aus einem lesenden
Zugriff auf PROD vom 25.09.

*Elf Stellen mit einer Rangschwelle:*

| # | Objekt | Art | heute | neu |
|---|---|---|---|---|
| 1 | `profiles_select_self_or_discover` | RLS SELECT | 3 | 4 |
| 2–6 | `needs_select`, `offers_select`, `profile_badges_select`, `interests_select`, `theme_scores_select` | RLS SELECT | 3 | 4 |
| 7 | `regs_write_own` (WITH CHECK) | RLS UPDATE | 4 | sichtbarkeitsabhängig |
| 8 | `search_directory()` Eintrittstor | RPC | 2 | 4 |
| 9 | `darf_kontaktanfrage_senden()` | RPC | 3 / 2 | 4, Staffelung entfällt |
| 10 | `register_for_event()` | RPC | 3 | 4 |
| 11 | `nav.ts` `minTier` `/mitglieder` | Frontend | `connect` (2) | `discover` (4) |

*Drei Stellen mit einem hart geschriebenen Schlüssel, ohne jede Rangschwelle:*

| Objekt | Literal | bricht |
|---|---|---|
| `handle_new_user()` | `'basic'` | bei der nächsten Registrierung, still, als FK-Verletzung |
| `profiles.tier` DEFAULT | `'basic'` | im selben Moment |
| `darf_kontaktanfrage_senden()` | `'connect'` | entfällt mit der Staffelung |

Die dritte Gruppe ist der Grund, warum eine Inventur der *Gates* nicht reicht:
`handle_new_user()` trägt kein `has_level` und stand in keiner Schwellen-Tabelle.
Gefunden hat ihn ein Hinweis der Parallelsitzung, bestätigt hat ihn ein Katalog-
Scan über Funktionsrümpfe, Spalten-Defaults und Check-Constraints. Derselbe Scan
entlastet die Importpfade: `wp_schreiben.ts`, `import_world_seed.ts` und
`chat-testkonten.ts` schreiben ausschliesslich `'impact'`, und dieser Schlüssel
überlebt unverändert.

*Bestand auf PROD am 25.09.* — 76 Profile: `basic` 2 (1 aktiviert), `connect` 0,
`discover` 1 (1 aktiviert), `exchange` 0, `focus` 0, `impact` 73 (25 aktiviert).
`platform_settings.open_contact` steht auf `true`.

## Goals / Non-Goals

**Goals.** Die Leiter heisst und zählt neu; alles, was heute unterhalb Rang 4
freigeschaltet ist, liegt danach bei Rang 4; kein Bestandskonto verliert seinen
Clubzugang; keine Stelle schreibt nach der Migration einen Schlüssel, den es
nicht mehr gibt.

**Non-Goals.** Stripe (ruht), Navigation (unverändert), neue Module, das
Umlegen von `open_contact` (AGE-930), der Preis 75 € für BOOST (später), das
Umschreiben der Release-Chronik.

## Decisions

### 1. Zwei Zwischenränge statt Lockerung der Unique-Bedingung

`membership_tiers.level_rank` trägt eine Unique-Bedingung, und die Zielränge
überlappen mit den bestehenden. Das Verfahren ist das von `20260715150000` —
aber es braucht hier **zwei** temporäre Ränge, nicht sechs. Nachgerechnet:

| Schlüssel | heute | danach | Art |
|---|---|---|---|
| `active` | — | 1 | **neu** |
| `boost` | — | 2 | **neu** |
| `connect` | 2 | 3 | bleibt, Rang steigt |
| `discover` | 3 | 4 | bleibt, Rang steigt |
| `focus` | 5 | 5 | unverändert |
| `impact` | 6 | 6 | unverändert |
| `basic` | 1 | — | entfällt |
| `exchange` | 4 | — | entfällt |

Nur `active` und `boost` sind neue Zeilen, und nur sie kollidieren beim Anlegen
(Rang 1 hält noch `basic`, Rang 2 noch `connect`). Sie entstehen deshalb auf
101 und 102. Die gewählte Reihenfolge, ausdrücklich benannt, weil beide
denkbaren Wege funktionieren und ein ungenannter Weg den Migrationsschritt
rätselhaft macht:

1. `active` (101) und `boost` (102) anlegen — sie müssen existieren, bevor ein
   Profil auf sie zeigen darf (`profiles_tier_fkey`).
2. Profile umhängen: `basic` → `active`, `exchange` → `discover`,
   `connect` → `discover`.
3. `basic` und `exchange` löschen — jetzt sind die Ränge 1 und 4 frei.
4. `discover` 3 → 4, danach `connect` 2 → 3. Diese Reihenfolge ist erzwungen:
   umgekehrt liefe `connect` in den noch belegten Rang 3.
5. `active` 101 → 1, `boost` 102 → 2.

`focus` und `impact` werden in keinem Schritt angefasst.

*Verworfen: die Unique-Bedingung für die Dauer der Migration fallen lassen.*
Kürzer, und genau deshalb falsch: die Bedingung ist das Einzige, was verhindert,
dass zwei Stufen denselben Rang tragen und `has_level` mehrdeutig wird. Eine
Bedingung, die man ablegt, um an ihr vorbeizukommen, ist die, die einen gerade
schützt.

*Verworfen: die Ränge direkt umschreiben, in absteigender Reihenfolge.* Das
funktioniert für eine Verschiebung um +1 tatsächlich — aber nur, solange
niemand später eine Stufe einfügt. Das Verfahren wäre an die Richtung der
Verschiebung gebunden, ohne dass irgendwo stünde, dass es das ist.

### 2. Die Schwellen werden neu abgeleitet, nicht übertragen

Jede der elf Stellen bekommt ihre neue Zahl aus der Zusage „ab der untersten
Clubstufe", nicht aus ihrer alten Zahl plus eins. Das ist dieselbe Falle, die
`20260715150000` unter „SCHWELLEN-DRIFT" notiert hat: ein mechanisches Remap
hätte damals jedes Gate auf `impact` gehoben.

Konkret sichtbar wird der Unterschied bei Stelle 7: `regs_write_own` trägt
heute bereits eine 4. Übertragen hiesse „bleibt 4, fertig" — abgeleitet heisst
„trägt dieselbe Bedingung wie `register_for_event`", und das ist etwas anderes
(siehe Entscheidung 4).

### 3. Der Policy-Name `profiles_select_self_or_discover` bleibt

Er wurde geprägt, als `discover` Rang 3 hiess, und bewacht künftig Rang 4 — was
`discover` dann heisst. Der Name bleibt also zufällig richtig, aber aus dem
falschen Grund.

*Verworfen: umbenennen.* Sechs Aufrufstellen, eine Migration, und der Verlust
der Spur zu der Migration, die die Policy angelegt hat — für einen rein
kosmetischen Gewinn. Stattdessen steht in beiden betroffenen Specs ausdrücklich,
dass die Zahl im Rumpf die Autorität ist und nie der Name.

### 4. `regs_write_own` spiegelt die Bedingung, statt die Zahl anzugleichen

Heute darf sich ein aktiviertes Konto auf **jedem** Rang zu einem
`public`-Event anmelden (`register_for_event` prüft dort gar keinen Rang),
kann seine Anmeldung danach aber nur ab Rang 4 ändern. Es kann sich also
anmelden und **nie** absagen. Bei `members`-Events klafft dieselbe Lücke
schmaler: anmelden ab 3, ändern ab 4.

Beide Zahlen auf 4 zu setzen schliesst nur die zweite Lücke. Die erste bliebe
offen, weil der `public`-Zweig in der UPDATE-Policy überhaupt keine Entsprechung
hat. Deshalb bekommt die `WITH CHECK`-Klausel dieselbe sichtbarkeitsabhängige
Bedingung wie die RPC.

*Verworfen: die Anmeldung zu `public`-Events auf Rang 4 heben.* Das schlösse
die Lücke ebenfalls, nähme aber öffentlichen Events ihren Zweck — sie sind der
eine Berührungspunkt für Konten ausserhalb des Clubs.

### 5. Die Academy bekommt ihr Gate in `nav.ts`, nicht in der Datenbank

Es gibt keine Academy-Tabelle mit RLS; die Lektionen sind kuratierte Inhalte.
Ein Datenbank-Gate hätte nichts, woran es hängen könnte.

Daraus folgt, was die Spec ausdrücklich sagt: **das ist Komfort, keine
Sicherheitsgrenze.** Dort, wo die Academy Mitgliederdaten anfasst — die
Namensauflösung über `profiles_public` —, gilt unverändert, was dort gilt.

### 6. Die Beschränkung der Admin-Auswahl liegt in der Oberfläche

`admin_set_tier()` nimmt weiterhin alle sechs Schlüssel. Nur die Auswahl zeigt
DISCOVER, FOCUS, IMPACT.

*Verworfen: die drei Stufen in der Funktion erzwingen.* Dann wäre die Korrektur
eines versehentlich zu hoch gesetzten Kontos nach unten unmöglich — genau die
Fähigkeit, für die `admin_set_tier()` neben `apply_upgrade()` existiert. Und
eine Anzeigeentscheidung in einer `SECURITY DEFINER`-Funktion zu verankern
machte aus ihr eine Rechtegrenze, die sich nur noch per Migration ändern lässt.

### 7. `open_contact` bleibt `true`, und das wird in der Spec benannt

Der Schalter hebt die Kontaktanfrage-Schwelle auf. Sie in den Code zu schreiben
und den Schalter stehen zu lassen erzeugt genau den Zustand, den
`open-contact-flag-hebelt-zwei-gates` beschreibt: der Code liest sich wie „ab
DISCOVER", und in Wahrheit darf jeder.

Der Ausweg ist nicht, die Schwelle wegzulassen, sondern den Widerspruch
aufzuschreiben. Die Delta-Spec sagt deshalb ausdrücklich, dass die Schwelle der
**Rückfallwert** ist und dass jede Aussage über Kontaktanfrage-Rechte zuerst
`platform_settings` lesen muss.

### 8. Die Katalog-Kommentare werden in derselben Migration richtiggestellt

Sechs Objekte tragen heute einen Kommentar, der die alte Leiter als Wahrheit
ausgibt — gemessen am 26.09. aus `pg_description`:

| Objekt | Kommentar sagt heute |
|---|---|
| `has_level(int)` | „Ränge: basic=1 connect=2 discover=3 exchange=4 focus=5 impact=6" |
| `membership_tiers` | „level_rank steigt basic=1 … impact=6" |
| `darf_kontaktanfrage_senden` | „basic nein, connect nur an genau connect, ab discover an alle" |
| `register_for_event` | „members ab `discover` (rank 3) … war exchange" |
| `search_directory` | „ab `connect` (Rang 2) … UNVERÄNDERTEN Rang-3-Policy" |
| `profiles_select_self_or_discover` | trägt **gar keinen** — die Vorbild-Migration setzt einen (Zeile 182), ein späterer Ersatz der Policy hat ihn verloren |

`apply_upgrade` und `profiles_public` bleiben richtig: die eine rechnet rein mit
Rängen, die andere beschreibt `branche`, das unverändert bleibt.

Der Kommentar auf `has_level` ist der teuerste von ihnen. Er ist die einzige
Stelle im Katalog, an der die Rangtabelle ausgeschrieben steht, und genau die
Tabelle ändert sich. Eine Sitzung, die den Katalog befragt statt die
Migrationen zu lesen — was dieser Change selbst als den richtigen Weg
beschreibt —, bekäme danach die alte Leiter als Antwort.

*Verworfen: die Kommentare in einer Folge-Migration nachziehen.* Zwischen
beiden Läufen stünde ein Katalog, der sich selbst widerspricht, und der zweite
Lauf wäre das Erste, was unter Zeitdruck entfällt. `20260715150000` schreibt
Kommentare auf **jedes** angefasste Objekt (Zeilen 74, 111, 141, 165, 182, 252,
276, 297, 313, 431, 438, 444); dieser Change beansprucht, ihrem Muster zu
folgen.

## Risks / Trade-offs

**Eine halb angewendete Migration lässt Konten auf einem Schlüssel mit falscher
Bedeutung stehen** → Die Migration läuft in einer Transaktion (`db push` fährt
transaktional, solange kein `CONCURRENTLY` darin steht — und hier steht keins).
Zusätzlich prüft der letzte Schritt der Migration selbst, dass kein Profil auf
einem entfallenen Schlüssel steht, und bricht sonst ab.

**`handle_new_user()` bricht still** → Der Trigger wird in **derselben**
Migration nachgezogen, nicht in einer späteren. Ein pgTAP-Test legt einen
auth-Benutzer an und prüft die entstandene `profiles.tier` gegen
`membership_tiers` — nicht gegen das Literal `'active'`, sonst prüft er den
Text und nicht die Wirkung.

**Die Abnahme prüft den Schlüsselnamen statt den Rang** → Jede Zusicherung
liest `membership_tiers.level_rank` über einen Join, nie `profiles.tier` allein.
`discover` heisst vor und nach der Migration `discover` und bedeutet Verschiedenes;
ein `select tier from profiles` beantwortet die Frage nicht. Diese Verwechslung
ist am 25.09. nachweislich über zwei Stationen gewandert.

**Eine Sichtprobe gegen PROD bestätigt die Kontaktanfrage-Schwelle fälschlich**
→ Solange `open_contact` auf `true` steht, gelingt jede Anfrage, unabhängig vom
Rang. Die Schwelle wird deshalb ausschliesslich in pgTAP mit
`open_contact = false` geprüft, nie an der Oberfläche.

**62 Literale in pgTAP-Tests und im Demo-Seed brechen** → Das ist der
gewünschte Ausgang: sie werden in CI rot, bevor sie jemanden erreichen. Sie
gehören in denselben PR, sonst ist `main` rot. Gemessen am 26.09.: 62
Vorkommen der entfallenden Schlüssel in 14 Dateien, davon drei in
Kommentaren — Schwerpunkte `rls_test.sql` (15), `demo_personas.sql` (14),
`admin_set_tier_test.sql` (6).

**`drift-gate` blockt nach dem Merge jeden Deploy** → bis `migrate-prod`
dispatcht und der Lauf mit `gh run rerun --failed` wiederholt ist. Gehört in den
PR-Text.

**Der Kaufweg nennt Stufen, die es nicht mehr gibt** → `priceEnvKey()` leitet
`STRIPE_PRICE_<KEY>_<INTERVAL>` aus dem Schlüssel ab; mit `exchange` verschwindet
eine Variable und `active`/`boost` kämen hinzu. Stripe ruht, es bricht nichts;
`PAID_LEVELS` und die README werden trotzdem richtig gestellt, damit die Liste
nicht als Beleg für eine Leiter gelesen wird, die es nicht mehr gibt.

## Migration Plan

1. **Ein PR, ein Branch ohne Kürzel** (`stufen-v5`). Das Kürzel AGE-903 steht
   ausschliesslich im Titel des **letzten** PR; ein Teil-PR mit Kürzel im Titel
   oder Branchnamen setzt das Issue vorzeitig auf Done.
2. **Neue Migration, nie eine bestehende ändern.** Reihenfolge innerhalb der
   Datei ist durch den Fremdschlüssel `profiles_tier_fkey` erzwungen: neue Keys
   auf temporären Rängen → Profile umhängen → alte Keys löschen → echte Ränge
   setzen → DEFAULT und Trigger → Policies und Funktionen → Schlussprüfung.
3. **Verteilung vor und nach dem Lauf protokollieren**, als Zahl je Stufe, ohne
   Namen. Das Repo ist öffentlich.
4. **Nach dem Merge**: `migrate-prod` dispatchen (**ausdrückliche Freigabe
   nötig** — die allgemeine Merge-Freigabe deckt PROD-Schreibzugriffe nicht),
   danach `gh run rerun --failed` für den durch `drift-gate` blockierten Deploy.
5. **Danach**, nicht vorher: das Prüferkonto für die Store-Prüfung entsteht
   direkt auf dem neuen DISCOVER. Es existiert heute nicht (`connect` = 0 auf
   PROD), wandert also nicht mit und braucht keine Zeile in der Migration.
   Zuständigkeit abgestimmt mit der Parallelsitzung: diese Sitzung legt an, die
   andere hakt den Handschritt in AGE-907 ab.

**Rollback.** Forward-only. Ein Zurück hiesse, `discover` erneut umzudeuten —
mit denselben Zwischenschlüsseln, und mit dem Unterschied, dass inzwischen
Konten auf `active` stehen könnten, für die es keinen alten Schlüssel gibt. Der
Rückweg ist deshalb eine eigene Migration, keine Umkehrung dieser.

## Open Questions

- **Detlevs V5-Funktionsmatrix ist nicht lesbar.** Die Datei liegt unter
  `~/Documents`, das macOS per TCC sperrt (`EPERM`, auch über das Read-Werkzeug);
  im Repo und in Linear liegt sie nicht. Zu Kontaktanfragen sagen die im Issue
  zusammengefasste Matrix und der Telefonat-Nachtrag vom 25.09. **nichts** —
  Donalds Vorgabe („bei den aktuellen Stufen zulassen") gilt deshalb ungeprüft
  gegen das Originaldokument.
- **FOCUS und IMPACT starten mit denselben Rechten wie DISCOVER.** Standard aus
  dem Issue, Rückfrage an Detlev offen. Differenzierung (SUCHE/BIETE, gezielte
  Suche, eigene Events) später.
- **Die Adresse des Prüferkontos** entscheidet Donald. Kennung und Kennwort
  gehören nach Infisical, nicht ins Repo.
- ~~**Trägt CONNECT wirklich 150 €?**~~ **Entschieden am 26.09.: CONNECT trägt
  0 €** — „aktuell 0, wird ja später kommen" (Donald). Damit tragen alle drei
  Stufen ausserhalb des Clubs 0 €, und `PAID` wird
  `["discover", "focus", "impact"]`: die Preisseite bietet genau die drei
  Clubstufen an. Die Begründung, die schon für BOOST galt, gilt jetzt
  einheitlich — ein Preis ohne Kaufweg ist eine Zusage ohne Gegenstand. Preise
  für BOOST (75 €) und CONNECT kommen als eigene Änderung.
