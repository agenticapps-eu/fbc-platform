# Design — die Mitgliederliste lässt sich nicht mehr am Verzeichnis vorbei abholen

## Das Gelände, gemessen statt übernommen

Der Vorgang beschreibt den Umbau als „zwanzig Abfragestellen, alle schon
kennungsgebunden, mechanisch". Fünf Messungen gegen PROD und den Quellbaum,
**vier davon gegen diese Beschreibung**:

### 1. Es sind 20 Stellen — aber nicht die 20 des Vorgangs

Auf `profiles` sind es in `src/` **12**, nicht 13 — gezählt ohne Tests und ohne
`src/vision/` (toter Code, verfälscht jede grep-Zählung). Auf `profiles_public`
sind es 7, wie angegeben. Gegengeprüft auf einfache Anführungszeichen,
Template-Literale und Variablen: keine weiteren. `lib/public-profile.ts` steht
in **beiden** Listen.

**Und eine zwanzigste ausserhalb von `src/`, gefunden erst von der Plan-Review:**
`supabase/functions/create-checkout-session/index.ts:58` liest `profiles` mit dem
Token des Aufrufers, **mit derselben Einbettung** `membership_tiers(level_rank)`
wie `AuthProvider`. Nach dem Entzug antwortete es `profile_lookup_failed` (500).

Dass die Zahl damit wieder bei 20 landet, macht die erste Zählung nicht
richtig — sie hat eine **andere** Stelle übersehen als der Vorgang. Die Lehre
steht in der Anweisungsdatei dieses Rechners und ist hier noch einmal
eingetreten: die Ebenen zu nennen genügt nicht, man muss die **Wurzeln** nennen.
Hier waren es `src/` **und** `supabase/functions/`.

### 2. Die Grants sind spaltenweise, und die übliche Sicht verschweigt das

`information_schema.role_table_grants` meldet für `profiles` genau
`authenticated: SELECT`. Das liest sich wie „der Client kann nicht schreiben" —
und widerspricht vier `.update()`-Aufrufen. `role_column_grants` löst es auf:

| Rolle           | Recht  | Spalten                                                                             |
| --------------- | ------ | ----------------------------------------------------------------------------------- |
| `authenticated` | SELECT | 32 (alle)                                                                           |
| `authenticated` | UPDATE | **17** (`avatar_url`, `name`, `is_public`, `goals`, `interests`, `competencies`, …) |

Ein spaltenweiser Grant erscheint in `role_table_grants` **gar nicht**. Wer nur
sie liest, plant auf einer falschen Annahme.

### 3. Die Lesestellen haben VIER Formen, nicht eine

| Form                        | Stellen                                                                          | Was gelesen wird                                                         |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| eigene Zeile, schmal        | `AuthProvider:169`, `compass:295`, `member-settings:174`, `member-onboarding:36` | 1–3 Spalten                                                              |
| eigene Zeile, breit         | `dashboard:220` (18 Spalten), `profile.ts:197` (`select("*")`)                   | fast alles                                                               |
| fremde Karten               | `chat.ts:317`                                                                    | `id, name, avatar_url, company, tier`                                    |
| fremde Zeile, **erweitert** | `public-profile.ts:102`                                                          | `headline, branche, member_since, potential_score, competencies, videos` |

Eine einzige Ersatzfunktion deckt das nicht ab. Besonders die letzte Form hat
heute eine eigene Schwelle: **jedes Konto ab Rang 4** liest die erweiterten
Felder **jedes** Profils. Wer sie in eine Karten-Funktion faltet, ändert
Verhalten über den Auftrag hinaus.

### 4. `chat.ts` liest die Tabelle ABSICHTLICH, nicht die Sicht

Im Code steht die Begründung: die Chat-Route gibt jede Profilzeile frei, „so
sieht man den Namen eines freigegebenen Kontakts auch dann, wenn dieser sein
Profil NICHT öffentlich gestellt hat (`profiles_public` filtert
`where is_public`)".

**Das ist die Falle dieses Changes.** Eine Ersatzfunktion, die das Prädikat der
Sicht übernimmt, lässt im Chat **Namen verschwinden** — und zwar ausschliesslich
bei den Mitgliedern, die sich aus dem Verzeichnis zurückgezogen haben. Ein
Fehler, der in keinem Test auffällt, weil Testkonten öffentlich sind, und der
genau die Gruppe trifft, die am wenigsten damit rechnet.

### 5. Es sind ZWEI Funktionen, die der Entzug trifft, nicht eine

Der Vorgang nennt `search_directory`. Über den gesamten Funktionskatalog von
PROD gefragt — welche Funktion liest `profiles_public` **und** läuft als
`SECURITY INVOKER` — kommen **zwei** zurück:

| Funktion               | `prosecdef` | ausführbar von  | liest                 |
| ---------------------- | ----------- | --------------- | --------------------- |
| `search_directory`     | `false`     | `authenticated` | Sicht **und** Tabelle |
| **`feed_top_authors`** | `false`     | `authenticated` | Sicht                 |

`feed_top_authors` zeichnet „Die aktivsten Mitglieder" in der Feed-Seitenleiste.
Ohne Nachzug **bricht sie in dem Moment, in dem die Migration läuft** — für
jedes Mitglied, auf der meistbesuchten Seite.

Die übrigen 41 Funktionen, die `profiles` anfassen, sind bereits
`SECURITY DEFINER` und damit unberührt. `recompute_potential_score` liest die
Sicht ebenfalls, ist aber DEFINER. Diese Zahl ist der eigentliche Wert der
Messung: der Entzug trifft **genau zwei** Stellen, und beide sind benannt.

## Entscheidung 1 — vier Funktionen, nicht eine

Weil die Lesestellen vier Formen haben und zwei davon eigene Prädikate tragen,
bekommt jede Form ihre eigene Funktion. Alle `SECURITY DEFINER` mit
`set search_path = ''`, alle `revoke execute … from public, anon, authenticated,
service_role` und danach `grant execute … to authenticated` — vier Rollen
nennen, weil frische Supabase-Instanzen rollenspezifisch vergeben und ein
`revoke … from public` dort nichts entfernt.

| Funktion                      | ersetzt                                                       | Prädikat                                                 |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `mein_profil()`               | die 6 Stellen auf der eigenen Zeile                           | `id = auth.uid()` **plus die Lebenszyklus-Prüfungen**    |
| `meine_stufe()`               | die Einbettung in `AuthProvider` **und** in der Edge Function | dasselbe, aber nur `tier` und `level_rank`               |
| `profil_karten(p_ids uuid[])` | die 7 Stellen auf der Sicht                                   | das Prädikat der Sicht, unverändert                      |
| `profil_detail(p_id uuid)`    | `public-profile.ts:102`                                       | heutiges Gate: `has_level(4)` plus die Zeilenbedingungen |

**Die Lebenszyklus-Prüfungen gehören in JEDE Funktion, und das ist ein Befund
der Plan-Review.** Die abgelöste Policy lautet vollständig
`is_activated() and activated_at is not null and disabled_at is null and
deleted_at is null and (id = auth.uid() or has_level(4))`. Ein `mein_profil()`
mit `id = auth.uid()` allein gäbe einem gesperrten oder gelöschten Konto seine
Zeile zurück — eine **Ausweitung** gegenüber heute, in einem Change, der
schliessen soll. Eine DEFINER-Funktion erbt kein Prädikat; sie muss jedes
mitbringen, das die RLS ihr abgenommen hat.

**`mein_profil()` gibt `setof public.profiles` zurück**, also alle Spalten. Das
ist keine Ausweitung: der Eigentümer liest sie heute ohnehin alle. Es erspart
eine Spaltenliste, die bei jeder Schemaänderung nachgezogen werden müsste — und
eine vergessene Spalte wäre ein stiller Datenverlust im Profil-Editor
(`select("*")`).

**`meine_stufe()` ist die Antwort auf die Einbettung.** `AuthProvider` liest
heute `tier, membership_tiers(level_rank)`; eine Einbettung braucht ein
Leserecht auf der eingebetteten Relation, und eine Einbettung **ohne** Grant
killt die ganze Abfrage mit 401, nicht nur den eingebetteten Teil. Mit einer
Funktion entfällt die Einbettung. Dass sie schmal ist, ist kein Zufall: sie
läuft bei **jedem** Sitzungsstart, und `mein_profil()` zöge dort 32 Spalten.

**Verworfen: `mein_profil()` auch für `AuthProvider`.** Spart eine Funktion,
kostet 32 Spalten auf dem kritischsten Pfad der Anwendung.

**Verworfen: eine einzige `profil_karten(ids)` für alles.** Sie müsste vier
Prädikate in sich tragen und je nach Aufrufer verschieden breit antworten. Eine
Funktion, die still unterschiedlich viel herausgibt, ist die schlechtere Form
desselben Problems, das dieser Change schliesst.

## Entscheidung 2 — der Chat bekommt eine eigene Funktion, keine Erweiterung

`gespraechspartner_karten(p_ids uuid[])`: dieselben Kartenfelder wie
`profil_karten`, aber **ohne** `is_public` — dafür nur für Profile, mit denen
der Aufrufer einen Gesprächsfaden teilt. Das Prädikat ist die Berechtigung.

**Verworfen: `profil_karten` um `or exists(gemeinsamer Faden)` erweitern.** Dann
gäbe eine Funktion je nach Aufrufer verschieden viel heraus, und wer sie liest,
müsste die Chat-Beziehung mitdenken, um zu wissen, was sie tut. Zwei Funktionen
mit je einem Prädikat sind länger und lesbarer, und der Unterschied zwischen
„öffentlich" und „mein Gesprächspartner" ist genau der, den dieser Change
sichtbar machen soll.

**Verworfen: den Chat auf `profil_karten` umstellen und den Unterschied
hinnehmen.** Das wäre der stille Namensverlust aus Messung 4.

## Entscheidung 3 — `search_directory` und `feed_top_authors` werden DEFINER

Beide, nicht nur die erste. Ohne das ist der Entzug ein Ausfall.

**Was sich dabei verschiebt, und warum es Zusagen braucht:**
`search_directory` liest heute `profiles_public` (RLS-frei) **und**
`left join public.profiles p` (RLS-gefiltert). Als INVOKER maskiert die RLS die
erweiterten Spalten für jeden unterhalb von Rang 4. Als DEFINER tut sie das
nicht mehr — die Maskierung hängt dann **allein am Eintrittstor** der Funktion.

Das Ergebnis bleibt gleich, aber aus einem anderen Grund: wer durch das Tor
kommt, hat Rang 6 und damit auch Rang 4; und der Selbst-Zweig liefert nur die
eigene Zeile. Dass das Ergebnis gleich bleibt, ist nach der Umstellung aber
**keine Eigenschaft der Datenbank mehr, sondern eine Eigenschaft dieser einen
`where`-Klausel** — und das gehört als Zusage festgenagelt, nicht als Kommentar.

**`feed_top_authors` bleibt dagegen `SECURITY INVOKER`** — berichtigt nach der
Plan-Review. Sie zählt `public.posts` unter den Rechten des Aufrufers; als
DEFINER zählte sie auch, was er nicht sehen darf, insbesondere terminierte
Beiträge (`veroeffentlicht_ab`). Codex schlägt vor, das Sichtbarkeits-Prädikat
in der Funktion nachzubauen — das wäre eine **Kopie einer Policy**, und Kopien
laufen auseinander.

Stattdessen trennen wir die beiden Hälften: das **Zählen** bleibt beim Aufrufer,
nur die **Namensauflösung** geht über `profil_karten`. Der Entzug trifft dann
genau die Stelle, die er betreffen soll, und die Beitrags-Sichtbarkeit bleibt
dort, wo sie definiert ist.

## Entscheidung 4 — die vier Schreibwege wandern in Funktionen

> **Diese Entscheidung ersetzt eine frühere, die der Plan-Review widerlegt hat.**
> Sie lautete: „die Spalten-Grants bleiben, nur die `.select()`-Ketten werden
> aufgelöst". Sie war falsch, und zwar messbar falsch.

Codex' Befund: `update … where id = $1` braucht `select` auf die Spalten, die
in der WHERE-Klausel gelesen werden. Der Entzug bricht also den **Schreibvorgang
selbst**, nicht nur dessen Rückgabe.

Gegen den lokalen Stack gemessen — eigene Rolle, eigenes Schema, Transaktion mit
`rollback`:

| Lage                                                               | Ergebnis                                    |
| ------------------------------------------------------------------ | ------------------------------------------- |
| nur `grant update (wert)`, kein `select`: `update … where id = $1` | **verweigert**                              |
| dasselbe `update` **ohne** WHERE                                   | gelingt — die WHERE-Klausel ist die Ursache |
| zusätzlich `grant select (id)`: das `update`                       | gelingt                                     |
| … und dann `select count(*)`                                       | **liefert alle Zeilen**                     |

Die letzte Zeile schliesst den naheliegenden Ausweg aus. Ein spaltenweises
`select(id)` repariert das Schreiben und stellt zugleich die **Aufzählbarkeit**
wieder her: unter der heutigen Rang-4-Policy bekäme ein Clubmitglied wieder jede
Kennung — und Kennungen sind genau das, was `profil_karten` einlöst. Der Change
hätte sein eigenes Ziel verfehlt und dabei grün ausgesehen.

**Also: die vier Schreibstellen wandern in `SECURITY DEFINER`-Funktionen**, je
eine pro Schnitt, jede mit `where id = (select auth.uid())` und den
Lebenszyklus-Prüfungen. Die Spalten-Grants für `update` werden damit
überflüssig und fallen mit.

**Verworfen: `grant select (id)` als Ausweg.** Oben gemessen.

**Verworfen: eine einzige `profil_speichern(jsonb)`.** Ein Schnitt, der alles
annimmt, ist der Weg, auf dem `saveProfile` schon einmal Interessen und Ziele
lautlos gelöscht hat. Je Schreibstelle eine Funktion mit benannten Parametern.

## Entscheidung 5 — keine Obergrenze als Sicherheitsargument

Die Stapelfunktionen bekommen eine Obergrenze aus **Betriebs**gründen (eine
Abfrage mit zehntausend Kennungen soll die Datenbank nicht beschäftigen). Sie
wird **nicht** als Sicherheitszusage geführt.

Codex' Befund aus der Plan-Review zu AGE-1000 war berechtigt: eine Zahl wie 200
begrenzt die Stapelgrösse und beweist **nichts** über die Herkunft der
Kennungen. Wer 200 auf einmal abfragen darf, darf auch fünfzig Mal 200. Was
trägt, ist die Unerratbarkeit einer UUID und dass Kennungen nur aus
erreichbaren Flächen stammen — Feed, Chat, Events, Kontaktanfragen, Vorschläge.

**Das ist die ehrliche Form der Zusage dieses Changes:** er macht aus einem
*Mengen*zugriff einen *Kennungs*zugriff. Er macht nicht aus einem Mitglied, das
sich fünfhundert Kennungen aus dem Feed zusammensucht, ein Mitglied ohne
Kennungen. Wer behauptet, danach sei „keine Liste mehr beschaffbar", hat die
Zusage überdehnt.

## Entscheidung 6 — die Namensmaskierung wandert mit, unverändert

`profiles_public` wendet `resolve_display_name(id, name)` an (AGE-291). Jede
Ersatzfunktion, die Namen ausgibt, ruft dieselbe Funktion auf — **nicht** eine
Kopie ihrer Logik. Eine zweite Fassung dieser Regel wäre die Art Kopie, die
beim nächsten Griff an die Maskierung auseinanderläuft.

## Was dieser Change NICHT tut, und was dadurch offen bleibt

`profiles_public` bleibt als **Relation** bestehen — nur das Leserecht für
`authenticated` fällt. Die DEFINER-Funktionen lesen sie weiter. Sie zu entfernen
wäre ein zweiter Umbau ohne Gewinn.

**Der Restbefund, der nach diesem Change stehen bleibt:** ein Mitglied ohne das
Verzeichnisrecht kann weiterhin Kennungen sammeln — aus dem Feed, aus Events,
aus Gesprächen — und sie stapelweise in `profil_karten` geben. Es bekommt dann
Karten zu Profilen, deren Kennungen es ohnehin schon gesehen hat. Das ist der
Unterschied zwischen „die Liste ist nicht abholbar" und „es gibt keinen Weg zu
fremden Daten", und nur das Erste wird zugesagt.

## ADR

Ja. Die Entscheidung, den Lesepfad auf `profiles` und `profiles_public` für
`authenticated` zu schliessen und durch kennungsgebundene DEFINER-Funktionen zu
ersetzen, ist schwer umkehrbar (sie bindet 19 Aufrufstellen und zwei
Funktionen um) und das Ergebnis einer echten Abwägung gegen mindestens zwei
Alternativen — eine Stufenschwelle auf der Sicht (verwirft die Zusage, dass
Namen überall sichtbar bleiben) und eine Obergrenze statt eines Entzugs
(beweist nichts). Nummer: eins über der höchsten in `docs/decisions/`.
