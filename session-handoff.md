# Session Handoff — 2026-08-12 (C7 / AGE-528, Sitzung 3)

## Accomplished

**Block 2 und 3 sind fertig: drei Migrationen, RED vor GREEN, pgTAP 312/312.**
Ein Commit auf `donald/age-528-c7-…-wie-im-mockup` (`a2bddde`), Arbeitsbaum
sauber, **nicht gepusht**. Noch keine Zeile Frontend-Code.

- `20260812090000_post_media.sql` — Tabelle (Kaskade, `unique (post_id, sort)`,
  `unique (storage_path)`), Grants ausgesprochen, drei RLS-Policies,
  Sechser-Grenze als Trigger, `post_media_lesbar()`, RPC
  `create_post_with_media()`.
- `20260812090100_post_media_storage.sql` — privater Bucket `post-media`
  (1 MiB, nur WebP, `on conflict do update`) und vier Storage-Policies.
- `20260812090200_tags.sql` — `tags` als redaktionelle Liste, 15 Einträge.
- `rls_test.sql` §19/§20, `plan(255)` → `plan(307)`; `grants_test.sql`
  Golden-Snapshot um beide Tabellen nachgezogen.

## Decisions

- **Die Sechser-Grenze steht NUR im Trigger, nicht zusätzlich in der RPC.** Eine
  Vorprüfung in der RPC wäre dieselbe Regel an zwei Stellen und käme dem Trigger
  zuvor — dann würde der Rückroll-Weg (2.13a) nie gemessen. So fällt der Trigger
  *nach* dem Insert in `posts` und nimmt den Beitrag mit zurück; genau das prüft
  der Test.
- **`post_media_lesbar()` bleibt SECURITY DEFINER**, obwohl ein INVOKER-Rumpf die
  RLS von `posts` einfach mitnähme und gar nichts abschriebe. Grund: gemessen ist
  nur der DEFINER-Weg (die Sonde führte genau dieses Muster durch die echte
  Storage-API). Ein ungemessener Weg in der Policy, die den einzigen Schutz der
  Bilder trägt, ist die teurere Eleganz. Der Preis — Prädikat an zweiter Stelle —
  steht im Migrationskopf, und §19.2 misst beide Seiten.
- **`post_media_select_like_post` delegiert, statt zu duplizieren:**
  `exists (select 1 from posts …)` — Policy-Ausdrücke laufen als die anfragende
  Rolle, also greift dort die RLS von `posts`. Muster von
  `comments_select_visible`.

## Zwei Korrekturen an den Planartefakten, beide gemessen

- **`\p{L}` ist in Postgres ein harter Fehler.** `design.md`/3.4a schrieben
  `key ~ '^[\p{L}\p{N}_]+$'`, von `TOKEN_RE` abgeschrieben. Die Migration wäre
  nicht durchgelaufen. Jetzt `^[[:alnum:]_]+$` — locale-abhängig, deshalb misst
  §20 den Umlaut-Fall ausdrücklich mit.
- **`tasks.md` 2.7a verlangte einen Test, der nichts misst.** Der gefälschte Pfad
  sollte eine *members*-Kennung tragen — die ist auch einer pfad-zerlegenden
  Fassung verboten, der Test bliebe an der kaputten Funktion grün. Gefunden hat
  es nur eine Mutation, nicht der grüne Lauf. Zwei Assertions mit einer
  **public**-Kennung ergänzt (`design.md` hatte es von Anfang an richtig).

## Files modified

- `supabase/migrations/2026081209{0000,0100,0200}_*.sql` — neu, die drei Migrationen
- `supabase/tests/rls_test.sql` — §19 (38+2 Zusicherungen), §20 (12), drei neue
  `pg_temp`-Helfer (`bool_as`, `bool_as_anon`, `try_as_anon`)
- `supabase/tests/grants_test.sql` — Golden-Snapshot + Begründung der zwei Zeilen
- `openspec/changes/activity-media-and-tags/{EVIDENCE,design,tasks}.md`

## Next session: start here

**Block 4: die Tag-Doppelanzeige.** Erste Handlung:
`src/components/community/CommunityFeed.test.tsx` anlegen — die erste Testdatei
zu dieser Komponente — mit dem Fall aus 4.1: ein Beitrag mit `#Netzwerken` im
Body und `netzwerken` in `hashtags`. Die Zusicherung ist **genau**: `netzwerken`
erscheint zweimal im Dokument und **genau eine** Stelle ist Button oder Link.
Rot laufen lassen, dann `PostBody` (`CommunityFeed.tsx:401–412`) auf normalen
Text umstellen. Kein `vi.mock` auf die eigene Komponente, keine Assertion auf
Bezeichner statt sichtbaren Text.

Der lokale Stack läuft, die Migrationen sind angewendet
(`supabase db reset --local`). Testbefehl **mit Dateiliste**:
`supabase test db --local supabase/tests/rls_test.sql supabase/tests/grants_test.sql`.

## Open questions

- **Task 1.0c** (Sonde gegen DEV) weiter offen und jetzt fällig **vor** dem
  Moment, in dem diese Migrationen auf DEV landen. `infisical login` ist
  erledigt; die Sonde ist auf `127.0.0.1` fest verdrahtet und braucht für DEV
  einen ausdrücklich benannten Zielparameter. Zielprojekt `foelowldexkcqzewvrcf`
  vor dem Schreibzugriff nennen.
- **`tasks.md` hat keine 2.12**, wird aber in 5.2 referenziert („Beitrags-`id`
  im Client erzeugt, siehe 2.12"). Gemeint ist der Ablauf aus `design.md`
  („Veröffentlichen ist ein Schritt"); die Nummer ist tot.
- **Die RPC ist noch von keinem Client aufgerufen worden.** Grün ist sie nur in
  pgTAP, also unter `set local role authenticated` — nicht über PostgREST. Vor
  Block 6 einmal echt aufrufen; `service_role` hält keine Tabellenrechte, und
  solche Dinge fallen hier erst zur Laufzeit auf.
- Aus der letzten Sitzung offen: Startbefüllung der Tags noch nicht mit Detlev
  abgestimmt (Korrektur ist ein Insert, keine Migration) · rechte Spalte trägt
  nur die Filterleiste · dunkles Theme (`navy` färbt die Schale, nicht die
  Karten) · `file_size_limit` für den bestehenden `avatars`-Bucket fehlt.
