# berechtigungen Specification

## Purpose
TBD - created by archiving change rechte-v5-final. Update Purpose after archive.
## Requirements
### Requirement: Ein Recht ist eine benannte Zeile mit einem Mindestrang

Das System SHALL feature-bezogene Rechte in der Tabelle
`public.berechtigungen (schluessel text primary key, min_rank int not null,
beschreibung text not null)` führen. Der `schluessel` SHALL die Funktion
benennen, nicht die Stufe (`events.erstellen`, nicht `impact_darf_events`) —
denn welche Stufe ein Recht trägt, ist genau das, was sich ändern können soll.

Die Tabelle SHALL **ausschliesslich** Rechte mit `min_rank >= 5` führen. Die
Clubschwelle (Rang 4) SHALL NOT als Recht erscheinen: sie ist eine Tür, keine
Funktion, und `has_level(4)` bleibt ihre einzige Instanz. Ein Recht mit
`min_rank = 4` wäre eine zweite Kopie dieser Zahl und würde von ihr abdriften.

Zum Go-live SHALL die Tabelle genau diese zehn Zeilen tragen (SPEC 01 V5 FINAL):

| `schluessel` | `min_rank` |
|---|---|
| `profil.business` | 5 |
| `organisation.verwalten` | 5 |
| `suche_biete` | 5 |
| `vorschlaege` | 5 |
| `verzeichnis.suchen` | 6 |
| `events.erstellen` | 6 |
| `community.erstellen` | 6 |
| `projekt.erstellen` | 6 |
| `academy.anbieten` | 6 |
| `fbc_format.initiieren` | 6 |

Vier dieser Schlüssel SHALL zum Go-live **keinen** Wirkort haben, weil ihr Modul
noch nicht existiert: `organisation.verwalten`, `community.erstellen`,
`projekt.erstellen`, `academy.anbieten`. Sie SHALL dennoch angelegt werden,
damit der jeweilige spätere Change nur noch seine Policy daran hängt und nicht
die Konfiguration mitverhandeln muss.

Die Pflege SHALL vorerst über Migrationen laufen. Eine Admin-Oberfläche SHALL
NICHT Teil dieser Zusage sein.

#### Scenario: Die Konfiguration trägt die Matrix

- **WHEN** `public.berechtigungen` gelesen wird
- **THEN** stehen genau zehn Zeilen darin, vier mit `min_rank = 5` und sechs mit
  `min_rank = 6`

#### Scenario: Kein Recht steht auf der Clubschwelle

- **WHEN** `public.berechtigungen` nach `min_rank <= 4` gefragt wird
- **THEN** kommt keine Zeile zurück

### Requirement: `darf()` ist die einzige Instanz für ein Feature-Recht

Das System SHALL `public.darf(p_schluessel text) returns boolean` als einziges
Prädikat für feature-bezogene Rechte führen. Es SHALL `SECURITY DEFINER` mit
gepinntem `search_path` sein, `stable`, und
`is_activated() and current_tier_rank() >= min_rank` entscheiden.

Ein **unbekannter** Schlüssel SHALL `false` ergeben, nicht `null` und keinen
Fehler — deny-by-default. Ein Tippfehler in einer Policy SHALL die Tür also
schliessen, nicht öffnen.

Policies SHALL `darf()` aufrufen, statt eine Rangzahl erneut zu schreiben, und
SHALL den Aufruf in `(select public.darf('…'))` einwickeln, damit er einmal je
Abfrage statt einmal je Zeile ausgewertet wird.

EXECUTE auf `darf()` SHALL `public`, `anon` und `service_role` ausdrücklich
entzogen und `authenticated` ausdrücklich erteilt werden — jede Rolle namentlich,
weil eine frisch erzeugte Supabase-Instanz Rechte rollenspezifisch vergibt und
ein `revoke … from public` dort nichts entzieht.

Auf `public.berechtigungen` SHALL **kein** Leserecht für `anon` oder
`authenticated` bestehen und RLS SHALL eingeschaltet sein — die Tabelle wird
ausschliesslich von `darf()` und `meine_rechte()` gelesen, die als
`SECURITY DEFINER` laufen.

#### Scenario: Ein unbekannter Schlüssel verweigert

- **WHEN** `darf('gibt.es.nicht')` aufgerufen wird
- **THEN** ist das Ergebnis `false`

#### Scenario: Ein nicht aktiviertes Konto auf Rang 6 darf nichts

- **GIVEN** ein angemeldetes Konto mit `tier = 'impact'` und leerem
  `activated_at`
- **WHEN** es `darf('events.erstellen')` aufruft
- **THEN** ist das Ergebnis `false`

#### Scenario: Der Rang entscheidet, nicht der Schlüsselname

- **GIVEN** zwei aktivierte Konten auf Rang 5 und Rang 6
- **WHEN** beide `darf('verzeichnis.suchen')` aufrufen
- **THEN** erhält das Konto auf Rang 6 `true` und das auf Rang 5 `false`

#### Scenario: Die Konfigurationstabelle ist für den Client verschlossen

- **WHEN** eine Client-Rolle `select` auf `public.berechtigungen` versucht
- **THEN** wird es verweigert — es besteht kein Tabellenrecht

### Requirement: Der Client erfährt seine Rechte in einem Zug

Das System SHALL `public.meine_rechte() returns text[]` anbieten: die Schlüssel,
die der Aufrufer **hat**, aufsteigend sortiert. Ein Konto ohne Sitzung oder ohne
Aktivierung SHALL das leere Array erhalten, nicht `null`.

Die Oberfläche SHALL ihre Rechte ausschliesslich hieraus beziehen und SHALL NOT
eine eigene Rangschwelle für ein Feature-Recht führen. Ein Rangvergleich im
Client ist zulässig **nur** für die Clubschwelle, weil die kein Recht ist.

Die Antwort SHALL nur die eigenen Rechte nennen und keine Auskunft darüber
geben, welche Rechte es überhaupt gibt oder welchen Rang sie verlangen — sonst
wäre die Preisliste aus der Konfiguration lesbar, bevor sie beschlossen ist.

#### Scenario: Ein FOCUS-Konto erhält genau seine vier Rechte

- **GIVEN** ein aktiviertes Konto auf Rang 5
- **WHEN** es `meine_rechte()` aufruft
- **THEN** kommen genau `organisation.verwalten`, `profil.business`,
  `suche_biete`, `vorschlaege` zurück

#### Scenario: Ein DISCOVER-Konto erhält das leere Array

- **GIVEN** ein aktiviertes Konto auf Rang 4
- **WHEN** es `meine_rechte()` aufruft
- **THEN** kommt ein leeres Array zurück — nicht `null`

#### Scenario: Die Auskunft verrät die Schwellen nicht

- **WHEN** die Antwort von `meine_rechte()` untersucht wird
- **THEN** trägt sie nur Schlüssel, keine Mindestränge und keine Schlüssel, die
  der Aufrufer nicht hat

