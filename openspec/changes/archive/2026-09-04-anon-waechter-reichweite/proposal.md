# Ausgeloggte Besucher lösen keine unnötige Anfrage mehr aus

Linear: **AGE-542**

## Why

AGE-542. Der ausgeloggte Wächter (`src/lib/anon-anreicherung.test.ts`) prüft über
eine Positivliste, dass ohne Sitzung nur Relationen angefragt werden, für die
`anon` ein Leserecht hält. Er ist gut gebaut — und seine **Reichweite** ist so
schmal, dass sie in `openspec/specs/directory-search/spec.md` als eigene
Anforderung ausgeschrieben werden musste („Der anon-Wächter reicht so weit, wie
er reicht"). Zwei Grenzen stehen dort wörtlich, beide am 13.08. mit Eingriffen
belegt, die den Prüfstand **grün** ließen:

1. Er ruft **vier handverlesene** lib-Funktionen auf (`fetchFeed`, `fetchEvents`,
   `fetchEvent`, `fetchComments`). Alles, was nicht durch diese vier läuft, ist
   ungeprüft.
2. Der Stub beantwortet `rpc()`, **ohne den Namen festzuhalten**. Ein
   Funktionsaufruf ist für ihn unsichtbar.

Solange das so ist, gilt laut Spec für jede neue ausgeloggt erreichbare Fläche:
sie bringt ihren eigenen negativen Nachweis mit. Das ist eine Auflage an
Menschen, die sich niemand merkt.

## What Changes

- **Für Mitglieder ändert sich nichts Sichtbares.** Keine Seite, kein Knopf und
  kein Ablauf sieht anders aus als vorher.
- **Wer nicht angemeldet ist, löst beim Seitenaufruf keine überflüssige Anfrage
  mehr aus.** Die App fragte im Hintergrund eine Liste ab, die ohne Anmeldung
  ohnehin nicht gelesen werden darf; die Anfrage entfällt jetzt.
- **Die Prüfung, die den ausgeloggten Bereich absichert, deckt ab sofort alle
  öffentlich erreichbaren Seiten ab** statt nur vier Stellen. Das ist reine
  Absicherung im Hintergrund und für Mitglieder nicht bemerkbar.

## Technisch — was gebaut wurde

<!-- ABSICHTLICH unter einer eigenen `##`-Ueberschrift und NICHT unter
     „What Changes": der Parser fuer den Neuigkeiten-Eintrag schneidet bei
     `/^#{1,2} /`. Diese Punkte sind Entwicklersprache und haben in einer
     Mitglieder-Nachricht nichts verloren — sie standen bis zur Umsetzung
     oben und waeren so hinausgegangen, samt eines Namens
     (`ANON_DARF_AUSFUEHREN`), den design.md D4 laengst verworfen hat. -->

- Die **Prüffläche wird aus dem Routentisch abgeleitet statt abgeschrieben.** Der
  Wächter montiert jede ausgeloggt renderbare Route, statt vier lib-Funktionen zu
  rufen. Die Liste entsteht aus `navItems` (Einträge ohne `requiresAuth` und ohne
  `minTier`) plus den Routen, die nur in `App.tsx` stehen. Eine neue Seite ohne
  `requiresAuth` fällt damit **automatisch** in die Prüfung.
- **`AppShell` und `AuthProvider` kommen zum ersten Mal mit unter den Wächter.**
  Beide laufen ausgeloggt mit (`ActivationGate` reicht `children` ohne `user`
  durch) und rufen selbst Daten ab — sie standen in keinem der vier bisherigen
  Aufrufe.
- **Funktionsaufrufe werden erfasst.** Der Stub hält den `rpc()`-Namen fest; eine
  zweite Positivliste `ANON_RUFT_AUF` sagt, welche Funktion ausgeloggt
  gerufen werden darf.
- **Eine Zusage gegen die Handliste selbst.** Eine `<Route>` in `App.tsx`, die
  weder in `navItems` steht noch hinter `RequireAuth`/`RequireStaff`/
  `RequireAdmin` liegt noch namentlich geführt wird, macht die Prüfung rot. Ohne
  sie wäre die abgeleitete Fläche an ihrem Rand wieder eine Handliste.
- Der Kommentarkopf über `ANON_DARF_LESEN` wird auf die neue Reichweite
  nachgezogen — er ist heute die Stelle, an der die Grenze dokumentiert ist.
- **Ein Bestandsfehler wird behoben, den der neue Wächter sofort findet:**
  `FeedbackButton` fragt ausgeloggt `feedback_themes` an, eine Relation, die nur
  `authenticated` lesen darf. Der Fund stammt aus der Planungs-Review (codex),
  die Kette ist nachgemessen und steht in `design.md`. Die Behebung ist eine
  Zeile: `enabled: Boolean(user)` an der Abfrage.

**Ein Eingriff in Produktivcode, und zwar genau einer.** Der Vorschlag ändert
Prüfstand und Spec — plus die eine Zeile oben, weil der Prüfstand sonst rot
ankäme. Das zentrale Lesetor im `supabase`-Client wurde erwogen und verworfen:
es greift zur Laufzeit, also nur auf Pfaden, die auch ausgeführt werden — eine
neue, ungetestete Datei fiele weiter durch — und ein Fehlalarm bräche eine echte
Seite in PROD.

## Nicht in diesem Change

<!-- BEWUSST eine `##`-Überschrift und nicht `###`: der Parser für den
     Neuigkeiten-Eintrag schneidet bei `/^#{1,2} /`. Stünde dieser Abschnitt
     als `###` unter „What Changes", listete der Eintrag die AUSSCHLÜSSE als
     das Ausgelieferte — genau die Falle aus AGE-628. -->


- **Die Datenbank-Hälfte der Lücke ist bereits zu** und wird nicht angefasst —
  auf PROD am Katalog gemessen, nicht nur lokal behauptet (Ergebnis in
  `design.md`).
  `supabase/tests/grants_test.sql` §6 führt seit AGE-602 einen Gesamtvergleich:
  genau sechs Funktionen darf `anon` ausführen (`event_cover_lesbar`,
  `event_registration_counts`, `feed_tag_counts`, `post_engagement_counts`,
  `post_media_lesbar`, `suchbegriff_zu_tsquery`). Eine siebte macht CI rot. Das
  Issue beschreibt den Stand vom 13.08.; der Weg „neue `SECURITY DEFINER`-RPC für
  `anon`" schlägt heute bereits an — nur in der Datenbank, nicht am Client.
- **Kein statischer Gesamtvergleich über `src/`.** Ein Inventar jeder
  `from("…")`/`rpc("…")`-Literalstelle im Repo wurde erwogen und verworfen: es
  kostet bei jedem Feature eine Nachpflege und ist für alles nicht-Literale blind.
- **Keine Migration, keine Rechteänderung.** `feedback_themes` bleibt für `anon`
  gesperrt; behoben wird die Abfrage, nicht das Recht.
- **Keine sichtbare Oberflächenänderung.** Die eine Produktivzeile unterdrückt
  einen Request, den ausgeloggt ohnehin nur ein 401 beantwortet; der Knopf war
  für Ausgeloggte schon vorher unsichtbar (`if (!user) return null`).

## Capabilities

### New Capabilities

_(keine)_

### Modified Capabilities

- `directory-search`: Die Anforderung „Der anon-Wächter reicht so weit, wie er
  reicht" wird umgeschrieben. Die zwei benannten Grenzen (nur aufgerufene
  Lesepfade, keine Funktionsaufrufe) entfallen, weil sie geschlossen werden; an
  ihre Stelle tritt die Zusage, dass die Fläche **abgeleitet** ist, und die
  verbleibende, ehrliche Grenze. Die Auflage „eine neue anon-Fläche bringt ihren
  eigenen Nachweis mit" bleibt bestehen — sie wird schwächer begründet, nicht
  überflüssig.

## Impact

**Prüfstand:** `src/lib/anon-anreicherung.test.ts` (Kern des Changes),
voraussichtlich in ein Modul mit Rendering umgebaut oder um eine zweite Datei
ergänzt.

**Produktivcode, eine Zeile:** `src/components/feedback/FeedbackButton.tsx` —
`enabled: Boolean(user)` an der `feedbackThemenQueryKey`-Abfrage.

**Gelesen, nicht geändert:** `src/config/nav.ts`, `src/App.tsx` und
`src/content/legal/meta.ts` werden zur Quelle der Prüffläche — die erste und die
dritte als Import, die zweite als über den TypeScript-AST gelesener Text. Alle
drei bleiben unverändert; eine Änderung an ihnen bewegt künftig die Prüfung mit.

**Erstmals unter Beobachtung:** `src/components/AppShell.tsx`,
`src/providers/AuthProvider.tsx`, `src/components/chat/use-ungelesen.ts`,
`src/components/hinweise/use-hinweise.ts`, `src/components/search/HeaderSearch.tsx`,
`src/components/feedback/FeedbackButton.tsx`, `src/lib/push.ts`.

Von diesen tragen sechs heute `enabled: !!uid` bzw. ein `if (!uid) return` — bei
ihnen kommt die Prüfung grün an, und ihr Wert ist nicht der Fund heute, sondern
dass ein späterer Wegfall dieser Bedingung auffällt. Die siebte,
`FeedbackButton`, trägt die Bedingung **nicht** und ist der oben genannte
Bestandsfehler.

**Nachtrag zur Ehrlichkeit dieser Liste:** eine frühere Fassung dieses
Vorschlags behauptete, alle Abfragen der Hülle seien bedingt. Das war eine
Zählung der Hooks aus der Importliste von `AppShell.tsx`, keine Messung ihrer
Rümpfe — `FeedbackButton` fiel genau durch diese Lücke. Der Befund kam aus der
Planungs-Review, nicht aus dem eigenen Messen.

**Nicht betroffen:** Datenbank, Migrationen, Rechte, Edge Functions, Oberfläche.

**Linear:** AGE-542.
