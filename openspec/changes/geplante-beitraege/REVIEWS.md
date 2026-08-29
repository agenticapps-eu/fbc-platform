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
