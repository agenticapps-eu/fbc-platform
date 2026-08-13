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

### 3. Die Begriffsübernahme ist die riskanteste Stelle

`MemberDirectory` hält den Suchtext in `useState("")`. Ein Anfangswert aus der
Adresszeile per `useState(param)` ist **die bekannte Falle dieses Repos**: kommt
der Wert erst nach dem Mounten, nimmt `useState` ihn nie an — grüner Test,
kaputte App. Genau dieser Fall tritt hier ein, sobald man auf `/mitglieder`
steht und aus der Kopfzeile erneut sucht: die Komponente ist längst gemountet,
nur der Suchparameter wechselt.

Der Weg ist deshalb, den Parameter als **fortlaufende Quelle** zu behandeln, nicht
als Anfangswert: ein Effekt, der auf den Parameter hört und `queryInput` sowie
`filters.query` nachzieht. Der Test dazu muss den Parameter **nach** dem Mounten
ändern — ein Test, der ihn vorbelegt, wäre vorher wie nachher grün und bewiese
nichts.

Verworfene Alternative: `MemberDirectory` beim Parameterwechsel per `key`
neu mounten. Funktioniert, wirft aber die Facetten-Abfrage und alle übrigen
Filter weg — der Nutzer verlöre bei jeder Kopfzeilen-Suche seine Auswahl.

Verworfene Alternative: den Begriff über den Router-`state` statt der
Adresszeile übergeben. Dann trüge ein geteilter oder neu geladener Link die
Suche nicht mehr.

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

### 5. Die Telefon-Fassung nimmt `useOverlay`, statt eine eigene Sperre zu bauen

Genau der Mangel, den AGE-529 behoben hat: eine Sperre nur an einer Stelle macht
sie zur Ausnahme, und das nächste Overlay entsteht wieder ohne. Vier Overlays
benutzen den Hook heute; dies wird das fünfte.

### 6. Was getestet wird — und was nur eine Sichtprobe zeigt

| Aussage | Womit belegt |
|---|---|
| Entprellung, Zwei-Zeichen-Schwelle, höchstens fünf | Komponententest mit falschen Zeitgebern |
| Tastatur, Escape, Enter-ohne-Hervorhebung | Komponententest |
| Vier Zustände (Treffer · Nulltreffer · unter `discover` · ausgeloggt) | Komponententest, je Zustand einer |
| Begriffsübernahme bei **bereits gemountetem** Verzeichnis | Test, der den Parameter NACH dem Mounten ändert |
| Nicht aktiviertes Konto findet nichts | pgTAP oder roher Client gegen die Datenbank — **nicht** in jsdom |
| Lupensymbol, Breiten, kein Umbruch der Kopfzeile | Sichtprobe im Browser bei echter Breite |

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

**Die Suche findet `is_public`-Profile — nach dem Import stehen dort 70 echte
Menschen.**
→ Keine neue Preisgabe (das Verzeichnis zeigt dieselben Zeilen), aber der erste
Weg dorthin, der ohne Absicht benutzt wird. Der Aktivierungs-Nachweis in der
Abnahme ist deshalb keine Formalie: er ist die einzige Zusicherung, dass ein
importiertes, nie bestätigtes Konto nicht mitsucht.
