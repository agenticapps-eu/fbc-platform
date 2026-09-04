## 1. Vorarbeit, die schon geleistet ist

- [x] 1.1 Messung am Katalog der Produktionsinstanz, rein lesend
      (`.gstack/prod-anon-katalog.mts`). Ergebnis in `design.md`: 6
      anon-ausführbare Funktionen, 7 anon-lesbare Relationen, die drei vom
      Client gerufenen Funktionen mit **rollen-eigenem** Recht. Das Spec-Delta
      verlangt diesen Beleg für jede Rechte-Zusage.
- [x] 1.2 Planungs-Review durch zwei fremde Anbieter, `REVIEWS.md` geschrieben,
      HIGH- und MEDIUM-Befunde in Vorschlag, Design und Delta eingearbeitet.

## 2. Die drei Eingriffe zuerst — RED, bevor gebaut wird

Die Abnahme aus AGE-542 verlangt Eingriffe, die **heute grün bleiben**. Jeder
Eingriff prüft genau eine Zusage; ein Eingriff, der aus zwei Gründen rot werden
könnte, belegt keine davon (Befund aus der Planungs-Review).

- [x] 2.1 **Eingriff A — Relation.** Auf einer Route, die die Fläche schon
      abdeckt (`/aktivitaet`), eine neue Datei mit eigenem
      `supabase.from("profiles_public")` einhängen. **Nicht** über eine neue
      Route, sonst schlägt die Randzusage zuerst an und A belegt nichts.
- [x] 2.2 **Eingriff B — Funktion.** Auf derselben, bereits abgedeckten Route
      ein `supabase.rpc("search_directory")`. `search_directory` steht nicht in
      der Sechserliste.
- [x] 2.3 **Eingriff C — Rand.** Eine unbewachte `<Route path="/probe">` in
      `App.tsx`, die in keiner Registry und keiner Liste steht. Diese und nur
      diese prüft die Randzusage.
- [x] 2.4 Alle drei einzeln gegen den **Bestand** laufen lassen
      (`npx vitest run src/lib/anon-anreicherung.test.ts`) und je das **grüne**
      Ergebnis mit Zahl in `design.md` festhalten. Das ist die Positivkontrolle
      des ganzen Changes.
- [x] 2.5 Alle drei zurücknehmen, `git status` sauber, Bestandslauf wieder 9/9.

## 3. Der aufzeichnende Stub

- [x] 3.1 `src/lib/__proben__/anon-sonde.ts`: Kettenstub wie heute, `rpc` mit
      Namensaufzeichnung, exportierter Rekorder (`relationen`, `funktionen`,
      `spalten`) und `zuruecksetzen()`.
- [x] 3.2 `auth` mitbedienen: `getSession()` in seiner ausgeloggten Form und
      `onAuthStateChange()` mit **abbestellbarem** Abonnement — ohne das
      montiert `AuthProvider` nicht und räumt nicht auf.
- [x] 3.3 Die Fixture-Zeilen (`ZEILEN`) aus `anon-anreicherung.test.ts` dorthin
      ziehen, damit beide Prüfstände dieselbe Datenlage sehen.
- [x] 3.4 Nachweisen, dass der Stub aus der gehobenen `vi.mock`-Fabrik heraus
      importierbar ist. RED zuerst: mit leerer Aufzeichnung beginnen.

## 4. Die abgeleitete Fläche

- [x] 4.1 `src/lib/anon-flaeche.test.tsx` anlegen. Quelle 1:
      `navItems.filter(i => !i.requiresAuth && !i.minTier)`.
- [x] 4.2 Quelle 2: **Registries importieren, nicht abschreiben** —
      `rechtsseiten` aus `src/content/legal/meta.ts` liefert die Rechtsseiten.
- [x] 4.3 Quelle 3: die verbleibenden Literal-Routen namentlich führen
      (`/events/:id`, `/login`, `/aktivierung`, `/passwort-vergessen`,
      `/passwort-neu`), je mit einer Zeile Begründung. `/styleguide`
      ausdrücklich ausnehmen — nur unter `import.meta.env.DEV`, im
      Produktionsbündel nicht vorhanden.
- [x] 4.4 Montage-Rüstung **aus `App.test.tsx` übernehmen**, nicht neu erfinden:
      dieselbe Provider-Reihenfolge samt `ToastProvider`, `MemoryRouter` auf den
      Pfad, `AuthProvider` ohne Sitzung.
- [x] 4.5 Isolation je Fall: frischer `QueryClient` mit abgeschalteten
      Wiederholungen, Rekorder zurückgesetzt, `unmount` danach.
- [x] 4.6 Auf die **Abfragen** warten, nicht auf das Element — dass ein
      `lazy()`-Bauteil im Baum steht, belegt keinen gelaufenen Effekt.
- [x] 4.7 `it.each` über die abgeleitete Liste — ein Fall je Route, damit Rot die
      Route nennt.
- [x] 4.8 Zusage 1: jede aufgezeichnete Relation liegt in `ANON_DARF_LESEN`.
      Liste samt nachgezogenem Kommentarkopf aus `anon-anreicherung.test.ts`
      hierher umziehen.
- [x] 4.9 Zusage 2: jeder aufgezeichnete Funktionsname liegt in **`ANON_RUFT_AUF`**
      = `feed_tag_counts`, `event_registration_counts`, `post_engagement_counts`.
      Der Kommentar sagt, dass dies eine **Teilmenge** der Sechserliste ist und
      keine Abschrift, und nennt `grants_test.sql` §6 plus die PROD-Messung als
      die Stellen, die den Rechtezustand tragen.
- [x] 4.10 **Dauerhafte Positivkontrollen**, je eine für Relation und Funktion:
      nach dem Lauf über `/aktivitaet` stehen `posts` und
      `post_engagement_counts` im Rekorder. Ohne sie ist eine leere Aufzeichnung
      von einer sauberen nicht zu unterscheiden.

## 5. Die Randzusage über App.tsx

- [x] 5.1 `App.tsx` mit `ts.createSourceFile` parsen, jede `<Route>` einsammeln,
      Pfadausdruck und umschließende Elementnamen mitführen.
- [x] 5.2 Die akzeptierten Pfad- und Wächterformen **aufzählen**. Jede andere
      Form — unbekannter Ausdruck, Spread, unbekanntes umschließendes Bauteil —
      macht rot und nennt Datei und Zeile. Kein stiller Durchlässer.
- [x] 5.3 Zusage: jede aufgelöste Route stammt aus `navItems` oder einer
      Registry, liegt hinter einer Wache, ist ein `<Navigate>`-Redirect oder wird
      namentlich geführt.
- [x] 5.4 Positivkontrolle A: eine erfundene unbewachte Routenzeile macht rot.
- [x] 5.5 Positivkontrolle B: eine Route in einer **unbekannten Form** (etwa
      `path={IRGENDEINE_KONSTANTE}` oder ein Spread) macht ebenfalls rot — sonst
      ist „fällt geschlossen aus" nur behauptet.
- [x] 5.6 Positivkontrolle C: ein neuer Eintrag in `rechtsseiten` erscheint in
      der montierten Fläche, ohne dass die Prüfung angefasst wird.

## 6. Der Bestandsfehler

- [x] 6.1 `enabled: Boolean(user)` an der `feedbackThemenQueryKey`-Abfrage
      (`FeedbackButton.tsx:100`). Nur diese Zeile — das Recht auf
      `feedback_themes` bleibt, wie es ist.
- [x] 6.2 Belegen, dass der neue Wächter den Fehler **vor** der Behebung meldet
      und danach nicht mehr. Beide Läufe mit Zahl festhalten.
- [x] 6.3 Nachsehen, ob der Knopf für angemeldete Mitglieder unverändert
      funktioniert — die Themenliste füllt sein Auswahlfeld.

## 7. Den Bestand zurückbauen

- [x] 7.1 `describe("Die Regel, nicht der Einzelfall")` aus
      `anon-anreicherung.test.ts` entfernen — in stärkerer Form ersetzt.
- [x] 7.2 Die verbleibenden Verhaltenszusagen dort auf den geteilten Stub
      umstellen, ohne ihre Aussage zu ändern.
- [x] 7.3 Den Kopfkommentar der Datei auf das nachziehen, was sie nach dem Umbau
      noch behauptet.

## 8. Abnahme

- [x] 8.1 Eingriff A wieder einsetzen: `anon-flaeche.test.tsx` ist **rot** und
      benennt Route **und** Relation. Zurücknehmen.
- [x] 8.2 Eingriff B wieder einsetzen: **rot**, benennt den Funktionsnamen.
      Zurücknehmen.
- [x] 8.3 Eingriff C wieder einsetzen: die **Randzusage** ist rot — und nur sie.
      Zurücknehmen.
- [x] 8.4 `pnpm test` vollständig grün, Zahl gegen den Bestand (2478) halten.
- [x] 8.5 `pnpm lint` **und** `pnpm typecheck` **und** `pnpm build` — je den
      Exit-Code prüfen, nicht die Ausgabe.
- [x] 8.6 `openspec validate --all` grün.
- [x] 8.7 Fremdreview auf dem **Diff** (nicht auf dem Plan), Ergebnis festhalten.

## 9. Abschluss

- [x] 9.1 Change archivieren, Delta in `openspec/specs/directory-search/spec.md`
      falten.
- [x] 9.2 Vor dem Archivieren den Neuigkeiten-Eintrag in der Vorschau ansehen.
      Der Change trägt seine Ausschlüsse unter einer `##`-Überschrift, damit der
      Parser sie nicht als das Ausgelieferte listet. Ob es überhaupt einen
      Eintrag gibt, ist zu entscheiden — für Mitglieder ändert sich nichts.
- [x] 9.3 Commit, PR, Linear AGE-542 auf Done.
- [x] 9.4 **Vor dem Merge nach `main`:** bei der AGE-642-Sitzung nachfragen, ob
      Geräteprobe 2 durch ist. `deploy.yml` veröffentlicht bei jedem Push auf
      `main` ein OTA-Bündel — ohne Pfadfilter, also auch bei einem reinen
      Testcommit. Während Probe 2 muss `0.0.0+defec7ed` das neueste Bündel im
      Manifest bleiben; ein Merger davor lässt ihren Beleg still ausfallen.
      Ab Probe 3 ist der Merge erwünscht. Begründung im Kopf von
      `session-handoff.md`.
