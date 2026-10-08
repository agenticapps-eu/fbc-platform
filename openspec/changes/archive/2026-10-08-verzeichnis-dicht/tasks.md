# Tasks — die Mitgliederliste lässt sich nicht mehr am Verzeichnis vorbei abholen

## 1. Den heutigen Zustand festnageln, bevor er sich ändert

- [x] 1.1 Die drei „OFFEN"-Zusagen in `supabase/tests/rechte_v5_test.sql`
      umdrehen — sie halten heute ausdrücklich fest, dass Rang 4 `profiles`
      und Rang 3/4 `profiles_public` ohne Filter lesen. **Das ist das RED
      dieses Changes.**
- [x] 1.2 Neue Zusagen für die fünf Ersatzfunktionen, je Rang: `mein_profil`,
      `meine_stufe`, `profil_karten`, `gespraechspartner_karten`,
      `profil_detail`.
- [x] 1.3 Die Zusage, die der Umstellung von `search_directory` auf DEFINER
      gilt: ein Konto **unterhalb** von Rang 4, das durch das Tor kommt (also
      über den Selbst-Zweig), lernt **keine fremden** `competencies` — die
      Maskierung hängt dann allein an der `where`-Klausel.
- [x] 1.4 Die Zusage für `feed_top_authors`: sie liefert nach dem Entzug
      weiterhin Namen, und nur an aktivierte Aufrufer.
- [x] 1.5 Die Zusage für den Chat: ein Profil mit `is_public = false`, mit dem
      der Aufrufer einen Faden teilt, kommt über `gespraechspartner_karten`
      **mit** Namen zurück — und über `profil_karten` **nicht**. Das ist der
      Unterschied, den Messung 4 gefunden hat.
- [x] 1.6 Die Zusage für die Schreibwege: nach dem Entzug hält `authenticated`
      **weder** `select` **noch** `update` auf `profiles`, und ein Speichervorgang
      gelingt trotzdem — über die neuen Funktionen. Dazu die Zusage, dass die
      Rolle `profiles` auch nicht mehr **zählen** kann (`select count(*)`), denn
      genau das wäre der Rückweg über ein spaltenweises `select(id)`.
- [x] 1.6b `supabase/tests/grants_test.sql` nachziehen: Zeile 90/91 (die beiden
      entzogenen Grants) und Zeile 184 (die 17 `update`-Spalten). Der
      Schnappschuss ist ein Wächter, kein Hindernis — er soll die Änderung
      **zeigen**, nicht sie durchwinken.
- [x] 1.7 `anon`: die Sonde in `src/test/anon-sonde.ts` nachziehen; sie führt
      `profiles_public` und muss nach dem Entzug etwas anderes erwarten.
- [x] 1.8 pgTAP laufen lassen und RED belegen (Ausgabe lesen, nicht annehmen).

## 2. Die Migration

> **Eine neue Datei, nie eine bestehende ändern.** Entzug und Ersatz stehen in
> **derselben** Migration: ein Zwischenzustand, in dem das Leserecht weg und die
> Funktion noch nicht da ist, wäre ein Ausfall des Verzeichnisses.

- [x] 2.1 `mein_profil()` — `returns setof public.profiles`, DEFINER,
      `search_path = ''`, `where id = (select auth.uid())` **und die
      Lebenszyklus-Prüfungen** (`is_activated()`, `activated_at is not null`,
      `disabled_at is null`, `deleted_at is null`). Eine DEFINER-Funktion erbt
      kein Prädikat; was die RLS ihr abgenommen hat, muss sie mitbringen.
- [x] 2.2 `meine_stufe()` — `(tier text, level_rank integer)`, ersetzt die
      Einbettung `membership_tiers(level_rank)` in `AuthProvider`.
- [x] 2.3 `profil_karten(p_ids uuid[])` — die zehn Felder der Sicht, deren
      Prädikat unverändert, `resolve_display_name` **aufgerufen**, nicht kopiert.
- [x] 2.4 `gespraechspartner_karten(p_ids uuid[])` — dieselben Felder, ohne
      `is_public`, nur für Profile mit gemeinsamem Gesprächsfaden.
- [x] 2.5 `profil_detail(p_id uuid)` — die erweiterten Felder eines fremden
      Profils, mit dem heutigen Gate `has_level(4)`.
- [x] 2.6 Obergrenzen auf den beiden Stapelfunktionen — im Kopf **als
      Betriebsmittel** benannt, ausdrücklich nicht als Zugriffsschutz.
- [x] 2.7 `search_directory` auf `SECURITY DEFINER` umstellen, mit dem Grund im
      Kopf.
- [x] 2.8 `feed_top_authors` **bleibt `SECURITY INVOKER`** und bekommt nur die
      Namensauflösung über `profil_karten`. Sie zählt `posts` unter den Rechten
      des Aufrufers; als DEFINER zählte sie auch terminierte und verborgene
      Beiträge. Das Sichtbarkeits-Prädikat der Beiträge wird **nicht** in die
      Funktion kopiert — eine Kopie läuft auseinander.
- [x] 2.9 `revoke select on public.profiles from authenticated` und dasselbe
      für `public.profiles_public`, **dazu die 17 Spalten-Grants für `update`**.
      **Alle vier Rollen namentlich nennen** (`public, anon, authenticated,
    service_role`) — frische Instanzen vergeben rollenspezifisch, ein
      `revoke … from public` entfernt dort nichts.
      **KEIN `grant select (id)` als Ausweg** — gemessen stellt es die
      Aufzählbarkeit wieder her.
- [x] 2.9b Vier Schreibfunktionen, je eine pro Schnitt, mit benannten Parametern
      statt einem `jsonb`-Beutel: Entwicklungsschwerpunkt (`compass`),
      Verzeichnis-Sichtbarkeit (`member-settings`), Profil speichern
      (`profile.ts`), Onboarding-Felder (`member-onboarding`). Jede mit
      `where id = (select auth.uid())` und den Lebenszyklus-Prüfungen.
- [x] 2.10 `grant execute` auf die fünf neuen Funktionen an `authenticated`,
      davor `revoke … from public, anon, authenticated, service_role`.
- [x] 2.11 `comment on function` für jede neue Funktion: was sie ersetzt und
      welches Prädikat sie trägt.

## 3. Die Abfragestellen — 19, einzeln

- [x] 3.1 `providers/AuthProvider.tsx:169` → `meine_stufe()`. **Die Einbettung
      entfällt**; damit auch die Falle, dass eine Einbettung ohne Grant die
      ganze Abfrage mit 401 killt.
- [x] 3.2 `lib/dashboard.ts:220` und `lib/profile.ts:197` → `mein_profil()`.
- [x] 3.3 `lib/compass.ts:295`, `lib/member-settings.ts:174`,
      `lib/member-onboarding.ts:36` → `mein_profil()`.
- [x] 3.4 `lib/chat.ts:317` → `gespraechspartner_karten()`. **Nicht**
      `profil_karten` — den Grund trägt der Kommentar an der Stelle selbst.
- [x] 3.5 `lib/public-profile.ts:97` → `profil_karten`, `:102` →
      `profil_detail`.
- [x] 3.6 Die sechs übrigen Stellen auf der Sicht: `lib/matching-hub.ts:189`,
      `lib/contact-requests.ts:137`, `lib/feed.ts:516`, `lib/events.ts:345`,
      `:521`, `:552` → `profil_karten()`.
- [x] 3.7 Die vier Schreibstellen (`compass:270`, `member-settings:213`,
      `profile.ts:344`, `member-onboarding:54`) auf die neuen Funktionen
      umstellen. **Nicht** nur die `.select()`-Ketten auflösen — das war der
      widerlegte Entwurf.
- [x] 3.7b `supabase/functions/create-checkout-session/index.ts:58` →
      `meine_stufe()`. Dieselbe Einbettung wie `AuthProvider`, derselbe Ersatz.
      Stripe ist ruhend; das ist ein Grund, ruhig nachzuziehen, und keiner,
      auszulassen.
- [x] 3.8 `src/lib/database.types.ts` von Hand nachziehen — die fünf neuen
      Funktionen. **`gen types` NIE darüberlaufen lassen.**
- [x] 3.9 Gegenzählen über **beide** Wurzeln: kein `from("profiles")` und kein
      `from("profiles_public")` mehr in `src/` **noch** in `supabase/functions/`,
      ausser in Tests und `src/vision/`. Das Zählen über nur eine Wurzel ist der
      Fehler, den die Plan-Review hier gefunden hat.

## 3c. Die Verkopplung mit AGE-1004 aufloesen

> Befund der Plan-Review zu AGE-1004 (codex, HIGH). Diese Migration traegt einen
> **vollstaendigen** `create or replace` von `feed_top_authors`. AGE-1004 ist am
> 07.10. gemerged und hat derselben Funktion einen `kind`-Filter gegeben. Ohne
> Nacharbeit nimmt diese Datei ihn auf PROD **lautlos** wieder weg.

- [x] 3c.1 `origin/main` in den Branch mergen.
- [x] 3c.2 Die Migration umhaengen: `20261003160000` -> `20261008090000`, also
      NACH AGE-1004. Grund: CI baut frisch auf und spielt nach Zeitstempel ein,
      PROD in der Reihenfolge der Merges — ein Test im Neuaufbau kann den
      PROD-Fall gar nicht sehen. Erlaubt, weil die Datei nirgends ausser auf dem
      geteilten lokalen Stack eingespielt war.
- [x] 3c.3 Den Filter `kind in ('member', 'event')` in den Rumpf uebernehmen,
      samt Begruendung im Kopf.
- [x] 3c.4 Den geteilten Stack ausrichten: Historie auf die neuen Nummern, den
      Endzustand der Funktion einspielen. In EINER Transaktion.
- [x] 3c.5 **Richtung 1 (Hochruesten) gemessen**: ein Stand mit AGE-1004 bekommt
      diese Migration nachgereicht — die Funktion traegt danach Filter UND
      `profil_karten`. 43 Dateien, 1531 Zusagen, gruen.
- [ ] 3c.6 **Richtung 2 (Neuaufbau)**: CI baut aus leer. Ergebnis im PR
      festhalten, nicht annehmen.

## 4. Nachweisen

- [x] 4.1 pgTAP grün, volle Vitest-Suite, `lint`, `typecheck`, `build`. Nach dem
      Build und vor jedem `git add`:
      `git checkout -- src/content/release-entries.generated.ts`.
- [x] 4.2 **Integrationsbeleg gegen den lokalen Stack mit echten JWTs**: je ein
      Konto auf Rang 3, 4, 5 und 6 durch PostgREST. Pro Rang: `profiles` und
      `profiles_public` direkt (muss scheitern), die fünf Funktionen,
      `search_directory`, `feed_top_authors`. Das ist die Naht, die weder pgTAP
      noch vitest abdeckt.
- [x] 4.3 **Der Datenverlust-Pfad**: ein Profil speichern und nachmessen, dass
      die Änderung wirklich steht. `try_as(...) = 'OK'` belegt bei UPDATE
      nichts — null getroffene Zeilen sind kein Fehler.
- [x] 4.4 Sichtprobe: Feed-Seitenleiste („Die aktivsten Mitglieder"), ein
      Gesprächsfaden mit einem zurückgezogenen Profil, ein fremdes Profil,
      der Profil-Editor. Zählstände vorher/nachher, `.env.local` löschen.
      **Alle vier gesehen**, alle Netzaufrufe 200. Der Faden zeigt den Namen
      des zurückgezogenen Partners — der Unterschied, für den
      `gespraechspartner_karten` existiert. Der Editor hat über die Oberfläche
      geschrieben und die Datenbank trägt es (`profile_completion` 16 → 41).
      **Eine Falle dabei:** `pnpm dev` ist `infisical run --env=dev -- vite` —
      die DEV-Secrets aus der Prozessumgebung schlagen jede `.env.local`, und
      die erste Anmeldung ging an DEV statt an den lokalen Stack. Gegen den
      lokalen Stack gehört `npx vite` ohne Infisical.
- [x] 4.5 Zahlen vor und nach der Migration auf dem lokalen Stack
      protokollieren — der Stack ist geteilt.
- [x] 4.6 **Die Probe zu gemini's Fremdschlüssel-Befund**: in eine Tabelle
      schreiben, die auf `profiles(id)` verweist, nachdem `select` entzogen ist.
      Erwartung: gelingt, weil die FK-Prüfung eine Systemprüfung ist und nicht
      an den Rechten des Schreibenden hängt. Eine Annahme, die man messen kann,
      soll man messen.
- [x] 4.7 Belegen, dass `feed_top_authors` **keine** terminierten Beiträge
      mitzählt — die Zusage, die ihren Verbleib als INVOKER begründet.

## 5. Abschliessen

- [x] 5.1 ADR in `docs/decisions/` — Nummer eins über der höchsten dort
      vorhandenen, erst `ls`.
- [ ] 5.2 `REVIEWS.md` mit **zwei** Fremdreviewern verschiedener Anbieter.
      Schema, Rechte, Sicherheit — Donalds Regel vom 26.08. greift hier.
- [ ] 5.3 Code-Review auf dem Diff.
- [ ] 5.4 Befunde abarbeiten.
- [ ] 5.5 `openspec validate --all` grün.
- [ ] 5.6 Vorab-Sonde auf den Neuigkeiten-Eintrag **vor** dem Archivieren.
- [ ] 5.7 Archivieren, `pnpm release:entries`, Diffgrösse messen.
- [ ] 5.8 PR. **In den Text: nach dem Merge blockt `drift-gate` jeden Deploy,
      bis `migrate-prod` dispatcht und der Lauf mit `gh run rerun --failed`
      wiederholt ist.**
