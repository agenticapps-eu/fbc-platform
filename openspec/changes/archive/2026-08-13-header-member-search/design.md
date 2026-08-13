## Context

Das Suchfeld in `AppShell.tsx:407-419` ist ein nacktes `<input type="search">` —
kein `value`, kein `onChange`, kein Formular. Der Wrapper ist
`mx-auto hidden w-full max-w-md sm:block`, das Feld steht **außerhalb** des
`user ? … :`-Zweigs.

Daraus folgen zwei Dinge, die in AGE-539 falsch stehen und hier korrigiert sind:
es drängt auf dem Telefon nicht — es ist dort **gar nicht da**; und ein Gast
sieht es sehr wohl.

**Was schon existiert und wiederverwendet wird:**

| Baustein | Wo | Wofür hier |
|---|---|---|
| `search_directory` RPC | `20260804200000` | die Suche selbst, unverändert |
| `searchDirectory(filters)` | `lib/directory.ts:159` | Aufruf, unverändert |
| 300-ms-Entprellung | `MemberDirectory.tsx:42-48` | Muster, nicht geteilter Code |
| `useOverlay` (AGE-529) | `ui/useOverlay.ts` | Sperre + Fokus-Falle der Telefon-Fassung |
| `useAuth().levelRank`, `levelLabel` | `providers/auth-context`, `config/levels` | Aufstiegs-Hinweis |
| `Avatar`, `TierBadge` | `ui/` | Trefferzeile |

**Grenzen, die dieser Change nicht anfasst:** `search_directory` ist
`SECURITY INVOKER` mit `grant execute … to authenticated`; die Policy ist
`id = auth.uid() or has_level(3)`; das Aktivierungs-Gate sitzt in 46 Policies,
im Rumpf von `profiles_public` und in sieben DEFINER-RPCs. Nichts davon wird
berührt. Der Change vergrößert die **Erreichbarkeit**, nicht die **Preisgabe**.

## Goals / Non-Goals

**Goals:**

- Ein zweiter Einstieg in die vorhandene Suche, in der Kopfzeile, mit Tastatur
  und auf dem Telefon bedienbar.
- Jeder Zustand ist benannt: Treffer, echter Nulltreffer, zu niedrige Stufe,
  ausgeloggt.
- Der Suchbegriff kommt im Verzeichnis an — auch wenn es schon offen ist.

**Non-Goals:**

- Keine übergreifende Suche über Events, Beiträge, Academy.
- Keine neue RPC, kein neuer Index, keine Policy-Änderung, keine Migration.
- Keine anon-Suche in irgendeiner Form.
- Kein Umbau von `MemberDirectory` über die Begriffsübernahme hinaus.
- Keine Verlaufsliste, keine Vorschläge, kein „zuletzt gesucht".

## Decisions

### 1. Ausgeloggt entfällt das Feld — die Alternative ist ein Sicherheitsbau

`search_directory` ist für `anon` nicht ausführbar. Es gibt genau zwei Wege zu
einer anon-Suche: eine neue, für `anon` ausführbare `SECURITY DEFINER`-Funktion,
oder ein Grant auf die bestehende. Beide stellen das Mitgliederverzeichnis ins
offene Netz, vier Tage vor dem Go-Live mit 70 echten Mitgliedern.

Verworfene Alternative — **Feld sichtbar lassen, Eingabe führt auf `/login`**:
ehrlicher Aufhänger fürs Schaufenster, aber wieder ein Feld, das nicht sucht.
Das ist der Mangel, den dieser Change behebt; ihn in einer zweiten Fassung
stehen zu lassen wäre selbstwidersprüchlich.

Verworfene Alternative — **maskierte Treffer** („Ein Mitglied", ohne Profil):
eine Liste von Zeilen, die man nicht öffnen kann, ist schlechter als kein Feld,
und sie widerspräche AGE-291.

### 2. Unterhalb von `discover`: Hinweis statt Nulltreffer

Die Unterscheidung, die die Oberfläche treffen muss, ist **nicht** „leer" gegen
„voll", sondern „nichts gefunden" gegen „nichts zu sehen bekommen". Sie hängt am
eigenen Rang, den `useAuth()` ohnehin führt — es braucht dafür **keine** zweite
Abfrage und keine Fehlerauswertung.

Wichtig, und die Stelle, an der ein Nachbau kippen würde: `levelRank` ist kein
Sicherheitsmerkmal, sondern Komfort. Die Oberfläche SOLL deshalb trotzdem
abfragen und das Ergebnis zeigen, wenn eines kommt (das eigene Profil ist ein
legitimer Treffer). Der Hinweis ersetzt nur die **Formulierung des leeren
Falls** — er sperrt nichts.

Verworfene Alternative: das Feld unterhalb `discover` ebenfalls ausblenden.
Verschenkt den Aufstiegs-Moment im Augenblick der Absicht und macht die
Kopfzeile stufenabhängig verschieden.

Nicht `MembershipGate` wiederverwenden: das ist eine ganzseitige Wand mit Hero
und zwei Knöpfen. In einem Dropdown wäre sie grotesk. Der Hinweis ist eine Zeile
plus ein Link auf `/mitgliedschaft` — dieselbe Aussage, dieselbe Zielseite,
eigenes Markup.

### 3. Die Begriffsübernahme ist die riskanteste Stelle — und braucht ein ganzes Zustandsmodell

`MemberDirectory` hält den Suchtext in `useState("")`. Ein Anfangswert aus der
Adresszeile per `useState(param)` ist **die bekannte Falle dieses Repos**: kommt
der Wert erst nach dem Mounten, nimmt `useState` ihn nie an — grüner Test,
kaputte App. Genau dieser Fall tritt ein, sobald man auf `/mitglieder` steht und
aus der Kopfzeile erneut sucht.

Der erste Entwurf antwortete darauf mit „den Parameter als fortlaufende Quelle
behandeln". **Das ist kein vollständiges Zustandsmodell**, und der Plan-Review
hat drei Löcher darin gefunden. Das Modell heißt jetzt ausgeschrieben:

| Frage | Antwort | Warum nicht anders |
|---|---|---|
| Wer schreibt den Parameter? | **nur** die Kopfzeile | Schriebe das Verzeichnis beim Tippen zurück, hallte der Wert ins Feld und es wäre zu klären, wem die Entprellung gehört |
| Was passiert beim Aufbau mit Parameter? | Suchtext **und** Filterzustand kommen **synchron** aus dem Parameter | ein bloßer Effekt-Nachtrag ließe dazwischen eine **ungefilterte** Abfrage über das ganze Verzeichnis laufen — sie blitzt auf und landet im Zwischenspeicher |
| Was passiert bei späterer Navigation? | der Effekt setzt **nur** den Suchtext, die vorhandene Entprellung trägt ihn weiter | zwei Wege zu `filters.query` können einander umgehen |
| Woran hängt die Übernahme? | am **Navigationsereignis**, nicht am Wert | sonst bliebe derselbe Begriff nach lokalem Tippen wirkungslos |
| Push oder Replace? | Push | der Zurück-Weg soll zur vorigen Suche führen |

Die ersten beiden Zeilen sahen im Review wie ein Widerspruch aus (codex wollte
synchron initialisieren, gemini wollte den Effekt auf den Suchtext beschränken).
Sie sind keiner — es sind **zwei verschiedene Zeitpunkte**: Aufbau gegen
spätere Navigation.

Der Test dazu muss den Parameter **nach** dem Mounten ändern; einer, der ihn
vorbelegt, wäre vorher wie nachher grün. Und ein zweiter Test muss belegen, dass
beim Aufbau **mit** Parameter **keine** ungefilterte Abfrage läuft.

Verworfene Alternative: `MemberDirectory` beim Parameterwechsel per `key` neu
mounten. Funktioniert, wirft aber die Facetten-Abfrage und alle übrigen Filter
weg — der Nutzer verlöre bei jeder Kopfzeilen-Suche seine Auswahl.

Verworfene Alternative: den Begriff über den Router-`state` statt der
Adresszeile übergeben. Dann trüge ein geteilter oder neu geladener Link die
Suche nicht mehr.

Verworfene Alternative: das Verzeichnis beim Tippen in die Adresszeile
zurückschreiben lassen (die Adresszeile als einziger Zustand). Sauberer im
Modell, aber es braucht eine Echo-Sperre und eine Entscheidung über
`replace`-Rauschen im Verlauf — mehr Maschinerie, als ein zweiter Sucheinstieg
rechtfertigt.

### 3a. Enter unterhalb `discover` kann nicht ins Verzeichnis führen

`/mitglieder` trägt `minTier: "discover"` (`nav.ts:78`), und `App.tsx:31` legt
darüber ein `MembershipGate`. Unterhalb der Stufe **mountet `MemberDirectory`
nie** — der übergebene Begriff verschwände hinter einer Wand. Das
ursprüngliche, bedingungslose Versprechen war baulich unhaltbar; der Plan-Review
hat es gefunden.

Enter führt darunter deshalb auf `/mitgliedschaft`. Das ist dieselbe Zielseite,
auf die der Aufstiegs-Hinweis im Dropdown zeigt — eine Aussage, zwei Wege
dorthin, statt eines Wegs, der ins Leere läuft.

### 3b. Der Zwischenspeicher trägt keine Identität — und das ist eine Datenfrage

Es gibt **einen** globalen `QueryClient` (`main.tsx:14`), im ganzen Repo kein
`clear()`, und `directoryQueryKey` ist `["directory","search",f]` — **ohne
Nutzerkennung**. Die Ergebnisse sind RLS-gefiltert, also stufen- und
kontoabhängig. Ein `basic`-Konto, das sich nach einem `discover`-Konto anmeldet,
kann deren Treffer aus dem Zwischenspeicher gezeigt bekommen. Das Feld
auszublenden hilft nicht, weil das Feld nicht das Leck ist.

Innerhalb dieses Changes: eigener Schlüssel mit `user.id`, `enabled` defensiv,
laufende Suchen beim Identitätswechsel verwerfen und entfernen.

**Was das nicht behebt:** dieselbe Lücke im vollen Verzeichnis. Sie ist AGE-258
und liegt in `finish-ui-polish` (Aufgabe 2.1: den Zwischenspeicher beim Abmelden
**leeren**, nicht nur entwerten). Dieser Change schließt seinen eigenen neuen
Weg hinein und benennt den Rest, statt ihn mitzunehmen oder zu verschweigen.

### 3c. Drei leere Zustände, nicht einer

Ein Fehler ist keine leere Trefferliste. Netzausfall, abgelaufene Sitzung und
`42501` würden sonst als „nichts gefunden" oder — schlimmer — als „Aufstieg
nötig" erscheinen: ein Anmeldefehler, verkleidet als Verkaufsargument. Die
stufenabhängige Formulierung greift deshalb erst **nach** einer erfolgreichen,
leeren Antwort.

### 4. Das Dropdown ist eine Combobox, kein Menü

ARIA-Combobox über dem Feld, Listbox darunter, `aria-activedescendant` für den
hervorgehobenen Treffer. Tastatur: ↑ ↓ wandern, Enter wählt oder — ohne
Hervorhebung — führt ins Verzeichnis, Escape schließt und lässt den Fokus im
Feld.

**Nicht** in ein `fixed`-Overlay legen und **nicht** in eine Karte hängen: In
diesem Repo ist ein `position: fixed`-Overlay schon einmal in einer
`.fbc-card` gefangen worden, weil deren `:hover`-Transform einen neuen
Bezugsrahmen aufspannt. Die Kopfzeile ist keine Karte, aber die Liste wird
trotzdem absolut zum Feld positioniert, nicht fix zum Fenster — dann ist die
Frage gar nicht erst zu stellen.

### 5. Die Telefon-Fassung nimmt `useOverlay` — und muss den Rest selbst mitbringen

Genau der Mangel, den AGE-529 behoben hat: eine Sperre nur an einer Stelle macht
sie zur Ausnahme, und das nächste Overlay entsteht wieder ohne. Vier Overlays
benutzen den Hook heute; dies wird das fünfte.

**Was der Hook aber nicht tut** — im Review behauptet, an `useOverlay.ts:113`
nachgeprüft und bestätigt: er sperrt den Scroll und fängt **`Tab`**. Er setzt
**keinen Anfangsfokus** und behandelt **kein Escape**. (Den Fokus gibt er beim
Abbau zurück, Zeile 163.) Ein „nimmt `useOverlay`, damit ist die Bedienbarkeit
erledigt" wäre also falsch gewesen.

Die Fassung regelt daher selbst: Anfangsfokus ins Suchfeld, Escape und
Hintergrund schließen, Fokus zurück ans Lupensymbol — und **automatisches
Schließen beim Überschreiten der Umbruchbreite**. Ohne das Letzte versteckt CSS
die Fassung beim Verbreitern, während die Scroll-Sperre stehen bleibt: eine
Seite, die sich nicht mehr scrollen lässt und kein sichtbares Overlay hat.

### 5a. Die Liste schließt bei jedem Navigationsweg

`AppShell` wird beim Navigieren **nicht** neu aufgebaut. Ohne ausdrückliche Regel
bliebe die Trefferliste über der Zielseite stehen — nach Auswahl eines Treffers,
nach Enter, nach „alle Ergebnisse" und nach jedem Routenwechsel. Dazu Klick nach
außen. Der Reihenfolge wegen benannt: die Auswahl muss ankommen, **bevor** das
Schließen greift, sonst frisst ein Blur-Handler den Klick.

### 6. Was getestet wird — und was nur eine Sichtprobe zeigt

| Aussage | Womit belegt |
|---|---|
| Entprellung, Zwei-Zeichen-Schwelle (getrimmt), höchstens fünf | Komponententest mit falschen Zeitgebern |
| Veraltete Treffer und Hervorhebung verschwinden beim Weitertippen | Komponententest mit falschen Zeitgebern |
| Tastatur, Escape, Enter-ohne-Hervorhebung | Komponententest |
| Fünf Zustände (Treffer · Fehler · Nulltreffer · unter `discover` leer · unter `discover` mit eigener Zeile) | Komponententest, je Zustand einer |
| Ausgeloggt kein Feld, in beiden Breitenbereichen | Komponententest |
| Begriffsübernahme bei **bereits gemountetem** Verzeichnis | Test, der den Parameter NACH dem Mounten ändert |
| Beim Aufbau mit Parameter **keine** ungefilterte Abfrage | Test, der die RPC-Aufrufe aufzeichnet |
| Identitätswechsel verwirft Treffer und laufende Abfragen | Test, der ab-/anmeldet und die Schlüssel prüft |
| Schließen bei Auswahl, Navigation, Klick nach außen | Komponententest je Weg |
| Nicht aktiviertes Konto findet nichts | pgTAP oder roher Client gegen die Datenbank — **nicht** in jsdom |
| Lupensymbol, Breiten, kein Umbruch, Schließen beim Verbreitern | Sichtprobe im Browser bei echter Breite |

Der Mock deckt nur den Rand zur Datenbank ab. `vi.mock` auf eigene Komponenten
ist verboten — ein Test, der `HeaderSearch` mockt, prüft den Mock.

## Risks / Trade-offs

**Die Begriffsübernahme ist in jsdom grün und im Browser tot.**
→ Der Test ändert den Parameter nach dem Mounten; zusätzlich Sichtprobe:
`/mitglieder` öffnen, aus der Kopfzeile zweimal hintereinander verschieden
suchen.

**`levelRank` in der Oberfläche kann als Zugriffskontrolle missverstanden
werden.**
→ Die Abfrage läuft unabhängig davon; der Rang entscheidet nur die Formulierung
des leeren Falls. Steht so im Spec und gehört in den Code-Kommentar.

**Fünf Treffer sind eine stille Kappung.**
→ Deshalb ist „alle Ergebnisse" kein Zierrat, sondern Teil der Anforderung. Die
Zahl steht im Spec, damit sie niemand für ein Versehen hält.

**Die Kopfzeile ist eng — Lupensymbol, Logo, Glocke und Nutzermenü teilen sich
eine Zeile.**
→ Sichtprobe bei 320 px, 375 px und 640 px. macOS kann kein Fenster unter
500 px; die schmalen Breiten also über die Geräte-Emulation messen, nicht durch
Ziehen am Fenster.

**Der Change ist durch den Plan-Review gewachsen, und „rudimentär" ist das
Versprechen.**
→ Gewachsen ist der **Vertrag**, nicht der Umfang: Fehlerzustand,
Identitätsbindung, Escape und das Zustandsmodell der Adresszeile sind
Vollständigkeit an dem, was ohnehin gebaut wird. Nicht dazugekommen ist eine
einzige neue Fähigkeit — keine Verlaufsliste, keine Vorschläge, keine
übergreifende Suche. Kippt es doch, ist der Schnitt „Dropdown ohne Übergabe ans
Verzeichnis": das nähme die zwei schwersten Stellen heraus.

**Die installierten Versionen sind React 19.2.8 und react-router-dom 7.18.2**,
nicht React 18.
→ Annahmen über Effekt-Reihenfolge, `useSearchParams` und Navigationsverhalten
sind gegen diese zu prüfen. Der Fehler stand im Review-Prompt, nicht im Plan —
er wird hier festgehalten, damit er nicht beim Bauen wieder auftaucht.

**Die Suche findet `is_public`-Profile — nach dem Import stehen dort 70 echte
Menschen.**
→ Keine neue Preisgabe (das Verzeichnis zeigt dieselben Zeilen), aber der erste
Weg dorthin, der ohne Absicht benutzt wird. Der Aktivierungs-Nachweis in der
Abnahme ist deshalb keine Formalie: er ist die einzige Zusicherung, dass ein
importiertes, nie bestätigtes Konto nicht mitsucht.
