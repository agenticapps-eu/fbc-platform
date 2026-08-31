# Plan-Review — geplante Beiträge (AGE-667)

Zwei fremde Anbieter, direkt per Bash, `REVIEWER_TIMEOUT=900`, auf
proposal + design + Spec-Delta + tasks. **Vor der ersten Codezeile.**

| Anbieter | Verdikt |
| --- | --- |
| **opencode** | `AENDERUNG NOETIG` — 2× HOCH, 2× MITTEL, 3× NIEDRIG |
| **gemini** | `AENDERUNG NOETIG` — 2× HOCH, 2× MITTEL, 1× NIEDRIG |

## Der teuerste Fund: das siebente Tor ist ein schreibendes

**opencode, HOCH, angenommen.** Der Entwurf zählte die Tore aus dem lebenden
Katalog auf — aber nur die **lesenden**. `trg_hinweis_neuer_beitrag` feuert
`after insert on public.posts` und ruft `hinweis_rundruf('post_created', …)`
mit `autor_name` im Payload, an **jedes aktivierte Mitglied**. `notifications`
hängt an Realtime (Glocke) und seit dem 28.08. am Push-Webhook.

Ein geplanter Beitrag hätte damit **im Moment des Planens** die Glocke und das
Telefon aller Mitglieder erreicht — für etwas, das niemand sehen darf. Der
Autorenname und die Existenz wären sofort preisgegeben, der Tap führte auf
einen Deeplink mit null Zeilen.

Nachgemessen am Katalog: der Trigger steht, ist aktiv, und trägt bereits ein
frühes `return null` für `kind <> 'member'` — die Stelle für das zweite ist
vorgezeichnet.

Der Entwurf schrieb „keine Benachrichtigung beim Freischalten". Das Problem war
die Benachrichtigung **beim Planen**, und sie stand in keiner Liste.
→ Abschnitt B′ in `tasks.md`, Entscheidung 1b in `design.md`.

**Daraus folgte eine Produktfrage, die der Entwurf fälschlich als entschieden
ausgab.** Donald hat sie am 29.08. beantwortet: ein geplanter Beitrag **soll**
beim Live-Gehen ankündigen. Damit braucht die Ankündigung einen Lauf — die
Sichtbarkeit ausdrücklich nicht.

## Der zweite HOCH: der `drop` bricht Aufrufer, die keine Aufgabe nannte

**opencode, HOCH, angenommen.** Der Parameter trägt bewusst keinen
Vorgabewert; alle Sechs-Argument-Aufrufer brechen. Betroffen und in der
Flächen-Tabelle nicht genannt: `rls_test.sql` (vier Aufrufe **und** eine
`has_function_privilege`-Zusage, die die alte Signatur wörtlich nennt),
`feed_popularity_test.sql`, `feed.write.test.ts`,
`CommunityFeed.composer.test.tsx` und zwei Proben in `scripts/`.
→ Aufgabe C5.

## Angenommen, MITTEL

- **Drei bestehende Indizes hängen an `created_at`** und der Feed hat **drei**
  Ordnungen; „Beliebteste" bricht den Gleichstand über `created_at`. Der
  Entwurf entschied nur über einen *neuen* Index. → C6, C7.
- **Zwei weitere Flächen** zeigen dem Verfasser seine eigenen Beiträge nach
  Schreibdatum und **unmarkiert**: das Regal „selbst geteilt" und das
  Dashboard. → D5.

## Angenommen, NIEDRIG

- **Die Fehlerrichtung von `not null`** ist die schlechtere: `null` versagt
  *fail-closed*, `not null` *fail-open*. Die Entscheidung bleibt, die
  Begründung nennt es jetzt und verweist auf die geschlossene Tor-Liste plus
  Positivkontrolle als Gegenmittel. → Entscheidung 2.
- **Das Spalten-UPDATE-Recht erlaubt De-Publizieren** eines bereits sichtbaren
  Beitrags. Entschieden: zugelassen, mit eigener Zusage — die Anhebung gilt nur
  der Anlage. → Entscheidung 7.
- **`recompute_potential_score` zählt geplante Beiträge mit** (schwaches
  Timing-Orakel). Als bekannter Rest benannt, nicht behoben. → design.md.

## NICHT übernommen — und warum

**geminis beide HOCH-Befunde sind gegen den lebenden Katalog widerlegt.**

| Behauptung | Gemessen |
| --- | --- |
| `get_posts_for_feed` sei ein ungenanntes DEFINER-Tor, „der wichtigste und gefährlichste Befund" | **Existiert nicht.** Funktionen mit „feed" im Namen: `event_feed_post_sync`, `feed_tag_counts`, `feed_top_authors`, `admin_list_feedback` |
| `likes_write_own` prüfe nur `profile_id`, ein Loch | **Falsch.** `WITH CHECK` trägt `exists (select 1 from posts p where p.id = post_likes.post_id)` |
| `saved_posts` mit zitiertem Policy-Text | Die Tabelle heisst `post_saves`; Policy-Text erfunden |

Die drei dabei zitierten Migrationsdateien tragen **2024er** Namen; dieses Repo
hat ausschliesslich 2026er. Die Belege waren erfunden — zum dritten Mal an
diesem Abend bei diesem Anbieter.

**Ein Rest bleibt trotzdem:** `post_saves` gehört in die Erbschaftszusage. Der
Reviewer hat mit falschem Beleg auf eine richtige Stelle gezeigt. → B8.

## Eine Korrektur an der eigenen Fragestellung

Die Prüffrage 2 unterstellte, `post_likes` prüfe nur das eigene Profil und sei
ein Loch. Beide Reviewer haben daran gearbeitet, opencode hat die Prämisse
widerlegt und belegt. **Eine Frage mit falscher Prämisse zieht Reviewer-Zeit
auf ein Nicht-Problem** — und einen der beiden auf eine erfundene Antwort.

## Was der Review NICHT prüfen konnte

opencode hatte keinen Datenbankzugriff und hat aus den Migrationsdateien
rekonstruiert. Die Behauptung „gemessen aus dem lebenden Katalog" bleibt damit
von ihm unbestätigt; die Rekonstruktion deckte sich vollständig. Der Abgleich
gegen den echten Katalog ist hier von Hand nachgeholt worden — er hat geminis
Befunde widerlegt und opencodes HOCH-Befund bestätigt.

---

# Diff-Review (Schritt 4) — 29.08., nach dem Bauen

Zwei fremde Anbieter, direkt per Bash auf den fertigen Diff (3001 Zeilen,
neue Dateien per `git add -N` sichtbar gemacht — sonst prüft der Reviewer die
Hälfte).

| Anbieter | Verdikt |
| --- | --- |
| **opencode** | `AENDERUNG NOETIG` — 2× MITTEL, 2× NIEDRIG, **alle vier berechtigt** |
| **gemini** | `AENDERUNG NOETIG` — 1× HOCH (widerlegt), 1× MITTEL, 2× NIEDRIG |

## Die zwei teuersten Funde — beide von opencode, beide von mir eingebaut

**1. Das ACHTE Tor, MITTEL.** `recompute_potential_score`
(`20260807090000:96`) zählt `count(*) from public.posts where author_id = …`
ohne Zeitfilter. Gewicht 20 %, Sättigung 10 — ein einziger geplanter Beitrag
hebt den Score um rund zwei Punkte, und der Score steht Fremden über
`profiles_public` als Impact-Marke auf der Profilseite. **Ein Beobachter sieht
die Zahl springen, bevor es den Beitrag gibt.**

Der Entwurf hatte diese Funktion als „bekannten Rest" geführt und die
Entscheidung auf den nächsten Vorgang verschoben, der den Score ohnehin
anfasst. Das trägt nicht: es ist exakt die Fehlerklasse, die Tor 4 für
`post_engagement_counts` schliesst („eine Zahl für eine unsichtbare Zeile
verrät, DASS es die Zeile gibt"). **Geschlossen**, samt Zusage mit
Positivkontrolle.

**2. Jede Textkorrektur datierte einen alten Beitrag auf jetzt um, MITTEL.**
Bei einem veröffentlichten Beitrag ist das Zeitfeld im Editor leer, der Editor
schickte `null` (= „sofort"), und `updatePost` schrieb `new Date()`. „Ich habe
am Zeitpunkt nichts geändert" war von „mach ihn jetzt sichtbar" nicht zu
unterscheiden. Ein drei Monate alter, redigierter Beitrag wäre im Feed nach
oben gesprungen, hätte „vor wenigen Sekunden" getragen — und die Zeile mitten
in der Keyset-Ordnung bewegt, wo fremdes Blättern Zeilen überspringt oder
doppelt.

**Behoben mit drei Zuständen statt zwei** (`undefined` = nicht anfassen,
`null` = sofort, Wert = dieser Zeitpunkt). **Gegenprobe gemessen:** der neue
Test ist rot, sobald man auf zwei Zustände zurückstellt („expected null to be
undefined"), und grün mit der Korrektur.

## Angenommen, NIEDRIG

- **`tasks.md` C5 war abgehakt, ohne erledigt zu sein.** Drei Sonden riefen die
  RPC weiter mit sechs Argumenten (`probe-rpc-create-post.ts`,
  `probe-9-3-sichtbarkeit.ts`); PostgREST fände die Funktion nicht mehr
  (PGRST202). Kein CI-Bruch — die Sonden laufen in keinem Workflow —, aber
  beide Messwerkzeuge für den Schreibweg wären still kaputt gewesen.
  Umgestellt.

  **Warum der grüne Typlauf das nicht gefangen hat — und es ist NICHT der
  naheliegende Grund.** `tsconfig.json` schliesst `scripts` ein
  (`"include": ["src", "scripts", "vite.config.ts"]`); `tsc` sieht die Dateien.
  Es kann die Aufrufe nur nicht prüfen: die Sonden bauen ihren Client mit
  `createClient(API_URL, KEY)` **ohne das `Database`-Generic**, damit ist
  `rpc()` dort auf `string` und `any` abgebildet, und ein siebter
  Pflichtparameter fällt nirgends auf. (Hier stand zuerst „`tsc` prüft
  `scripts/` nicht mit" — eine Ursache, die ich vermutet und nicht gemessen
  hatte. Sie ist falsch.)
- **`probe-feed-cursor.ts` mass weiter über `created_at`** — eine Sonde, deren
  Kommentar „exakt die Abfrage aus src/lib/feed.ts" behauptet, über eine Spalte,
  deren Index in derselben Migration gefallen ist. Falsch beruhigende Zahlen.
  Umgestellt.
- **Keine Zusage fürs De-Publizieren** (gemini). Entscheidung 7 verlangt sie
  ausdrücklich („damit niemand später annimmt, es sei unmöglich") — sie fehlte.
  Vier Zusagen ergänzt, samt Nachlese des Werts: ein `OK` von `try_as` allein
  belegt nichts, weil ein von der RLS gefiltertes UPDATE null Zeilen ergibt.
- **Kein Hinweis auf Überwachung des Laufs** in `docs/secrets.md` (gemini).
  Ergänzt.

## NICHT übernommen — und warum

**geminis HOCH-Befund ist falsch.** Er meldete, `drop function` ohne
vorheriges `revoke execute` hinterlasse eine „verwaiste Berechtigung". Postgres
löscht die ACL **mit** dem Objekt; es gibt nichts, was verwaisen könnte. Die
neue Signatur bekommt ihre Rechte ohnehin ausgesprochen.

**Und gemini hat den Diff gar nicht gelesen.** `.gstack/` ist gitignoriert, und
seine Ignore-Regeln verweigerten die Datei („File path … is ignored by
configured ignore patterns"), `run_shell_command` gibt es bei ihm nicht mehr.
Er hat stattdessen die Dateien im Repo gelesen. Das ist die dritte Sitzung in
Folge, in der geminis *Verdikt* brauchbar ist und seine *Belege* nicht —
diesmal immerhin ohne erfundene Pfade.

**Für den nächsten Lauf:** den Diff NICHT nach `.gstack/` legen, sondern in den
Scratchpad unter `/private/tmp/claude-501/…` (dort liest opencode über
`reviewer-cli.sh` mit, und geminis Ignore-Regeln greifen nicht).

## Was opencode ausdrücklich geprüft und NICHT beanstandet hat

Alle `security definer`-Migrationen auf `public.posts`-Leser durchsucht; keine
Views über `posts`; die Storage-Select-Policy delegiert an `post_media_lesbar`;
`post_media`/`comments`/`post_likes`/`post_saves` erben über
`exists`-Unterabfragen; `feed_tag_counts`/`feed_top_authors` sind
`security invoker`; `hinweis_auf_meinem_beitrag` ist ungefährlich (nur der
Autor kann seinen geplanten Beitrag kommentieren, und dann greift `v_owner =
v_actor`); Edge Functions lesen keine `posts`; `posts` steht nicht in
`supabase_realtime`. Cursor und `order by` tragen in allen drei Ordnungen
dieselbe Spalte; `AcademyCursor` ist sauber getrennt. Doppelankündigung durch
`for update … skip locked` plus Stempel in einer Transaktion ausgeschlossen.

**Eine Randnotiz ohne Befund, die trotzdem gehört gesagt:** Re-Publizieren nach
De-Publizieren kündigt NICHT erneut an — der Stempel bleibt. Das ist
konsistent, steht aber weder in der Spec noch in der Oberfläche.
