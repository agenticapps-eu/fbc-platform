# Design

## Entscheidung 1: `anon` wird namentlich entzogen, nicht über `public`

`revoke execute … from public` entfernt den Grant an die Pseudo-Rolle `public`.
Es entfernt **keinen** rollen-eigenen Grant. Supabase-Instanzen tragen je nach
Anlagedatum unterschiedliche Default Privileges; diese Instanz gewährt `anon`
ausdrücklich `EXECUTE` auf neue Funktionen in `public`. Deshalb hinterlässt
`revoke … from public` den `anon`-Grant unberührt, und zwar **still**.

**Gewählt:** `revoke execute on function … from public, anon;` — beide genannt.

**Verworfen: die Default Privileges der Instanz ändern.** Das wirkt global und
rückwirkend nicht; bestehende Funktionen behielten ihre Grants, und jede künftige
Migration verließe sich auf eine Instanz-Einstellung, die in keiner Datei steht.
Der Fehler wanderte damit von „vergessene Zeile" zu „unsichtbare Voraussetzung".

**Verworfen: `alter default privileges … revoke` zusätzlich.** Dieselbe
Unsichtbarkeit, plus eine zweite Wahrheit über denselben Sachverhalt. Die Regel in
`access-control` verlangt stattdessen, dass **jede** Funktion ihre Rechte
vollständig ausspricht — das ist prüfbar und steht im Diff.

## Entscheidung 2: Die Zusage misst das Recht, nicht die Fehlermeldung

Die alte Zusage lautete sinngemäß „ein Aufruf als `anon` endet mit
`permission denied for function search_directory`". Sie war lokal grün, **weil
`anon` das Recht lokal nie hatte** — sie hat nie etwas gemessen, was der Fix
hätte herstellen müssen.

**Gewählt:** `has_function_privilege('anon', '…'::regprocedure, 'execute')` ist
`false`. Das ist eine Zustandsaussage über den Katalog und damit genau das, was
die Migration herstellt.

**Und eine Gegenprobe, weil auch die neue Zusage sonst vakuum-grün wäre.** Der
Test erteilt das Recht, misst `true`, entzieht es, misst `false`. Erst damit ist
belegt, dass die Zusage das Bit wirklich liest und nicht bloß eine lokal ohnehin
wahre Aussage wiederholt. Das ist dieselbe Falle wie die Vakuum-Wache aus AGE-595.

**Ehrlich benannte Grenze:** Ein lokaler pgTAP-Test **kann** eine PROD-Abweichung
dieser Art nicht sehen, weil die Default Privileges der lokalen Instanz andere
sind. Genau diese Grenze steht ab jetzt in der Anforderung. Der Beleg für PROD ist
eine Katalog-Messung nach `migrate-prod`; sie gehört in `tasks.md` mit Zahlen und
ist der dritte Schritt, dessen Fehlen der ursprüngliche Fehler war.

## Entscheidung 3: Vier Abschriften, eine Migration

Das Sichtbarkeitsprädikat liegt an vier Stellen. Am PROD-Katalog abgezählt statt
aus den Migrationen geschätzt, weil Migrations-Archäologie eine überschriebene
Fassung für lebendig halten kann:

```sql
select … from pg_policy … where pg_get_expr(polqual, polrelid) like '%has_level%'
union all
select … from pg_proc … where pg_get_functiondef(oid) like '%has_level(4)%'
```

Ergebnis: Policy `posts_select_by_visibility` und die Funktionen
`post_engagement_counts`, `post_media_lesbar`, `former_member_entries`. Die
weiteren `has_level`-Policies (`offers_select`, `needs_select`, `interests_select`,
`profile_badges_select`, `profiles_select_self_or_discover`, `theme_scores_select`)
tragen **keinen** `members`-Zweig — sie sind die `discover`-Gates des Verzeichnisses
und bleiben.

**Alle vier in einer Migration**, weil sie eine Aussage sind. Drei zu ändern und
eine zu vergessen ergäbe einen Feed, dessen Bilder oder Zähler nicht zu seinen
Zeilen passen — und das sähe aus wie ein Bug in der Oberfläche.

**`feed_tag_counts` und `feed_top_authors` werden nicht angefasst.** Sie laufen
`security invoker` und tragen bewusst keine Abschrift; sie folgen der Policy von
selbst. Das ist der Beleg für die Regel in `community-feed`, dass eine Abschrift
Aufwand für ein Ergebnis ist, das ohne sie schon stimmt — und es ist der Grund,
warum diese Änderung vier statt sechs Stellen kostet.

## Entscheidung 4: `requiresAuth`, nicht `minTier`

Der Handoff notierte „`/aktivitaet` trägt kein `minTier`" als Lücke. Nach AGE-601
wäre ein `minTier` aber **falsch**: der Feed ist dann für jedes aktivierte
Mitglied gefüllt, und eine Stufenwand davor nähme genau das zurück, was
entschieden wurde.

Was wirklich fehlt, ist `requiresAuth: true` — die Fläche setzt ein Konto voraus
und hat für Ausgeloggte nichts. Damit ist auch die Reihenfolge im PR wichtig: das
Nav-Feld ist erst nach der RLS-Änderung richtig, nicht davor.

## Zwei Migrationen, nicht eine

Ein Rechte-Entzug und eine Sichtbarkeits-Ausweitung ziehen in entgegengesetzte
Richtungen. Getrennt gehalten bleibt jede für sich zurücknehmbar, falls eine der
beiden in PROD unerwartet wirkt. Ein gemeinsamer PR ist Donalds ausdrückliche
Vorgabe; getrennte Migrationen sind der Preis, der das trotzdem beherrschbar hält.

## Risiken

- **Der Feed füllt sich schlagartig für alle aktivierten Konten.** Das ist die
  Absicht, aber es ist auch der Moment, in dem Inhalte sichtbar werden, die unter
  der Annahme „nur ab `exchange`" geschrieben wurden. Donald hat den Preis benannt
  und angenommen.
- **`posts_select_by_visibility` wird je Zeile ausgewertet.** Der Wegfall von
  `has_level(4)` macht das Prädikat **billiger**, nicht teurer — ein
  `SECURITY DEFINER`-Aufruf je `members`-Zeile entfällt. Die offene Frage zu den
  RLS-Kosten wird davon entschärft, nicht verschärft.
- **Eine Sonde ohne Gegenprobe hat in diesem Change schon einmal das Falsche
  belegt.** Die erste Messung zu `fbc_profile_search_doc` lief als
  `authenticated` ohne JWT-Claims; ihr `UPDATE` traf unter RLS null Zeilen und
  bestand deshalb scheinbar. Jede Sonde hier zeigt zuerst, dass sie ausschlägt.
- **Die Gegenprobe im pgTAP-Test erteilt kurzzeitig ein Recht.** Sie läuft in der
  Test-Transaktion und wird zurückgerollt; sie darf **nicht** gegen eine echte
  Instanz laufen.
