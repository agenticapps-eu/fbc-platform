# Tasks

## 1. Abgestufte Namensauflösung (AGE-291, spec-relevant)

**Der Auslöser von 22.08. hat gefeuert — und maß die falsche Größe.**
Er lautete „erstes Konto unterhalb von `impact`", geprüft an
`select count(*) from profiles where tier <> 'impact'`. Am 26.08. auf PROD
gemessen: **2** (1× `discover` aktiviert, 1× `basic` nicht aktiviert). Nach dem
Buchstaben also fällig.

Nur war er für die **alte** Schwelle geschrieben (`has_level(4)`/`exchange`).
Seit dem 26.08. ist die Schwelle die **Aktivierung**, und damit ist die Stufe
für diese Anforderung gar nicht mehr das Kriterium.

**Am PROD-Katalog abgezählt (26.08., zwölf namenstragende Funktionen, eine
View): heute leckt keine Fläche.** Die profiles-RLS trägt es schon —

    profiles_select_self_or_discover:
      is_activated() and activated_at is not null and disabled_at is null
      and deleted_at is null and (id = auth.uid() or has_level(3))

— und ihr erster Konjunkt ist zeichengleich mit der Bedingung des Resolvers:

| Aufrufer | fremder Klarname? | wodurch verhindert |
|---|---|---|
| `anon` | nein | kein Grant auf `profiles_public`, Policy nur für `authenticated` |
| angemeldet, nicht aktiviert | nein | `is_activated()` → null Zeilen, auch die eigene |
| aktiviert, unter `discover` | nein | `has_level(3)` → nur die eigene Zeile |
| aktiviert, ab `discover` | ja | genau das ist die Zusage |

**Donald hat entschieden, trotzdem zu bauen (26.08.): Tiefenverteidigung.** Der
Resolver trägt an dem Tag, an dem eine neue Fläche das Gate vergisst — und
`profiles_public` zeigt, dass das kein Gedankenspiel ist: die View steht auf
`security_invoker=off`, umgeht die RLS vollständig, und ihr `is_activated()` im
Rumpf ist das EINZIGE, was den Aufrufer prüft.

- [x] 1.1 `public.resolve_display_name(p_owner uuid, p_name text)` — Klarname,
      wenn der **Aufrufer** die Zeile besitzt oder aktiviert ist, sonst
      `'Mitglied'`. `stable`, `search_path = ''`.
      **`revoke execute … from public` ist Teil der Migration**, nicht Kosmetik:
      Postgres verschenkt EXECUTE implizit an PUBLIC, anon ist dessen Mitglied,
      und die Funktion stünde sonst als siebter Eintrag in der abgeschlossenen
      Liste von `grants_test.sql` (AGE-602, Abschnitt 5/6).
      **Gemessen:** Entzug zurückgenommen → `grants_test.sql` #7 UND
      `display_name_test.sql` #5 rot. Zwei unabhängige Fänge.
- [x] 1.2 `profiles_public.name` und `search_directory` geben den aufgelösten
      Namen heraus. **Drei Leckwege, nicht einer** — die beiden anderen fielen
      erst beim Abzählen von `search_directory` auf:
      * `order by p.name` — die alphabetische Position einer maskierten Zeile
        verrät den Namen, den die Spalte verschweigt. Sortiert wird jetzt nach
        `resolve_display_name(…)`, also nach genau dem, was ausgegeben wird.
      * `search_doc @@ …` — `search_doc` enthält den Namen; „Müller" eingeben und
        sehen, ob eine maskierte Zeile bleibt, ist ein Orakel. Der Volltext ist
        jetzt an dasselbe Recht gebunden wie die Spalte.
      Der Volltext wird ganz gesperrt statt den Namen aus einem zweiten
      `tsvector` herauszuhalten: das kostete eine weitere generierte Spalte auf
      `profiles` — Grant, Golden-Snapshot und Preisgabe ab `discover` — für eine
      Menge Aufrufer, die ohnehin null Zeilen bekommt.
      **Gemessen:** beide zurückgedreht → `display_name_test.sql` #12 und #13 rot.
- [x] 1.3 Alle namenstragenden Flächen laufen hindurch. Abgezählt statt geraten:
      * `profiles_public` — deckt Feed, Events, Profilansicht, Matching-Hub,
        Kontaktanfragen **und `feed_top_authors`** mit ab; letzteres liest die
        View, statt das Prädikat abzuschreiben, und folgt von selbst.
      * `search_directory` — `SECURITY INVOKER`, liest `public.profiles`.
      * `list_routing_queue` — beide Namen. Sein Gate verlangt schon
        `is_activated()`, der Resolver gibt dort also immer den Klarnamen heraus;
        er steht trotzdem da (siehe Entscheidung oben).
      * `event_attendees` und `former_member_entries` geben **gar keinen Namen**
        heraus — geprüft, nicht angenommen.
      * **`chat.ts` bleibt unangetastet** (Entscheidung 4 im Migrationskopf): es
        liest `public.profiles` unmittelbar, wo die RLS genau diese Schwelle
        erzwingt. Auf `profiles_public` umzustellen erbte `is_public = false`
        mit — ein Gesprächspartner, der sich aus dem Verzeichnis abgemeldet hat,
        verschwände aus dem eigenen Chat.
- [x] 1.4 **Kein Diff nötig, am Baum belegt.** Alle 19 Fundstellen von
      `?? "Mitglied"` / `"Ein Mitglied"` sind Ersatzwerte für einen **null**-Namen
      oder eine fehlende Zeile, keine clientseitige Ableitung eines Klarnamens.
      Der Client hat keine zweite Quelle, aus der er einen Namen rekonstruieren
      könnte.

## 2. Cache-Isolation beim Abmelden (AGE-258, spec-relevant)

- [x] 2.1 `queryClient.clear()` bei Abmeldung **und** Kontowechsel
      (`AuthProvider.tsx`). Es war eine echte, offene Lücke: der Rückruf leerte
      `profile` und die Onboarding-Vertagung, den React-Query-Cache aber nicht.
      **EINE Regel, nicht zwei:** verglichen wird die Kennung des Aufrufers gegen
      die des vorigen Rückrufs. Abmelden und Kontowechsel sind derselbe
      Vorgang — der handelnde Mensch wechselt —, und zwei Zweige, die dasselbe
      meinen, driften. `undefined` (noch kein Rückruf) ist dabei ausdrücklich
      NICHT `null` (niemand angemeldet), sonst leerte der Start jedes Mal.
      `clear()` und nicht `invalidateQueries()`: Invalidieren liefert die
      Einträge weiter aus, während im Hintergrund neu geholt wird — genau dieses
      Fenster ist der Schaden.
      **Vier Zusagen, davon zwei Gegenproben** (Token-Erneuerung und der erste
      Rückruf nach dem Mounten dürfen NICHT leeren; sonst holte die App ihren
      Bestand im Minutentakt neu und wäre trotzdem grün).
      **Gemessen:** bei jedem Rückruf leeren → 4 rot; nur beim Abmelden leeren →
      genau der Kontowechsel rot.

## 3. Inline-Akkordeon im persönlichen Bereich (AGE-292, nur Client)

**AGE-292 und AGE-293 sind beide am 04.08.2026 in Linear abgebrochen** worden,
Begründung jeweils „Geht in C2 (`mvp-scope-nav`) auf"; jener Change ist am
05.08. archiviert. **Donald hat am 26.08. entschieden, sie trotzdem zu bauen** —
C2 wird hier also bewusst überstimmt. Das steht hier, weil der nächste Leser
sonst einen Widerspruch findet und keine Entscheidung.

- [x] 3.1 `SidebarNavSection.klappbar`: der Titel wird zur Schaltfläche, die ihre
      Einträge klappt. Höchstens eine Ebene tief.
      Gehalten wird der Zustand als Menge der **zugeklappten** Abschnitte, nicht
      der offenen — andersherum müsste der Anfangszustand jeden klappbaren
      Abschnitt aufzählen, und ein später hinzugefügter stünde stillschweigend zu.
      In der schmalen Leiste (`collapsed`) gibt es keine Überschrift und deshalb
      **gar kein** Akkordeon: ein Griff, den man nicht sieht, versteckte die
      Einträge unerreichbar.
      Der Chevron kommt aus dem Icon-Satz — `icons.test.ts` hält fest, dass jeder
      wiederverwendbare Glyph dort steht, und hat einen inline gezeichneten
      prompt abgewiesen.

## 4. Menü aufräumen (AGE-293, nur Client)

- [x] 4.1 „Entdecken" ist **ersatzlos entfallen**; über der Hauptnavigation sagte
      das Wort nichts, was die fünf Einträge nicht selbst sagen. „Mein Bereich"
      und „Administration" bleiben — aber nicht mehr als Beschriftung, sondern
      als Griff des Akkordeons. Damit erledigt Aufgabe 3.1 dieses Anliegen mit:
      was bleibt, ist kein totes Label mehr, sondern ein Bedienelement.
      **Nebenbefund, mitbehoben:** `AppShell` fand den persönlichen Abschnitt über
      `s.title === "Mein Bereich"` — eine Suche über die BESCHRIFTUNG, deren
      Fehlschlag ein `?.` verschluckt. Der Eintrag „Meine Anfragen" (AGE-592)
      wäre bei der nächsten Umbenennung lautlos verschwunden. Gesucht wird jetzt
      über den Abschnitts-Schlüssel.
      **Offen und ausdrücklich nicht entschieden:** AGE-293 wollte den
      persönlichen Eintrag auch umbenennen („Vorschlag `Mein Profil`; finale
      Benennung mit Detlev bestätigen"). Der Menüeintrag heißt bereits
      „Mein Profil"; ob der Abschnitt weiter „Mein Bereich" heißen soll, ist
      Detlevs Entscheidung und wurde hier nicht vorweggenommen.

## 5. Verifikation

- [x] 5.1 Ein aktivierter Aufrufer sieht den Klarnamen, ein nicht aktivierter die
      Maske — **serverseitig** geprüft (`display_name_test.sql`, Abschnitt 1).
      **Warum nicht über `search_directory` gemessen:** dort bekäme ein
      maskierbarer Aufrufer null Zeilen, der Test wäre grün und prüfte das Gate
      statt den Resolver. Das ist die Vakuum-Falle, und sie ist hier besonders
      verführerisch, weil die Zusage richtig klingt.
- [x] 5.2 Der eigene Name kommt auch ohne Aktivierung durch (Selbst-Zweig), plus
      die Gegenprobe, dass die Maske am **Aufrufer** hängt und nicht an der Zeile.
- [x] 5.3 Kein Leck über Sortierung oder Suche — und die **Regel** an einer
      Wegwerf-View geprüft, die wie `profiles_public` auf `security_invoker=off`
      steht, aber KEIN Gate trägt: dort maskiert der Resolver, und dieselbe View
      ohne ihn leckt. Ohne diese zweite View belegte die erste nicht, dass die
      RLS wirklich umgangen wird.
- [x] 5.4 Nach dem Abmelden erreicht der Bestand des Vorigen den Nächsten nicht
      (`AuthProvider.test.tsx`, vier Zusagen).
- [x] 5.5 **Sichtprobe im Browser** gegen den lokalen Stack, weil grüne Tests in
      diesem Repo schon einmal ein visuell falsches Ergebnis durchgewunken haben:
      * Desktop ausgeklappt: „Entdecken" fort, „MEIN BEREICH" als
        `button` mit `aria-expanded`, Chevron dreht beim Klappen, Einträge weg
        und wieder da.
      * Schmale Leiste: kein Griff, beide Einträge erreichbar.
      * Mobil (375×812): eigene Akkordeon-Instanz in der Schublade, klappt eigenständig.
      * Verzeichnis als aktiviertes Konto: beide Klarnamen, **keine** Maske.
      * Volltextsuche nach „Bernd": genau ein Treffer — der neue Wächter hat sie
        für Aktivierte nicht beschädigt.
      * **Kontowechsel im selben Tab:** unter Anna zeigte „Neue Mitglieder für
        dich" **Bernd**, nach Ab- und Anmeldung als Bernd zeigt sie **Anna**. Ein
        überlebender Cache hätte weiterhin Bernd gezeigt.
      * Konsole: nur `/api/log` 404 — die Cloudflare-Function, die es lokal nicht
        gibt, unabhängig von diesem Diff.
      Konten: `scripts/chat-testkonten.ts` (nur `127.0.0.1`).
