## 1. Messen, bevor gebaut wird

Diese Gruppe schreibt keinen Produktionscode. Sie beantwortet die zwei Fragen aus
`design.md` §Open Questions, die über das Werkzeug entscheiden — und wird
**vollständig** vor Gruppe 2 abgeschlossen. Ein Entwurf, der am Pooler scheitert,
scheitert lieber vor der ersten Zeile.

- [ ] 1.1 Auflösen, worauf `SUPABASE_DB_URL_PROD` und `SUPABASE_DB_URL_DEV`
      zeigen: Host, Port, Benutzername. Festhalten, ob es die Pooler-Form
      (`postgres.<ref>`, Port 6543) oder eine direkte Verbindung ist
- [ ] 1.2 `pg_dump --schema-only --table=public.profiles` gegen **PROD** laufen
      lassen — der billigste Vollbeweis, dass `pg_dump` diese Verbindung trägt.
      Rein lesend. Scheitert es, ist `supabase db dump` der Ersatz, und die
      folgenden Aufgaben nennen dieses Werkzeug
- [ ] 1.3 Serverversion beider Projekte lesen (`show server_version`) und gegen
      `pg_dump 18.4` stellen. Neueres `pg_dump` gegen älteren Server ist der
      unterstützte Fall — belegen, nicht unterstellen
- [ ] 1.4 Prüfen, ob `pg_dump` das `auth`-Schema mit den gegebenen Rechten
      ausliest. Fällt es aus, trägt der Entwurf nicht: `auth.users` ist der
      Anker, ohne den kein Konto anmeldefähig ist
- [ ] 1.5 **Donald fragen**, ob die 21 Feedback-Zeilen auf DEV den Ersatz
      überleben sollen. Bis zur Antwort führt der Entwurf sie nicht im
      geschützten Bestand
- [ ] 1.6 Zeilenzahlen aller Tabellen und Objektzahlen aller vier Buckets auf
      **beiden** Seiten festhalten — das ist der Vorher-Stand, gegen den
      Aufgabe 5.2 misst

## 2. Der Wächter, vor allem anderen

Erst die Absicherung, dann das Werkzeug. Ein Spiegel, dessen Zielprüfung
nachgereicht wird, hat ein Zeitfenster, in dem ein Tippfehler PROD leert.

- [ ] 2.1 RED: Test, dass ein Lauf mit der **PROD**-Kennung im
      Ziel-Benutzernamen abbricht, bevor er schreibt
- [ ] 2.2 GREEN: Kennung aus dem Benutzernamen (`postgres.<ref>`) gegen eine
      feste Allowlist prüfen — **nicht** gegen den Host, der ist regionsweit
      gleich
- [ ] 2.3 Test: Quelle und Ziel mit demselben Host, aber verschiedenen
      Kennungen werden auseinandergehalten
- [ ] 2.4 Test: die Richtung ist fest verdrahtet — es gibt keinen Schalter, der
      PROD zum Ziel macht

## 3. Auszug und Ablage

- [ ] 3.1 Ablageort ausserhalb des Arbeitsbaums festlegen; Auszug mit Rechten
      `0600` schreiben
- [ ] 3.2 RED: ein Ablageort **innerhalb** des Arbeitsbaums wird abgelehnt,
      nicht beschrieben
- [ ] 3.3 Auszug aus PROD in zwei Teilen — `auth.users` und `public` getrennt.
      Getrennt, weil Gruppe 4 sie in verschiedenen Schritten zurückspielt
- [ ] 3.4 Test: bricht das Erzeugen des Auszugs ab, ist gegen DEV **kein**
      schreibender Befehl abgesetzt worden
- [ ] 3.5 Objekte der vier Buckets aus PROD in die Ablage holen, je Bucket
      getrennt; fehlendes Objekt bricht ab, statt still zu fehlen
- [ ] 3.6 Test: `git status --porcelain --ignored` meldet nach einem Lauf keine
      neue Datei

## 4. Ersetzen

Reihenfolge nach `design.md` §Decisions 2. Schritt 4.4 ist der Kunstgriff — die
vom Trigger erzeugten Zeilen werden weggeräumt, **nachdem** er gefeuert hat.

- [ ] 4.1 `auth.users` in DEV leeren (kaskadiert in `public.profiles`)
- [ ] 4.2 `public`-Tabellen leeren, Buckets leeren
- [ ] 4.3 `auth.users` zurückspielen — `on_auth_user_created` feuert und legt
      Profilzeilen mit `tier = 'discover'` an. Erwartet, nicht verhindert
- [ ] 4.4 `truncate public.profiles cascade` — räumt genau diese Zeilen weg.
      Test, der belegt, dass `auth.users` dabei unberührt bleibt: der
      Fremdschlüssel zeigt von `profiles` auf `users`, nicht umgekehrt
- [ ] 4.5 `public` zurückspielen
- [ ] 4.6 Objekte in die vier Buckets schreiben, **`upsert: false`** — in
      privaten Buckets verlangt `ON CONFLICT` ein Leserecht, das für ein noch
      unverknüpftes Objekt verweigert wird
- [ ] 4.7 Nachbereitung: `staff_roles` aus `supabase/seed/admin_roles.sql` und
      die drei `@fbcdemo.com`-Zugänge herstellen — **herstellen, nicht
      aussparen** (§Decisions 3)
- [ ] 4.8 Test: die drei Zugänge sind nach dem Lauf anmeldefähig. Nicht „die
      Zeile existiert" — `last_sign_in_at` ist die belastbare Sonde, ein
      bcrypt-Hash entsteht auch ohne Passwort

## 5. Einmal echt laufen lassen

- [ ] 5.1 `pnpm sync:dev` in `package.json` eintragen und einmal gegen DEV
      ausführen
- [ ] 5.2 Gegen den Vorher-Stand aus 1.6 messen: Zeilenzahl je Tabelle und
      Objektzahl je Bucket in DEV **gleich PROD**. Gemessen, nicht behauptet
- [ ] 5.3 **Zweimal** laufen lassen; nach dem zweiten Lauf dieselben Zahlen wie
      nach dem ersten
- [ ] 5.4 Sichtprobe in der laufenden lokalen Oberfläche: fünf echte Profile mit
      Bild, Anschrift und Netzwerken. Grüne Tests haben hier schon einmal ein
      sichtbar falsches Ergebnis durchgewunken
- [ ] 5.5 Belegen, dass der Auszug aus 3.3 nach dem Lauf noch liegt und
      vollständig ist — er ist Schritt 1 des PROD-Neuaufbaus

## 6. Abschluss

- [ ] 6.1 `pnpm test`, `pnpm typecheck`, `pnpm lint` grün
- [ ] 6.2 `docs/supabase-environments.md` um den Spiegel ergänzen; in
      `docs/prod-neuaufbau-plan.md` Schritt 1 von „zu schreiben" auf das
      entstandene Werkzeug umstellen
- [ ] 6.3 Diff-Review durch zwei Prüfer anderer Hersteller
- [ ] 6.4 `openspec archive` — erst wenn 5.3 und 5.4 gemessen sind, nicht wenn
      der Code existiert
- [ ] 6.5 AGE-576 in Linear auf Done — vorher `get_issue` lesen, die
      Automation schaltet bei PR-Merge womöglich schon selbst
