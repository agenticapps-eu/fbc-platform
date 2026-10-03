## Context

Gemessen am Katalog von PROD (`viwntbodrtqxgmqyxluh`) am 03.10.2026, nicht aus
den Migrationen gelesen.

**Jede Clubschwelle lautet `has_level(4)`. Es gibt keine auf 5 oder 6.**
Sieben Policies rufen `has_level`:

| Objekt | Policy / Funktion | heute | neues Recht |
|---|---|---|---|
| `profiles` | `profiles_select_self_or_discover` SELECT | `has_level(4)` | **bleibt** (Einzelabruf, E4) |
| `profile_badges` | `profile_badges_select` SELECT | `has_level(4)` | **bleibt** |
| `profile_interests` | `interests_select` SELECT | `has_level(4)` | **bleibt** |
| `profile_theme_scores` | `theme_scores_select` SELECT | `has_level(4)` | **bleibt** |
| `event_registrations` | `regs_write_own` UPDATE (with check) | `has_level(4)` | **bleibt** (Teilnahme) |
| `offers` | `offers_select` SELECT | `has_level(4)` | `darf('suche_biete')` |
| `needs` | `needs_select` SELECT | `has_level(4)` | `darf('suche_biete')` |

Fünf Funktionen rufen `has_level`:

| Funktion | heute | neues Recht |
|---|---|---|
| `search_directory(...)` (INVOKER) | `has_level(4)` im Eintrittstor | `darf('verzeichnis.suchen')` |
| `darf_kontaktanfrage_senden(uuid)` | `has_level(4)` | **bleibt** (E4) |
| `register_for_event(uuid)` | `has_level(4)` | **bleibt** |
| `former_member_entries(...)` | `has_level(4)` | **bleibt** |
| `post_engagement_counts(...)` | `has_level(4)` | **bleibt** |

Ohne jede Rangprüfung, obwohl die Matrix eine verlangt:

| Objekt | Policy | heute | neu |
|---|---|---|---|
| `events` | `events_write_host` ALL | nur `is_activated()` + Host | INSERT auf `darf('events.erstellen')`, UPDATE/DELETE unverändert |
| `offers`/`needs` | `*_write_own` ALL | nur `is_activated()` + Eigentum | INSERT zusätzlich `darf('suche_biete')` |
| `matches` | `matches_select_participant` | nur Beteiligung | zusätzlich `darf('vorschlaege')` |
| `profiles_public` | — (View, `security_invoker=off`) | `grant select to authenticated`, **keine** Rangprüfung | **bleibt** — eigener Change, Entscheidung 3 |
| `profiles` | `profiles_select_self_or_discover` | jede fremde Zeile ab Rang 4, auch `is_public = false` | **bleibt** — eigener Change, Entscheidung 3 |

Frontend — jede Stelle mit eigenem Rangwissen:

| Stelle | heute | neu |
|---|---|---|
| `nav.ts` `/mitglieder` | `minTier: "discover"` | `darf: "verzeichnis.suchen"` |
| `nav.ts` `/academy` | `minTier: "discover"` | **bleibt** (Clubschwelle) |
| `MembershipGate` | `levelRank >= LEVEL_RANK[min]` | zusätzlich `darf`-Zweig |
| `HeaderSearch` | `levelRank >= CLUB_RANK` | `useDarf("verzeichnis.suchen")` |
| `MemberDirectory` | `levelRank >= CLUB_RANK` (erweiterte Filter) | `useDarf("suche_biete")` |
| `EventsList` | kein Gate | `useDarf("events.erstellen")` |
| `EventDetailPage` `darfSichAnmelden` | `levelRank >= LEVEL_RANK.discover` | **bleibt** (Clubschwelle) |
| `PublicProfilePage` SUCHE/BIETE-Abschnitt | kein Gate | `useDarf("suche_biete")` |

**PROD-Zahlen vom 03.10.2026 (nur gelesen).** Konten je Rang: Rang 4
(`discover`) 4, davon 3 aktiviert; Rang 6 (`impact`) 74, davon 26 aktiviert.
Kein Konto auf Rang 1–3 oder 5. Events: 7, alle von **einem** Host auf Rang 6 —
die neue Insert-Schwelle verwaist nichts. `offers`: 99 Zeilen von 53 Konten auf
Rang 6, 1 Zeile von 1 Konto auf Rang 4. `needs`: 108 von 51 Konten auf Rang 6,
1 von 1 Konto auf Rang 4. `matches`: 96.

## Goals / Non-Goals

**Goals:**

- Ein Recht ist eine Zeile mit einem Namen und einem Mindestrang; eine
  Verschiebung ist eine Migration und keine Frontend-Änderung.
- Die Matrix aus SPEC 01 wirkt in der Datenbank, nicht nur in der Oberfläche —
  „darf nicht" heisst, dass der direkte RPC-Aufruf scheitert.
- Liste/Suche und Einzelabruf sind getrennte Zusagen mit getrennten Schwellen.
- Kein Datenverlust und keine Datensperre für Konten, deren Stufe sinkt.
- Die vier Rechte für noch nicht gebaute Module existieren als Konfiguration,
  damit V5F-4 und V5F-6 nur noch ihre Policy daran hängen.

**Non-Goals:**

- Keine Admin-Oberfläche zur Rechtepflege (Pflege per Migration).
- Keine Tabellen für Organisationen, Communities, Projekte, Academy-Angebote.
- Keine Navigationsstruktur (V5F-3), keine Event-Formate (V5F-5).
- `platform_settings.open_contact` bleibt unangetastet (AGE-930).
- Kein Umhängen der Policies, deren Schwelle Rang 4 ist und bleibt.
- Keine Stufenzuordnung des Bestands (E2, braucht Detlevs Liste).

## Decisions

### 1. `darf()` für Rechte, `has_level()` für die Tür

`berechtigungen` führt **nur** `min_rank >= 5`. Die Clubschwelle bleibt
`has_level(4)`.

Verworfen: *alles* über `darf()`, inklusive der Clubschwelle. Es wäre ein
Mechanismus statt zwei und wirkt sauberer. Dagegen steht: AGE-903 hat die
Clubschwelle gerade erst aus zwei Rängen zu einer Zahl zusammengezogen, und
`has_level(4)` steht in sieben Policies und fünf Funktionen, die alle genau das
Richtige tun. Sie für null Verhaltensänderung neu zu schreiben, sind zwölf
Gelegenheiten, etwas zu brechen, drei Wochen vor dem Go-live. Dazu entstünden
vier Rechte mit `min_rank = 4`, die dieselbe Zahl ein zweites Mal halten —
genau die Drift, die `access-control` verbietet.

Der Preis ist benannt: wer eine Schwelle sucht, muss an zwei Stellen schauen.
Die Zuordnung ist deshalb in `access-control` als Anforderung festgeschrieben
(Tür vs. Recht) und nicht dem Gedächtnis überlassen.

### 2. Zehn Schlüssel, vier davon ohne Wirkort

`organisation.verwalten`, `community.erstellen`, `projekt.erstellen`,
`academy.anbieten` haben zum Go-live keine Policy, weil ihr Modul fehlt.

Verworfen: sie erst mit ihrem Modul anlegen (der Prompt stellt das ausdrücklich
zur Wahl). Dagegen: der Schlüsselname ist die Schnittstelle zwischen diesem
Change und V5F-4/V5F-6. Steht er hier, ist er einmal verhandelt; entsteht er
dort, wird er dreimal neu erfunden. `darf()` auf einen Schlüssel ohne Wirkort
ist harmlos — er beantwortet eine Frage, die niemand stellt.

`profil.business` hat zum Go-live ebenfalls **keinen** Wirkort in der Datenbank:
Firma, Rollen und Business-Tags stehen in `profiles` und sind von der
Rang-4-Policy gedeckt. Sie auszublenden ist E6 und gehört zu V5F-3. Das Recht
entsteht hier, die Fläche dort.

### 3. Der Rohzugriff auf Mitgliederdaten bleibt offen — und zwar benannt

Dieser Change schliesst `profiles_public` und `profiles` **nicht**. Der erste
Entwurf wollte es (Entzug des Leserechts auf die View, `profil_karten(uuid[])`
an ihre Stelle) und war an zwei Stellen falsch; beide hat die Plan-Review
(codex, REQUEST-CHANGES) gefunden, bevor eine Zeile Code entstand.

**Erstens hätte er das Verzeichnis für alle abgeschaltet.** `search_directory`
ist `SECURITY INVOKER` — gemessen, `prosecdef = false` — und liest
`profiles_public`. Ohne Leserecht des Aufrufers scheitert die Funktion, auch für
ein IMPACT-Konto. Entzug und Ersatz sind ein Schritt, nicht zwei.

**Zweitens hätte er eine Tür neben einem offenen Fenster geschlossen.** Nicht
nur die View ist als Menge lesbar, die Basistabelle ist es auch:
`profiles_select_self_or_discover` lautet `… and (id = auth.uid() or
has_level(4))`, also liefert `select * from profiles` ohne Filter jedem
Clubmitglied jedes aktivierte Profil — einschliesslich der Zeilen mit
`is_public = false`, die die View gerade herausfiltert. Die View dicht zu machen
und die Tabelle offen zu lassen hätte den Befund verschoben, nicht behoben.

**Der Verschluss ist deshalb ein eigener Change** (`verzeichnis-dicht`). Sein
Umfang ist gemessen und klein genug, um ihn gleich danach zu fahren: 13
Abfragestellen auf `profiles` und 7 auf `profiles_public`, **alle zwanzig schon
heute kennungsgebunden** (`.eq("id", …)` oder `.in("id", …)`). Dazu gehören zwei
Dinge, die man dort nicht übersehen darf und die hier festgehalten sind: die
Einbettung `membership_tiers(level_rank)` in `AuthProvider` braucht ein
Leserecht auf die eingebettete Relation, und `update(...).select()` braucht
`select` auf die geschriebenen Spalten.

**Was das für diesen Change bedeutet, ohne Beschönigung:** nach V5F-1 gilt
„DISCOVER darf nicht gezielt suchen" an der Oberfläche und an `search_directory`
— nicht am direkten Tabellenzugriff. Die Abnahme in V5F-7 verlangt den Nachweis
zweifach (UI **und** DB); für dieses eine Recht ist er erst mit
`verzeichnis-dicht` zu führen. Das steht so in der Spec, damit es niemand
später für erledigt hält.

Verworfen: nichts davon festhalten und es beim UI-Gate lassen. Dann wäre die
Lücke in keinem Dokument, und der nächste Durchgang hätte sie neu zu finden.

Verworfen: `search_directory` zu `SECURITY DEFINER` machen, damit der Entzug
der View-Rechte sie nicht trifft. Das geht, hebt aber die RLS auf der
`left join profiles p`-Seite auf; die Maskierung der erweiterten Spalten hinge
dann allein am Eintrittstor. Es ist der richtige Schritt **in**
`verzeichnis-dicht`, zusammen mit den Tests dafür, und nicht nebenbei hier.

### 4. Anlegen fällt, Pflegen bleibt

Bei `events`, `offers` und `needs` wird die `ALL`-Policy in INSERT (mit Recht)
und UPDATE/DELETE (ohne Recht, nur Eigentum) geteilt.

Begründung: SPEC 01 bindet das **Einstellen** an die Stufe. Ein Mitglied, dessen
Stufe sinkt, muss seine Zeilen zurücknehmen können; ein Host muss seinen Termin
absagen können. Das Gegenteil wäre eine Datensperre, die wie ein Rechtemodell
aussieht.

Unsicher und Donald vorgelegt: ob „einstellen" auch das **Ändern** einer
bestehenden Zeile umfasst. Ich lese es als Neuanlegen und lasse das Ändern
offen. Fällt die Lesart anders aus, ist es eine Zeile in der Policy.

### 5. `(select darf('…'))` statt `darf('…')` in Policies

Der Aufruf wird eingewickelt, damit Postgres ihn als InitPlan einmal je Abfrage
auswertet statt einmal je Zeile — dasselbe Muster wie `(select auth.uid())` im
Bestand. `darf()` ist `stable`, damit das zulässig ist.

### 6. `meine_rechte() returns text[]` statt einer Tabelle je Recht

Eine Zeile je Recht mit `erlaubt boolean` würde dem Client verraten, welche
Rechte es gibt und damit die Preisstruktur, bevor sie beschlossen ist. Das Array
der **eigenen** Schlüssel ist schmaler und genügt dem Hook.

### 7. Der Hook hält die Antwort einmal je Sitzung

`useDarf(schluessel)` liest aus einer `useQuery(["meine-rechte", userId])` mit
`staleTime: Infinity`, invalidiert beim Identitätswechsel wie der bestehende
Profilcache. Ein Rechtegewinn durch `admin_set_tier` wirkt damit beim nächsten
Laden, nicht sofort — dieselbe Eigenschaft wie bei der Stufe selbst heute.

## Risks / Trade-offs

- **Zwei Mechanismen.** Siehe Entscheidung 1. Gegenmittel: die Anforderung in
  `access-control` schreibt die Zuordnung fest, und ein pgTAP-Test prüft, dass
  keine Zeile in `berechtigungen` `min_rank <= 4` trägt.
- **RLS-Kosten.** `darf()` schlägt in `berechtigungen` nach. Die Tabelle hat
  zehn Zeilen und der Aufruf ist eingewickelt; die Mehrkosten liegen bei einem
  Indexzugriff je Abfrage. Nicht gemessen — die Messung gehört in die
  Verifikation.
- **Die Differenzierung ist für fast niemanden spürbar**, solange 74 von 78
  Konten auf `impact` stehen (E2). Das ist kein Mangel dieses Changes, aber es
  heisst, dass die Abnahme (V5F-7) mit **eigens angelegten** Testkonten je Stufe
  arbeiten muss, nicht mit dem Bestand.
- **`matches` wird FOCUS, und der Feed zeigt Vorschläge.** `MemberDashboard` und
  `kontakte-widgets` lesen `matches` über `lib/dashboard.ts`/`matching-hub.ts`.
  Für DISCOVER kommen dort ab jetzt null Zeilen. V5F-3 blendet die Kachel aus;
  bis dahin zeigt sie einen Leerzustand. Das ist hässlich, aber nicht falsch —
  und V5F-3 folgt direkt.
- **`database.types.ts` ist handgepflegt** (`gen types` darf nicht darüber
  laufen). `darf` und `meine_rechte` müssen dort von Hand nachgezogen werden;
  ein vergessener Eintrag bricht `typecheck`, also fällt es auf.
- **Der grösste Rest ist benannt, nicht behoben** (Entscheidung 3). Wer diesen
  Change allein ausliefert, hat das Verzeichnisrecht in der Oberfläche und in
  der Such-RPC, nicht in der Rohtabelle.
- **`search_directory` wird neu deklariert**, also sind Grants und Entzüge danach
  wiederherzustellen — und zwar **namentlich für alle vier Rollen**, weil eine
  frisch erzeugte Instanz rollenspezifisch vergibt und `revoke … from public`
  dort nichts entzieht. Genau daran war die CI von AGE-927 rot.
