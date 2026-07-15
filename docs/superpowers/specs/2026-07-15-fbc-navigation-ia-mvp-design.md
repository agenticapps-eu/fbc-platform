# Design — FBC Navigation & IA-Umbau, Schritt 1+2

**Repo:** `fbc-platform` · **Datum:** 2026-07-15
**Spec:** [`2026-07-15-fbc-navigation-ia-mvp.md`](./2026-07-15-fbc-navigation-ia-mvp.md) (Detlev, bestätigt 15.07.2026)
**Scope:** Schritt 1+2 der Spec §6. Schritt 3 (Startseite→Dashboard, Mein Profil vereinfachen) und
Schritt 4 (Rechte je Level) sind **nicht** Teil dieses Designs.

## 1. Was gebaut wird

Das Nav-Gerüst geht auf die 6+5+1 Einträge der Spec §2. Die Community-Seite wird in
`Mitglieder` (Suche) und `Aktivität` (Feed) aufgeteilt, Biete & Suche zieht in Compass,
Matching heißt künftig `Meine Chancen`.

**Der Umbau ist Verschieben, kein Neubau** (Spec §5). Alle Bausteine existieren:
`CommunityFeed`, `MemberDirectory`, `AngeboteGesuchePage`, `MatchingPage`. Neu entsteht
nur eine Stub-Seite (`Meine Kurse`) und je eine dünne Seitenhülle für Aktivität.

## 2. Architektur

`src/config/nav.ts` bleibt **die einzige Quelle** für Routing und Sidebar. Dieses Prinzip
steht bereits im Repo und wird nicht angefasst — nur ihr Inhalt.

`NavSection` wechselt von `"formate" | "konto" | "community"` auf:

| Wert | Bedeutung |
|---|---|
| `entdecken` | Sichtbarer Abschnitt ENTDECKEN |
| `mein-bereich` | Sichtbarer Abschnitt MEIN BEREICH |
| `service` | Sichtbarer Abschnitt SERVICE |
| `sub` | Geroutet, aber kein Menüeintrag (ersetzt das heutige `community`) |

`AppShell.SidebarContent` rendert statt flachem Menü + `MeinBereichNav`-Akkordeon **drei
betitelte Abschnitte**. `SidebarNav` kann das bereits: der `sections`-Prop mit optionalem
`title` existiert und ist heute ungenutzt. Kein Umbau an `SidebarNav` nötig.

## 3. Ziel-Navigation

| Abschnitt | Einträge (Reihenfolge verbindlich) |
|---|---|
| `entdecken` | Start `/` · Compass `/compass` · Academy `/academy` · Events `/events` · Mitglieder `/mitglieder` · Aktivität `/aktivitaet` |
| `mein-bereich` | Mein Profil `/profil` · Meine Chancen `/meine-chancen` · Meine Kurse `/meine-kurse` · Meine Events `/meine-events` · Meine Kontakte `/kontakte` |
| `service` | Einstellungen `/einstellungen` |
| `sub` | Chat `/chat` · Profil bearbeiten `/profil/bearbeiten` |

Die Reihenfolge unter `entdecken` erzählt die Reise (Spec §2): Compass (entdecke mich) →
Academy (entwickle mich) → Events (treffe Menschen) → Mitglieder (finde Passende) →
Aktivität (hier lebt der Club).

## 4. Sichtbarkeit — „Alle sehen dieselbe Navigation" (Spec §1)

**Für Mitglieder ist §1 bereits erfüllt.** Eingeloggte Nutzer sehen heute unabhängig von
der Stufe dasselbe Menü; `/matching` ist per `RequireTier` an der Route gegatet, nicht im
Menü versteckt. §1 ändert daran nichts.

**Die einzige offene Frage war anonym.** Entscheidung (Donald, 15.07.2026): Anon sieht die
sechs `entdecken`-Einträge, aber **keinen** aus `mein-bereich` oder `service`. Klick auf
Gegatetes führt zum Login. Begründung: „Meine Kontakte" ohne Konto ist sinnlos; das Menü
wird zum Schaufenster und passt zum bestehenden Anon-CTA „Mitglied werden & alles sehen".

`AppShell` filtert dafür auf `section === "entdecken"` statt wie heute auf `publicAccess`.

**`/mitglieder` verliert das Route-Gate, nicht die Schranke.** `/verzeichnis` hat heute
`minTier: "discover"`. Der Eintrag muss nach §1 für alle sichtbar sein, also wandert das
Gate von der Route in die Seite: `MemberDirectory` zeigt unter `discover` den vorhandenen
Upsell statt der Liste. Das Frontend-Gate war ohnehin nie die Sicherheitsgrenze — die RLS
erzwingt das Verzeichnis in der DB unabhängig vom Client (CLAUDE.md; `rls_test.sql` prüft
es in CI). Verschoben wird Anzeige, nicht Schutz. Siehe §7 zur Testabdeckung.

## 5. Seiten-Bewegungen

| Neu | Woher | Änderung |
|---|---|---|
| `AktivitaetPage` `/aktivitaet` | `CommunityFeed` | Neue dünne Hülle, mountet die vorhandene Feed-Komponente. Feed-Code unangetastet. |
| `MitgliederPage` `/mitglieder` | `VerzeichnisPage` | Umbenannt, mountet weiter `MemberDirectory`. Keine Beiträge (Spec §3). Nimmt den Upsell auf. |
| `/compass` | + `AngeboteGesuchePage` | Tabs „Mini-Compass" \| „Suche & Biete"; Editor zieht als Komponente rein, Innenleben bleibt. |
| `MeineChancenPage` `/meine-chancen` | `MatchingPage` | Datei- und Label-Umbenennung. |
| `MeineKursePage` `/meine-kurse` | neu | Stub: „noch keine Kurse belegt". |
| — | `CommunityPage`, `LibraryPage`, `ProjektePage` | gelöscht |

### Entscheidungen zu Randfällen

- **Library & Projekte werden gelöscht** (Donald), nicht versteckt. Beide sind Stubs mit
  dem Platzhaltersatz „Inhalt folgt in einem späteren Issue" — es geht nichts verloren,
  und die Nav-Config bleibt ehrlich. Git hat sie, falls sie zurückkommen.
- **`Meine Kurse` wird ein Stub** (Donald), keine Umwidmung von Library. Die Academy sind
  heute drei fest verdrahtete Videos ohne Einschreibung; es gibt keine Datenbasis für
  „meine" Kurse. Der Stub hält die Nav vollständig wie in der Spec, ohne Fake-Daten.
- **`Meine Chancen` wird nur umbenannt.** Die Kürzung auf „wenige, hochwertige
  Empfehlungen" (Spec §3) ist inhaltlich, nicht IA — eigenes Issue.
- **Biete & Suche wird ein Tab in Compass** (Donald), nicht nur verlinkt. Nutzt die
  vorhandene `Tabs`-Komponente (heute in `CommunityPage` im Einsatz). Macht „wird Teil von
  Compass" (Spec §3) wörtlich wahr.

## 6. Alte Routen

**Redirects für die drei Umbenennungen** (Donald), je eine `<Navigate replace>`-Zeile
analog zum bestehenden `/mein-bereich` → `/profil` (`App.tsx:45`):

- `/community` → `/aktivitaet`
- `/verzeichnis` → `/mitglieder`
- `/matching` → `/meine-chancen`

Grund: `docs/demo-script.md` ruft `/matching` und `/verzeichnis` wörtlich auf, und die
Plattform läuft mit echten Mitgliedern — Bookmarks und Links außerhalb des Repos dürfen
kurz vor dem Sommerfest nicht brechen. `/library` und `/projekte` bekommen **keinen**
Redirect: ein Redirect von einer Seite, die nie Inhalt hatte, verwirrt mehr als ein 404.

**`/angebote-gesuche` → `/compass` bekommt ebenfalls einen Redirect.** Die Route
verschwindet, weil der Editor nach §5 zum Compass-Tab wird — anders als Library/Projekte
hatte die Seite aber echten Inhalt und ist aus `kontakte-widgets.tsx:198`,
`MatchingPage.tsx:607` und `CompassPage:78` verlinkt. Dieselbe Begründung wie oben, daher
dieselbe Behandlung.

Bewusst in Kauf genommen: der Redirect landet auf dem Tab „Mini-Compass", nicht auf
„Suche & Biete". Tab-Deeplinks (`?tab=`) wären ein eigener Mechanismus, den heute keine
Seite hat — das ist Scope für später, falls es jemandem auffällt.

### Mitzuziehen, weil sonst kaputt

`AppShell.tsx:19` `WIDE_ROUTES` (nennt `/verzeichnis`, `/matching`) · `FORMAT_HERO` (Keys
sind Pfade) · Links in `profil-widgets.tsx:248`, `kontakte-widgets.tsx:198-199`,
`MatchingPage.tsx:607`, `HomePage.tsx:95`.

### Zwei Altlasten, die dabei anfallen

- **Der Upsell-Text sagt „ab der Stufe Prime".** Er lebt als `DirectoryUpsell` in
  `CommunityPage` (verschwindet) und zieht in `MitgliederPage`. Dabei fällt auf: `prime`
  gibt es seit AGE-311 nicht mehr — ein sichtbarer Fehler. Text wird auf `Discover`
  korrigiert, weil die Zeilen ohnehin angefasst werden.
- **`/mein-bereich`-Altlast aus #54.** `CompassPage:57` und `AngeboteGesuchePage:210`
  werden ohnehin umgebaut; deren Links ziehen auf `/profil`. **`OnboardingPage:88,96`
  bleibt unangetastet** — Nachbarcode ohne Auftrag. Der Redirect bleibt bestehen, also
  bleibt es korrekt.

## 7. Testabsicherung

**RED zuerst: `src/config/nav.test.ts` (neu).** Behauptet die Ziel-Navigation direkt gegen
`navItems` — die 12 sichtbaren Einträge, ihre Abschnitte, ihre Reihenfolge, ihre Pfade.
Rot, solange `nav.ts` die alte Struktur hat. Das ist die eigentliche Zusage der Spec, damit
maschinell nachprüfbar statt behauptet.

**Bestehende Tests, die sich mitbewegen:**

- `App.test.tsx:26-29` — statt „Anon sieht Community, nicht Matching": Anon sieht alle
  sechs `entdecken`-Einträge und **keinen** aus `mein-bereich`.
- `MembershipGate.test.tsx:51` — `/matching` → `/meine-chancen`.

**Kein stiller Deckungsverlust am Verzeichnis-Gate.** Die vier `/verzeichnis`-Tests in
`RequireTier.test.tsx` prüfen heute das Route-Gate. Da es nach §4 in die Seite wandert,
werden sie **nicht gelöscht, sondern übersetzt** in `MitgliederPage.test.tsx` — dieselben
Fälle eine Ebene tiefer:

| Fall | Erwartung |
|---|---|
| `basic` | Upsell sichtbar, **keine** Mitgliederdaten |
| `discover` | Liste sichtbar |
| `impact` | Liste sichtbar |
| ausgeloggt | führt zum Login |
| `tier === loading` | kein Upsell (Ladefall aus `authLoadingTier()`) |

**`/browse`-Screenshot je umgebauter Seite** — es sind ausschließlich TSX-Änderungen.

## 8. Zuschnitt

**Ein PR, atomare Commits.** Ein Branch, ein Linear-Issue, ein Commit je Umbau-Schritt.

Verworfen: **zwei PRs entlang der Spec-Nummerierung** — Schritt 1 stellt die Nav auf 6+5+1
um, darin stehen „Mitglieder" und „Aktivität", die erst Schritt 2 erzeugt. Ein
eigenständiger Schritt 1 hätte Menüeinträge ins Nichts. Die Spec nummeriert die Reihenfolge
des Denkens, nicht zwei lieferbare Zustände.

Verworfen: **ein PR je Seite** — sechs PRs für eine Umstellung, Nav zwischendrin bei jedem
Merge inkonsistent, und bei einer zentralen `nav.ts` überschreiben sich die PRs
gegenseitig.

Begründung für einen PR: die Navigation ist das Rückgrat; ein halb umgestellter Zustand in
`main` ist schlechter als eine größere, in sich geschlossene Änderung. Die atomaren Commits
geben trotzdem feine Review-Granularität.

## 9. Nicht in diesem Scope

- Startseite → Dashboard, Mein Profil vereinfachen (Spec §6 Schritt 3)
- Rechte je Level anhängen (Spec §6 Schritt 4) — RLS steht bereits aus AGE-311
- Inhaltliche Kürzung von `Meine Chancen` auf wenige Empfehlungen (Spec §3)
- Design-Variante H/I als Default fixieren, Switcher strippen (Spec §5) — wartet auf Detlev
- `OnboardingPage`-Links auf `/mein-bereich`
