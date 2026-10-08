# Die Mitgliederliste lässt sich nicht mehr am Verzeichnis vorbei abholen

Linear: **AGE-1001**

## Why

Zwei Relationen liefern heute jedem angemeldeten Mitglied die vollständige
Mitgliederliste, wenn man sie **ohne Filter** abfragt. Gemessen am Katalog von
PROD am 03.10.2026:

| Relation                 | Befund                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.profiles`        | `profiles_select_self_or_discover` endet auf `(id = auth.uid() or has_level(4))`. Ein `select` ohne Filter gibt jedes aktivierte, nicht gesperrte Profil zurück — **einschliesslich der Zeilen mit `is_public = false`**, die die Sicht gerade herausfiltert. |
| `public.profiles_public` | läuft mit `security_invoker = off`, umgeht also die RLS, trägt **keine** Rangprüfung und hat `grant select to authenticated`.                                                                                                                                 |

Das ist **Bestand, nicht von V5F-1 erzeugt.** Was V5F-1 geändert hat, ist die
Bedeutung: „Mitglieder gezielt suchen" ist seitdem ein IMPACT-Recht. Diese
Zusage gilt an der Oberfläche und an `search_directory` — und am direkten
Tabellenzugriff gilt sie **nicht**. Solange das so ist, darf der Satz „ein Konto
ohne `verzeichnis.suchen` kann keine Mitgliederliste beschaffen" nicht geführt
werden, und genau so steht er heute als Nicht-Zusage in `directory-search`.

**Es blockiert die Abnahme.** V5F-7 verlangt den Nachweis zweifach — Oberfläche
**und** Datenbank. Für das Verzeichnisrecht fehlt die zweite Hälfte.

**Und es ist nicht in zwei Schritten machbar.** Der Sicht das Leserecht zu
entziehen, ohne Ersatz, schaltet das Verzeichnis für **alle** ab:
`search_directory` ist `SECURITY INVOKER` (`prosecdef = false`) und liest sie.
Entzug und Ersatz sind ein Schritt.

## What Changes

- Niemand kann die Mitgliederliste mehr an der Verzeichnis-Suche vorbei
  abholen. Wer das Recht „Mitglieder suchen" nicht hat, bekommt auch über
  Umwege keine Liste.
- Für alle anderen Flächen ändert sich **nichts Sichtbares**: Namen und
  Profilbilder stehen weiterhin im Feed, im Chat, bei Events, in der Academy,
  bei Kontaktanfragen und in den Vorschlägen — auch für Mitglieder unterhalb
  der Verzeichnisschwelle.
- Das eigene Profil bleibt vollständig lesbar und bearbeitbar.
- Die Verzeichnis-Suche selbst arbeitet unverändert weiter, für die, die sie
  dürfen.

Im Einzelnen:

**Zwei Leserechte fallen, und an ihre Stelle treten kennungsgebundene
Funktionen.** `select` auf `public.profiles` und auf `public.profiles_public`
wird `authenticated` entzogen. Was die Oberfläche braucht, holt sie danach über
`SECURITY DEFINER`-Funktionen, die **Kennungen entgegennehmen** statt eine Menge
zu liefern.

**`search_directory` wird `SECURITY DEFINER`.** Sonst nimmt ihr der Entzug die
Sicht, aus der sie liest. Das verschiebt die Maskierung der erweiterten Spalten
(`competencies`) vom RLS-Filter auf das Eintrittstor der Funktion — die Funktion
behält dasselbe Ergebnis, aber aus einem anderen Grund, und der braucht eigene
Zusagen.

**Die vier Schreibwege wandern mit in Funktionen** — nicht aus Ordnungsliebe,
sondern weil es nicht anders geht. `update … where id = $1` braucht `select` auf
die Spalten der WHERE-Klausel; der Entzug bricht also den **Schreibvorgang
selbst**. Und der naheliegende Ausweg, ein spaltenweises `select(id)`, stellt die
Aufzählbarkeit wieder her — gemessen. Beides hat die Plan-Review gefunden.

**Drei Zusagen in `supabase/tests/rechte_v5_test.sql` drehen sich um.** Sie
halten heute ausdrücklich den offenen Zustand fest („OFFEN: Rang 4 liest
`profiles` ohne Filter — Verschluss in `verzeichnis-dicht`"). Dieser Change ist
nicht fertig, bevor sie das Gegenteil behaupten.

## Was gemessen wurde, bevor etwas vorgeschlagen wird

**Die Abfragestellen: 20 — aber nicht die 20 des Vorgangs.** Er nennt 13 auf
`profiles`; gezählt über `src/` ohne Tests und ohne `src/vision/` (toter Code)
sind es **12**. Auf `profiles_public` sind es 7, wie angegeben. Dazu eine
zwanzigste **ausserhalb von `src/`**, die erst die Plan-Review gefunden hat:
`supabase/functions/create-checkout-session/index.ts` liest `profiles` mit dem
Token des Aufrufers. Dass die Zahl wieder bei 20 landet, macht die erste Zählung
nicht richtig — sie hat eine andere Stelle übersehen. Die Wurzeln sind `src/`
**und** `supabase/functions/`.

**Die Grants auf `profiles` sind spaltenweise, und `role_table_grants` zeigt
das nicht.** Diese Sicht meldet für die App-Rollen genau `authenticated: SELECT`
— was so aussieht, als könne der Client gar nicht schreiben, und vier direkten
`.update()`-Aufrufen widerspricht. `role_column_grants` löst es auf:

| Rolle           | Recht  | Spalten                                                              |
| --------------- | ------ | -------------------------------------------------------------------- |
| `authenticated` | SELECT | 32 (alle)                                                            |
| `authenticated` | UPDATE | **17** (`avatar_url`, `name`, `is_public`, `goals`, `interests`, … ) |

Wer nur die erste Sicht liest, hält die Tabelle für nicht beschreibbar und
plant auf einer falschen Annahme.

**`profiles_public` liefert zehn Spalten** (`id`, der aufgelöste `name`,
`avatar_url`, `region`, `company`, `short_bio`, `tier`, `roles`, `cover_url`,
`branche`) und filtert auf `is_public and is_activated() and activated_at is not
null and disabled_at is null and deleted_at is null`. Das Prädikat mischt
Zeilen- und Aufruferbedingungen: `is_activated()` prüft den **Aufrufer**.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `directory-search`: Die Anforderung „`profiles_public` trägt bewusst keine
  Stufenschwelle" bleibt in ihrer Zusage (Basisfelder für **jedes** aktivierte
  Mitglied, ohne Rücksicht auf die Stufe), wechselt aber den Mechanismus: von
  einem Leserecht auf der Relation zu einer kennungsgebundenen Funktion. Der
  Satz, der die Aussage „keine Mitgliederliste beschaffbar" bis dahin verbietet,
  entfällt. Dazu die Umstellung von `search_directory` auf `SECURITY DEFINER`
  und was daran hängt.
- `access-control`: Der Rohzugriff als eigener Weg neben der Oberfläche und der
  Suche — und die Regel, dass ein Recht erst dann geführt werden darf, wenn alle
  drei Wege es tragen.

## Impact

- **Migration** (neu, nie eine bestehende ändern): Entzug beider Leserechte und
  der Spalten-Grants für `update`, neue `SECURITY DEFINER`-Funktionen für Lesen
  **und** Schreiben, `search_directory` auf `DEFINER`. Entzug und Ersatz stehen
  in **derselben** Migration — ein Zwischenzustand wäre ein Ausfall.
  **Nach dem Merge blockt `drift-gate` jeden Deploy, bis `migrate-prod`
  dispatcht und der blockierte Lauf mit `gh run rerun --failed` wiederholt ist.**
- 19 Abfragestellen in `src/` — alle schon kennungsgebunden, der Umbau ist
  mechanisch, aber keine davon darf übersehen werden.
- `supabase/tests/rechte_v5_test.sql` — drei Zusagen drehen sich um.
- `supabase/tests/grants_test.sql` — der Schnappschuss nagelt in Zeile 90/91
  genau die beiden Grants fest, die fallen, und in Zeile 184 die 17
  `update`-Spalten. Ohne Nachzug kann die Suite gar nicht grün werden.
- `supabase/functions/create-checkout-session/index.ts` — dieselbe Einbettung
  wie `AuthProvider`, also derselbe Ersatz.
- `src/lib/database.types.ts` — handgepflegt, die neuen Funktionen eintragen.
  **`gen types` NIE darüberlaufen lassen.**

## Was NICHT Teil dieses Changes ist

> Diese Liste gehört nicht zum Lieferumfang. Sie steht hier, damit die Grenze
> benannt ist.

- Die **Stufenschwelle auf den Basisfeldern**. Die Zusage bleibt: jedes
  aktivierte Mitglied sieht Namen und Bilder, unabhängig von der Stufe. Dieser
  Change bindet den **Rohzugriff** an Kennungen, er stellt die Felder nicht
  hinter eine Stufe.
- Die **Namensmaskierung** aus AGE-291 (`resolve_display_name`). Sie liegt in
  der Sicht und wandert unverändert in die Ersatzfunktion.
- Eine **Obergrenze als Sicherheitsargument**. Eine Zahl wie 200 begrenzt die
  Stapelgrösse und beweist **nichts** über die Herkunft der Kennungen. Was
  trägt, ist die Unerratbarkeit einer UUID und dass Kennungen nur aus
  erreichbaren Flächen stammen. Eine Grenze kann aus Betriebsgründen trotzdem
  sinnvoll sein — sie darf nur nicht als Zusage ausgegeben werden.
