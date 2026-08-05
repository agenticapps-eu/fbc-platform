# Tasks — Auf den Go-Live-Umfang zurückschneiden, Kompass als Filter (AGE-494)

Reihenfolge ist Absicht: die Migration zuerst, weil Task 3 auf dem neuen
Rückgabetyp sitzt; die Umbenennung erst nach den Funktionsänderungen, damit
Task 2–4 nicht auf einem wandernden Routennamen arbeiten; die Empty States
zuletzt, weil sie über die dann endgültige Seitenmenge laufen.

**Abnahme dieses Changes ist teils ein Test, teils ein Bild.** Task 1 wird per
pgTAP rot→grün belegt. Task 2–7 fassen Oberfläche an — jeder Punkt wird lokal
gezeigt, **bevor** er committed wird (Regel aus AGE-492: grüne Tests haben dort
ein visuell falsches Ergebnis durchgewunken).

## 1. Migration: `search_directory` um Kategorien erweitern

- [x] 1.1 **RED zuerst.** `supabase/tests/probe_directory_search_categories.sql`
      anlegen: zwei Profile mit bekannten offers/needs seeden, dann prüfen —
      `p_offers` mit zwei Werten liefert die ODER-Vereinigung; `p_offers` +
      `p_needs` liefert den UND-Schnitt; `p_offers => array[]::text[]` filtert
      nicht; `offer_categories` kommt distinct und ohne NULL zurück; eine Zeile
      mit `category = null` setzt `has_offers`, füllt aber `offer_categories`
      nicht. Läuft gegen die alte Funktion und muss fehlschlagen.
      _(pgTAP-Falle aus früheren Runden: `alike()` statt `like()`, und `try_as()`
      meldet jeden Fehler als DENIED — bei rot erst die echte Meldung holen.)_
- [x] 1.2 Migration `supabase/migrations/<ts>_directory_search_categories.sql`.
      **`drop function public.search_directory(text,text,text,text,text,text)`**
      vor dem `create` — `create or replace` legt bei geänderter Argumentliste
      eine Überladung an, und `search_directory()` wäre danach mehrdeutig
      (42725). Neue Signatur mit `p_offers text[] default null`,
      `p_needs text[] default null`; `offer_categories`/`need_categories` als
      **`coalesce(array_agg(distinct …) filter (where … is not null), '{}'::text[])`**
      im Rückgabetyp. Das `coalesce` ist nicht kosmetisch: ein gefiltertes Aggregat
      über lauter NULL liefert **NULL**, nicht das leere Array — lokal belegt
      (`raw_is_null = t`). Ohne es bricht Szenario „A categoryless row still sets
      the boolean". `p_offering` bleibt erhalten (der bestehende Select nutzt es noch).
      Kopfkommentar mit Begründung, Datum und der verworfenen Alternative —
      Hauskonvention.
- [x] 1.3 `revoke all … from public` und `grant execute … to authenticated` auf
      der **neuen 8-stelligen** Signatur; `comment on function` erneuern.
      Prüfen, dass keine alte Signatur zurückbleibt (`\df search_directory`
      liefert genau eine Zeile).
- [x] 1.4 Vier Zusatzprüfungen im pgTAP-Test: `anon` darf die neue 8-stellige
      Signatur **nicht** ausführen; ein Mitglied ohne kategorisierte Zeilen
      bekommt `{}` statt NULL; **ein Aufrufer unterhalb von `discover` bekommt
      über `p_offers` weder fremde Zeilen noch fremde Kategorien**; und ein
      Profil mit `is_public = false` taucht auch bei gesetztem Kategoriefilter
      nicht auf. Die beiden letzten sind die PII-Fälle der neuen Preisgabe und
      gehören in den Test, nicht nur in den Sentinel-Lauf.
      _(Kein `notify pgrst` nötig — `pgrst_ddl_watch`/`pgrst_drop_watch` sind
      vorhanden, PostgREST lädt den Cache bei DDL selbst neu. Deshalb kam das
      Repo in allen bisherigen Funktions-Migrationen ohne aus.)_
- [x] 1.5 **Herkunfts-Spalte** in derselben Migration:
      `alter table public.offers add column source text not null default 'editor'`
      mit `check (source in ('editor','chip'))`, dasselbe für `needs`. Bestehende
      Zeilen werden dadurch korrekt zu `'editor'`. Dazu je ein partieller
      Unique-Index `on (profile_id, category) where source = 'chip'` — er
      verhindert doppelte Chip-Zeilen, ohne dem reichen Editor mehrere Einträge
      je Kategorie zu verbieten. Begründung in den Migrationskopf: ohne ihn
      bläht ein Rennen zwischen zwei Speicherungen den Potenzial-Score auf,
      weil `20260613230000_potential_score.sql:110-111` `count(*)` über
      `offers`/`needs` summiert.
- [x] 1.6 pgTAP dazu: zwei Chip-Zeilen gleicher Kategorie werden abgewiesen,
      **zwei reiche Zeilen gleicher Kategorie nicht**.
- [x] 1.7 Test grün. Zusätzlich `rls_test.sql` und `grants_test.sql` laufen
      lassen — **beide bleiben grün** (85 Assertions gesamt). Meine Vorab-Warnung,
      der Golden-Snapshot schlage an, war falsch: die Spalten-Grants-Assertion in
      `grants_test.sql:82` ist auf `profiles`, `contact_requests`, `routing_queue`
      und `platform_settings` beschränkt, und die Tabellen-Assertion listet
      Rechte je Tabelle, nicht je Spalte. `offers`/`needs` fallen durch keines
      der beiden Raster. Die AGE-455-Falle greift bei neuen **Tabellen**, nicht
      bei neuen Spalten.
- [x] 1.8 `src/lib/database.types.ts` neu generieren; `DirectoryMember` zieht den
      neuen Rückgabetyp automatisch nach.
- [x] 1.9 `database-sentinel:audit` über die geänderte RPC — sie ist die
      Verzeichnisgrenze. SECURITY INVOKER und `is_public` müssen unberührt sein.
      Ausdrücklich mitprüfen: die Kategorien sind neue Preisgabe (was jemand
      sucht, nicht mehr nur dass er sucht) und dürfen die Grenze nicht
      verschieben — ein Aufrufer unterhalb von `discover` darf über die Arrays
      **und** über die Filtertreffer nichts über Fremde lernen.
- [ ] 1.10 **Die Migration erreicht Prod nur per manuellem `supabase db push` —
      und muss VOR dem Frontend-Deploy laufen.** Merge ≠ live: `deploy.yml`
      schickt beim Merge nur das Frontend los, die Datenbank bleibt stehen. In
      diesem Fenster antwortet die alte 6-stellige Signatur.
      **Real aufgetreten (Donald, 04.08.):** die Mitgliederseite wurde weiß, weil
      die Karte `offer_categories.length` auf einem Feld las, das die alte RPC gar
      nicht liefert. Das ist gefixt (`?? []`, Regressionstest
      `MemberDirectory.test.tsx` „überlebt eine Antwort der alten RPC"), die Seite
      trägt im Fenster die pauschalen „Bietet"/„Sucht"-Marken.
      **Der Kategorie-FILTER bleibt im Fenster trotzdem kaputt** — ein gesetzter
      Chip schickt `p_offers`, die alte Signatur kennt es nicht, und das
      Verzeichnis zeigt „konnte nicht geladen werden". Bewusst nicht weiter
      abgefangen: eine Fähigkeits-Erkennung im Client wäre Mechanik für ein
      Fenster, das gar nicht entstehen muss. Die Reihenfolge ist die Lösung —
      erst `db push`, dann mergen.

## 2. Navigation trimmen + Routen/Redirects

- [x] 2.1 `src/config/nav.ts`: `/compass` → `/kompass`, `section: "sub"`.
      `/mitgliedschaft`, `/meine-kurse`, `/kontakte` auf `section: "sub"`.
      `/einstellungen` von `service` nach `mein-bereich`. Die
      Reihenfolge-Erklärung im Kopfkommentar stimmt danach nicht mehr —
      mitziehen.
- [x] 2.2 `src/components/AppShell.tsx`: die Zeile `{ section: "service", title:
    "Service" }` aus `SIDEBAR_SECTIONS` entfernen — sie wäre sonst eine leere
      Überschrift. _Entdecken_ und _Mein Bereich_ bleiben sichtbar (Entscheidung 3).
- [x] 2.3 `src/App.tsx`: Redirect `/compass` → `/kompass`. Redirect
      `/angebote-gesuche` von `/compass` auf `/kompass` umhängen.
      `/meine-chancen` und `/matching` bleiben wie sie sind.
- [x] 2.4 **Den toten Link entfernen:** `kontakte-widgets.tsx:199`
      (`<CardLink to="/meine-chancen">Zu meinen Chancen</CardLink>`) zeigt auf
      eine Route, die auf `/` umleitet. Das ist der einzige UI-Verweis dorthin;
      `/matching` wird von keiner Stelle verlinkt.
- [x] 2.5 **Vier weitere Links, die dieser Change selbst tot macht.** Sobald
      `/compass` nur noch umleitet, verstoßen sie gegen die neue Regel „kein
      gerenderter Link zeigt auf eine Redirect-Route":
      `profil-widgets.tsx:103`, `kontakte-widgets.tsx:198` und
      `MeineChancenPage.tsx:609` auf `/kompass` umhängen. Dazu
      `OnboardingPage.tsx:96` (`navigate("/mein-bereich")`) auf `/profil` —
      `/mein-bereich` ist schon heute reiner Redirect (`App.tsx:62`), das ist
      Altbestand und fällt hier nur auf, weil die Regel neu ist.
      Als Test festhalten, nicht nur als Handgriff: jede `to=`/`navigate()`-Ziel
      im gerenderten Baum gegen die Redirect-Liste prüfen.
- [x] 2.6 `src/config/nav.test.ts` und `src/App.redirects.test.tsx` nachziehen:
      genau sieben Menüeinträge in der geforderten Reihenfolge, `/kompass`
      erreichbar ohne Menüeintrag, `/compass` → `/kompass`.
      **Gegen die gerenderte Sidebar prüfen, nicht nur gegen `navItems`** —
      `AppShell` schiebt für `admin` einen achten Eintrag („Administration",
      `AppShell.tsx:245`) nach, der kein `navItem` ist. Ein Test auf „genau
      sieben" ohne Rollenbezug ist entweder falsch oder blind.
- [x] 2.7 `NavIcon.tsx` hat zwei Einträge unter dem Schlüssel `/compass`
      (Linie + gefüllt) — beide auf `/kompass` umschlüsseln, sonst verliert die
      Route ihr Symbol.
- [x] 2.8 Lokal zeigen: Sidebar eingeklappt und ausgeklappt, angemeldet und
      abgemeldet.

## 3. Kompass-Filter über der Mitgliederliste + Chips auf der Karte

- [x] 3.1 `src/lib/directory.ts`: `DirectoryFilters` um `offers: string[]` und
      `needs: string[]` erweitern; `emptyDirectoryFilters`, `hasActiveFilters`
      und `filtersToArgs` mitziehen (leeres Array → `undefined`, damit der
      Server nicht filtert). Der `directoryQueryKey` serialisiert die Filter
      bereits als Objekt und trägt die Arrays ohne Änderung.
- [x] 3.2 Kategorie-Optionen aus `src/config/compass.ts` ableiten (die
      `ChipsStep`-Optionen mit `target: "offers"` bzw. `"needs"`), **nicht neu
      auflisten**. Sechs je Seite, nicht elf — die Elf ist die Vereinigung.
- [x] 3.3 `MemberDirectory.tsx`: zwei Chip-Gruppen „bietet" und „sucht" über der
      Liste, Mehrfachauswahl, in „Filter zurücksetzen" einbezogen.
- [x] 3.4 `MemberCard`: `offer_categories`/`need_categories` als Chips statt der
      pauschalen „Bietet"/„Sucht"-Badges. Fällt eine Kategorie ohne Label an
      (Alt-Datenbestand), lesbar auf den Schlüssel zurückfallen.
- [x] 3.5 Tests: ODER innerhalb einer Gruppe, UND zwischen den Gruppen, Reset
      räumt auch die Chips. **Kein `vi.mock` auf die eigene Komponente** — die
      RPC wird gemockt, die Filterlogik nicht.
- [x] 3.6 Lokal zeigen, mit gesetzten und mit leeren Filtern.

## 4. Kompass-Kategorien im Profil-Editor

- [x] 4.1 Datenschicht: Laden der eigenen `offers`/`needs`, reduziert auf die
      Menge der belegten Kategorien je Seite.
- [x] 4.2 Speichern **kategorie-weise** (Entscheidung 2), nicht als
      Replace-Collection: neu gesetzte Kategorie → eine minimale Zeile;
      abgewählte Kategorie → alle eigenen Zeilen dieser Kategorie löschen;
      belegte Kategorie → unangetastet. `tx_volume_band` bleibt bei Chip-Zeilen
      null, `source` wird auf `'chip'` gesetzt. Gegen Duplikate schützt der
      partielle Unique-Index aus 1.5, nicht die Anwendungslogik — der Abgleich
      ist read-then-write und damit nicht atomar, und ein voller
      Unique-Constraint schiede aus, weil der reiche Editor mehrere Einträge je
      Kategorie führen darf. Als Kommentar festhalten.
- [x] 4.3 **Titel aus `config/matching.ts`, nicht aus `config/compass.ts`.** Die
      beiden Vokabulare widersprechen sich, und die Kompass-Fassung wäre falsch:
      sie nennt `kapital` „Kapital & Beteiligungen", während `beteiligungen` in
      `matching.ts` eine eigene Offer-Kategorie ist. `categoryLabel(side, key)`
      benutzen.
- [x] 4.4 **`theme` auf Chip-Zeilen setzen**, aus der Kategorie abgeleitet, nicht
      null lassen. Sonst sind chip-erzeugte Zeilen für den bestehenden
      `p_theme`-Facettenfilter unsichtbar, während reiche Zeilen es nicht sind —
      ein stiller Unterschied zwischen zwei Oberflächen, die sonst gleich sind.
- [x] 4.5 Prüfen, dass jeder Kompass-Schlüssel in `config/matching.ts` auf
      seiner Seite existiert — sonst schreibt der Picker Werte, die der reiche
      Editor per zod ablehnt. Als Test festhalten, nicht als Annahme.
- [x] 4.6 `ProfilPage.tsx`: die zwei Chip-Gruppen einbauen. Die Rückfrage
      entscheidet sich an `source`, **nicht** an leeren Spalten: enthält die
      Kategorie eine Zeile mit `source <> 'chip'`, kommt eine ausdrückliche
      Bestätigung, die benennt, was verloren geht; sonst keine. Strukturelles
      Raten („description und tags sind leer, also unwichtig") würde eine reiche
      Zeile löschen, die nur einen eigenen Titel oder ein Volumenband trägt.
- [x] 4.7 Test, der genau das absichert: Zeile mit description + tags anlegen,
      Profil mit gesetztem Chip speichern, Zeile ist unverändert.
- [x] 4.8 **`saveCompass()` ist ein dritter Schreibpfad und löscht heute alles.**
      `src/lib/compass.ts:200` leert `offers` und `needs` vollständig, bevor es
      neu einfügt — ein Kompass-Neulauf über `/onboarding` (bleibt erreichbar)
      vernichtet damit jede Beschreibung, jedes Tag und jedes Volumenband.
      **Auf rein additiv umstellen**, nicht auf den kategorie-weisen Abgleich des
      Editors: die Auswahl des Assistenten kommt aus einem lokalen Entwurf, nicht
      aus den aktuellen Zeilen — ein Neulauf mit frischem Entwurf läse sich als
      „nichts ausgewählt" und löschte alles. Der Assistent ergänzt fehlende
      Kategorien (`source = 'chip'`) und nimmt nie etwas weg. Die Datei kennt das
      Muster schon: `profile_interests` wird genau deshalb additiv gemergt, mit
      dieser Begründung im Kommentar daneben. Zwei Tests: reichen Eintrag
      anlegen → Kompass erneut durchlaufen → Eintrag überlebt; Kategorie im
      Assistenten NICHT auswählen, obwohl belegt → Zeile bleibt.
      **Auch hier der Titel aus `config/matching.ts`:** `deriveMatchItems`
      (`lib/compass.ts:152`) setzt heute `title: opt.label`, also das
      Kompass-Label „Kapital & Beteiligungen". Sonst legen Assistent und
      Chip-Picker für dieselbe Kategorie unterschiedlich benannte Zeilen an.
- [x] 4.9 **Der reiche Editor muss chip-erzeugte Needs öffnen und speichern
      können.** `fetchMatchingProfile` macht aus `tx_volume_band = null` ein `""`
      (`matching-profile.ts:105`), und `needSchema` lehnt `""` ab
      (`matching-profile.ts:42`) — jede chip-erzeugte Zeile blockierte damit das
      Formular, bis ein Volumen gewählt wird. Fehlendes Band heißt „noch nicht
      angegeben", nicht „ungültig": Schema und Rückschreibpfad entsprechend
      öffnen. Test: chip-erzeugtes Need laden, nichts ändern, speichern — grün,
      Band bleibt leer.
- [x] 4.10 **Die Rückfrage wird beim Speichern entschieden, nicht beim Laden.**
      Zwischen Laden und Speichern kann eine reiche Zeile entstehen; eine beim
      Laden getroffene Entscheidung löschte sie stumm. Das Restrisiko (Zeile
      entsteht nach dem Lesen im Speichervorgang) bleibt bewusst offen und steht
      als solches in der Spec.
- [x] 4.11 Lokal zeigen: leeres Profil, Profil mit reichem Eintrag.

## 5. Umbenennung Compass → Kompass (nur sichtbar)

- [x] 5.1 Die **11 sichtbaren Labels in `.tsx`**: `MemberDashboard.tsx:90, 252` ·
      `profil-widgets.tsx:55` · `CompassPage.tsx:31, 46, 57 (zwei Strings), 79` ·
      `OnboardingPage.tsx:158, 178, 286`.
- [x] 5.2 Die **3 sichtbaren Labels in `.ts`**, die AGE-494 nicht mitzählt:
      `nav.ts:53` (`label: "Compass"`), `levels.ts:37`, `levels.ts:45`.
- [x] 5.3 `formatHero.ts:19` sagt **bereits** `title: "Kompass"` — der
      Seitenkopf ist fertig, nur der Bildpfad `/images/hero-compass.webp` bleibt
      wie er ist (Datei auf der Platte, kein sichtbarer Text).
- [x] 5.4 **Ein sichtbares Label wohnt in SQL.** `recompute_potential_score()`
      baut das Score-Breakdown mit `'label', 'Compass'`
      (`20260716070000_platform_feedback.sql:236`); `dashboard.ts:198` holt es,
      `profil-widgets.tsx:219` rendert `c.label`. Per `create or replace
    function` auf „Kompass" ziehen — **der Schlüssel `'key', 'compass'` bleibt**.
      Das ist kein Bruch von Entscheidung 4: umbenannt wird angezeigter Text, kein
      Schema-Objekt, und es kostet keine Kaskade. Ohne diesen Schritt steht nach
      der Umbenennung weiter „Compass" im Profil.
- [x] 5.5 **Nicht anfassen:** Code-Bezeichner, alle DB-Objekte,
      `probe_compass_responses_rls.sql`, und `src/vision/` (toter Code, ~6
      weitere Labels — `App.test.tsx:69` sichert zu, dass es niemand importiert).
- [x] 5.6 Erklärenden Kommentar in `src/config/compass.ts`: UI heißt Kompass, DB
      heißt compass, das ist Absicht und kein Fehler (Entscheidung 4).
- [x] 5.7 Tests nachziehen, die auf den Labels sitzen: `App.test.tsx:32`,
      `MembershipGate.test.tsx:48, 56`, `App.redirects.test.tsx:67`,
      `CompassPage.test.tsx:24, 30`, `OnboardingPage.test.tsx:46`.
- [x] 5.8 Abnahme: `grep -rn "Compass" src/ --include="*.tsx"` liefert außerhalb
      von `src/vision/` und den Testdateien nur noch Code-Bezeichner.

## 6. Onboarding-Wizard aus dem Erstlogin nehmen

- [x] 6.1 `src/components/HomeRedirect.tsx`: die Weiterleitung ins Onboarding
      entfernen; die Komponente rendert die öffentliche HomePage. Der
      `fetchCompassStatus`-Aufruf und der Skip-Zustand entfallen damit an dieser
      Stelle — prüfen, ob `isSkipped`/`markSkipped` danach noch einen Aufrufer
      haben, und sie nur dann liegen lassen, wenn ja (nichts löschen, was noch
      benutzt wird; nichts stehen lassen, was der eigene Change verwaist hat).
- [x] 6.2 Route `/onboarding` und `OnboardingPage` bleiben erreichbar.
- [x] 6.3 Test: neues Konto ohne `compass_responses` landet auf `/`, nicht auf
      `/onboarding`.
- [x] 6.4 Kommentar am Redirect: der Platz gehört ab C3 dem Aktivierungs-Gate.

## 7. Empty States

Der eigentliche Erstlogin-Task. Wortlaut einladend, mit einer konkreten
Handlung — nicht „Keine Daten vorhanden".

- [x] 7.1 **Fehlen ganz, und zwar an einer datenabhängigen Stelle:**
      `ProfilAnsichtPage` (unausgefülltes Profil → Editor), `MeineEventsPage`,
      `KontaktePage` (die „0" im Netzwerk-Widget), `MeineKursePage`.
      **Befund beim Bauen:** „Meine Events" hatte gar keinen Leerzustand, sondern
      zeigte ZWEI ERFUNDENE EVENTS mit Demo-Marke. Am 17.08. hätten ~70 Menschen
      beim ersten Login erfundene Termine gesehen — schlechter als ehrliche
      Leere. Ersetzt.
      **Nicht in der Liste, obwohl vorher darin:** `AcademyPage` und
      `MitgliedschaftPage` rendern immer Inhalt — drei feste Videos bzw. die
      Stufenzusammenfassung. Ein Leerzustand dort könnte nie erscheinen; die
      Regel gilt für datenabhängige Bereiche, nicht für Seiten. Die Academy
      bekommt ihren erst mit C9, wenn ihre Bibliothek aus Daten kommt.
- [x] 7.2 **Bestehen, aber passiv formuliert** — mitziehen, nicht nur ergänzen:
      `EventsList.tsx:95` („Sobald Veranstaltungen geplant sind…"),
      `ChatPage.tsx:125` („Sobald eine Kontaktanfrage angenommen wurde…"),
      `MemberDirectory.tsx:200` („Sobald Mitglieder sich vorstellen…").
      `CommunityFeed.tsx:211` ist bereits richtig („Teile den ersten Beitrag")
      und dient als Maßstab.
- [x] 7.3 Der Filter-Nulltreffer im Verzeichnis bleibt vom Leerzustand getrennt
      und behält „Filter zurücksetzen".
- [x] 7.4 Wo die Handlung nicht beim Mitglied liegt, sagen was kommt — kein
      Button, der nichts tut.
- [x] 7.5 **Mit einem frischen Konto durchklicken**, jede Hauptseite, und die
      Aufnahmen zeigen. Das ist die Abnahme dieses Tasks.
- [x] 7.6 **„Aktivität & Portfolio" auf „Mein Profil" ersatzlos entfernt**
      (Donald, 04.08., nach dem Code-Review). Derselbe Fall wie 7.1, nur größer:
      vier Karten mit frei erfundenen Zahlen ÜBER DAS MITGLIED SELBST —
      Profilaufrufe, Projektfortschritte, „Immobilienportfolio Süd +6,1 %".
      Der Block war zwar eingeklappt und mit Demo-Marke versehen; das macht die
      Zahlen aber nicht wahr, sondern nur seltener sichtbar.
      **Bewusst kein Leerzustand als Ersatz:** Statistik, Projekte, Investments
      und KI-Assistent existieren in Phase 1 gar nicht. Ein „Noch keine
      Investments" verspräche eine Funktion, die niemand gebaut hat — bei „Meine
      Events" ging der Leerzustand nur, weil es Events gibt.
      Komponente und Test gelöscht (einziger Aufrufer war diese Seite);
      `building-blocks.tsx` bleibt, es hat andere Nutzer.
      **Nicht angefasst:** „Meine Communities" (`kontakte-widgets.tsx`) trägt
      dieselbe Demo-Marke, sitzt aber auf `/kontakte` — eigener Nachlauf.

## 8. Spec-Drift, die dieser Change mitnimmt

- [x] 8.1 Die `matching`-Spec nennt als Sichtbarkeitsgrenze für `offers`/`needs`
      noch `is_prime_plus()`. Migration `20260715150000_six_level_model.sql:211`
      hat beide Policies auf `has_level(3)` umgestellt; der Text ist seitdem
      falsch. Das Delta korrigiert ihn. Bewusst mitgenommen und nicht als
      Nachlauf notiert: es ist ein **Sicherheitsvertrag**, er steht in einer
      Spec, die dieser Change ohnehin anfasst, und dieser Change vergrößert
      genau das, was hinter dieser Grenze preisgegeben wird.
      _(`is_prime_plus()` existiert weiter und gated in
      `20260613073842_profile_extension.sql` andere Tabellen — die Funktion ist
      nicht tot, nur für diese beiden Policies nicht mehr zuständig.)_

## 9. Abschluss

- [x] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün, Ausgabe
      im Change festhalten. **Stand 04.08. nach den Review-Fixes:** lint 0 Fehler
      (3 vorbestehende `react-refresh`-Warnungen in `building-blocks.tsx`),
      typecheck sauber, **357 Vitest in 60 Dateien**, Build ✓, dazu
      **85 pgTAP-Assertions** (`grants_test`, `rls_test`, `directory_search_test`)
      und `openspec validate --all` 26/26.
      _Falle für den nächsten Lauf:_ `supabase test db` OHNE Dateiliste meldet
      FAIL — die `probe_*.sql` sind manuelle begin/rollback-Skripte ohne `plan()`
      und scheitern an Alt-Daten (`tier=prime` aus dem 3-Stufen-Modell). CI ruft
      bewusst nur die drei echten Suites auf (`ci.yml:97-101`).
- [x] 9.2 `superpowers:requesting-code-review` in unabhängigem Kontext
      (Stage 2 — `openspec validate` ersetzt das nicht).
      **Ergebnis: keine kritischen Befunde**, 5 wichtige, 9 kleine.
      Übernommen: Docstring in `compass.ts` (behauptete das Gegenteil des Codes),
      unerreichbarer Fehlerzweig in `ProfilPage` (Block verschwand bei Ladefehler
      wortlos — rot/grün belegt), fehlender Test zu 4.9
      (`matching-profile.test.ts`, 7 Fälle; am Altstand nachweislich rot, dort
      fehlt `source` komplett), „currently"-Sätze im matching-Delta (wären beim
      Archivieren als aktuelle Wahrheit stehengeblieben), drei grün-per-
      Konstruktion-Tests geschärft (Identität, TOCTOU, Leerzustands-Wortlaut).
      Zurückgewiesen bzw. als Nachlauf notiert: `NUR_REDIRECT` handgepflegt,
      `ChipGroup`/`ChipFilterGroup`-Dopplung, Einrückung in `ProfilPage`,
      roher `23505` beim Kategoriewechsel einer Chip-Zeile im reichen Editor.
- [ ] 9.3 Abnahme-Checkliste aus AGE-494 durchgehen. **Die Haken in Linear setzt
      Donald**, nicht dieser Change.
- [ ] 9.4 Change archivieren, dann shippen — zwei getrennte Akte.
