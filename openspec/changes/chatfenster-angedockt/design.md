# Design — angedockte Chatfenster (AGE-639)

## Die Geometrie ist gemessen, nicht gewählt

> **Berichtigt nach der Plan-Review (gemini, als MEDIUM gemeldet, in Wahrheit
> HIGH).** Die erste Fassung dieser Tabelle zog nur die **rechte** Leiste ab und
> vergass die Navigationsleiste links — 16 rem offen, 4,5 rem als Rail
> (`AppShell.tsx:44`). Damit war jede Zahl darin zu gross, und die daraus
> abgeleitete Aussage „drei Fenster gehen bei 1280 px auf" war falsch. Die
> Entscheidung (höchstens drei) überlebt die Korrektur; ihre Begründung nicht.

Die Reihe steht **zwischen beiden Leisten**. Verfügbar ist also
`Viewport − links − rechts − 2 × 1 rem Rand`:

| Schirm | L 16 + R 4,5 (**Startzustand**) | L 16 + R 18 | L 4,5 + R 4,5 | L 4,5 + R 18 |
| --- | --- | --- | --- | --- |
| 1280 px (`xl`, 80 rem) | **57,5** | **44,0** | 69,0 | 55,5 |
| 1440 px (90 rem) | 67,5 | 54,0 | 79,0 | 65,5 |
| 1920 px (120 rem) | 97,5 | 84,0 | 109,0 | 95,5 |

Fenster à **18 rem** mit **0,5 rem** Abstand: `n × 18 + (n−1) × 0,5`.

| Fenster | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Bedarf | 18,0 | 36,5 | **55,0** | 73,5 |

Damit passen drei Fenster in **jede** Konfiguration bei 1280 px **ausser**
„beide Leisten aufgeklappt" (44,0 rem — dort passen zwei). Vier Fenster passen
bei 1280 px **nirgends**, auch minimiert nicht: Minimieren spart Höhe, nicht
Breite. Daraus folgt die harte Grenze von drei.

Warum 18 rem und nicht 19: mit 19 rem bräuchten drei Fenster 58 rem und passten
schon im **Startzustand** bei 1280 px nicht (57,5 rem). Ein halbes rem hätte die
ganze Entscheidung getragen — das ist der Grund, warum diese Tabelle nachgerechnet
wurde, statt sie zu behaupten.

### Wenn es doch nicht reicht: die Fenster werden schmaler, keines wird angeschnitten

Bei 1280 px mit **beiden** Leisten aufgeklappt bleiben 44 rem; drei Fenster à
18 rem brauchen 55 rem. Die erste Fassung wollte hier das linkeste Fenster
**abschneiden**. Beide Reviewer haben das zerlegt, und opencode am schärfsten:

> „Ein geclipptes Fenster ist halbiert mitten in der Sendezeile — ‚clipped
> rather than scrolled' löst das Platzproblem nicht, es versteckt es."

Das stimmt. Ein halbes Fenster mit halber Sendezeile ist kein Kompromiss,
sondern ein Defekt mit Ansage. Stattdessen:

**Die Fenster teilen sich den Platz.** `flex: 1 1 18rem` mit
`max-width: 18rem` und `min-width: 12rem`. Bei genug Platz sind sie 18 rem
breit; wird es eng, schrumpfen alle drei gleichmässig.

| Verfügbar | Je Fenster (3 Stück, 0,5 rem Abstand) |
| --- | --- |
| ≥ 55,0 rem | 18,0 rem (Deckel) |
| 44,0 rem (1280 px, beide Leisten offen) | **14,3 rem** |
| 37,0 rem | 12,0 rem (Boden — tritt ab `xl` nie ein) |

Der Boden von 12 rem wird bei `xl` **nirgends** erreicht: der engste Fall
überhaupt sind die 44 rem oben. `overflow: hidden` bleibt trotzdem an der Reihe
— als Riegel gegen einen Fall, den diese Rechnung nicht kennt, nicht als
geplantes Verhalten.

Warum das Donalds Absage an „unbegrenzt, Platz entscheidet" **nicht** verletzt:
verworfen wurde eine variable **Zahl** von Fenstern — „das Verhalten wäre nie
zweimal dasselbe". Die Zahl ist hier unverändert fest bei drei. Nur die Breite
gibt nach, und das tut in dieser Anwendung jede Spalte.

- **Kein** seitlicher Scrollbalken. Eine Seite, die sich seitlich schieben lässt,
  verletzt `design-system/spec.md:945`, und ausgerechnet ein Teil des Rahmens
  darf diese Zusage nicht brechen.
- Die Reihe ist links durch `--fbc-sidebar-w` begrenzt und rechts durch
  `--fbc-chat-w`. **Beide** — die erste Fassung kannte nur die rechte, und genau
  das war der Fehler oben.

Die Positionen sind **stabil in der Reihenfolge des Öffnens** und ordnen sich
beim Berühren nicht um. Ein Fenster, das unter der Hand nach rechts springt,
weil man hineingeklickt hat, verschiebt die Sendezeile unter dem Zeiger.

## Der Zustand: wo er liegt und warum dort

```ts
type Chatfenster = { threadId: string; minimiert: boolean; beruehrtAm: number };
```

`beruehrtAm` ist eine **monotone Zählnummer**, kein Zeitstempel. Sie beantwortet
genau eine Frage — „welches Fenster ist am längsten unberührt?" — und eine
Zählnummer beantwortet sie ohne Uhr. Ein `Date.now()` an dieser Stelle wäre
zusätzlich die zweite Uhr in einem Vergleich, und dieses Projekt hat schon
einmal gelernt, was das kostet (`markThreadRead`, `chat.ts:170`).

### Was als „berühren" zählt

Nicht nur Öffnen und Aufziehen (Plan-Review, gemini, LOW). Wer in einem Fenster
**schreibt**, benutzt es — würde nur das Klicken auf die Schalter zählen, könnte
ausgerechnet das Fenster geräumt werden, in dem gerade jemand tippt.

Berührt wird deshalb bei: Öffnen, Aufziehen, Senden, und bei **Zeiger- oder
Fokuskontakt** irgendwo im Fenster (`onMouseDownCapture`, `onFocusCapture`).

Der Zähler wird dabei **nur dann** erhöht, wenn dieses Fenster nicht ohnehin
schon das zuletzt berührte ist. Sonst löste jeder Mausklick in die Sendezeile
eine Zustandsänderung und ein Neuzeichnen der ganzen Reihe aus — für eine
Rangfolge, die sich gar nicht ändert.

Der Zustand liegt in **`AppShell`**, nicht in einem Context und nicht in einem
Store:

- Die Hülle wird beim Navigieren **nicht abgebaut** — genau das ist die Zusage
  „das Fenster überlebt den Seitenwechsel", und sie ist dort eine Eigenschaft
  der Montage, keine Verabredung.
- Beide `ChatPanel`-Montagepunkte (Rail und Schublade) liegen ohnehin in der
  Hülle. Ein Context hätte genau dieselben zwei Verbraucher und einen Anbieter
  mehr.

Als Hook `useChatfenster()` in `src/components/chat/use-chatfenster.ts`, weil
`AppShell` schon 920 Zeilen hat und der Zustand vier Übergänge kennt (öffnen,
minimieren, aufziehen, schliessen) plus die Verdrängungsregel.

### Gerätelokal gespeichert — und **je Konto**

Schlüssel **`fbc.chatFenster.<uid>`**, Inhalt `[{id, min}]`. Dieselbe Behandlung
wie `fbc.sidebarCollapsed` und `fbc.chatCollapsed`: `try/catch` um beide
Richtungen, und ein Fehlschlag kostet **nur das Erinnern**, nie den Betrieb.

**Die Kennung im Schlüssel ist der Unterschied zu den beiden bestehenden
Schlüsseln, und er ist notwendig** (Plan-Review, gemini, HIGH). `chatCollapsed`
trägt ein Ja/Nein über einen Arbeitsplatz — das darf ein zweites Konto am selben
Rechner erben. Eine Liste von Thread-Kennungen darf das nicht: meldet sich A ab
und B am selben Browser an, versuchte B, **As Gespräche** wiederherzustellen.

Was dabei nicht passiert und was doch: Nachrichten sieht B keine — die RLS lässt
für ihn keine Zeile dieser Threads durch, jedes Fenster liefe in seinen
Fehlerzustand. Was er sähe, ist die **Anzahl** der Gespräche, die A zuletzt offen
hatte, samt drei Fehlermeldungen, die er sich nicht erklären kann. Das ist kein
Datenabfluss und trotzdem falsch, und es kostet ein Suffix, es zu verhindern.

Aus demselben Grund **kein Aufräumen fremder Schlüssel** beim Abmelden: das wäre
eine zweite Stelle, die dieselbe Regel kennen muss. Der Schlüssel, den niemand
mehr liest, kostet nichts.

`beruehrtAm` wird **nicht** gespeichert. Nach dem Laden bekommen die
wiederhergestellten Fenster ihre Reihenfolge aus dem Feld selbst — die
gespeicherte Reihenfolge *ist* die Reihenfolge. Einen Zähler zu speichern hiesse,
eine Zahl über Sitzungen hinweg gültig zu halten, die nur innerhalb einer
Sitzung etwas bedeutet.

**Beim Wiederherstellen wird nichts geprüft.** Ein Thread, den es nicht mehr
gibt oder der nicht mehr sichtbar ist, liefert beim Laden seiner Nachrichten
einen Fehler — und dafür gibt es bereits einen Zustand (das Fenster zeigt
„konnte nicht geladen werden"). Eine Vorabprüfung wäre eine zweite Wahrheit über
denselben Bestand, und dieses Projekt hat dafür eine Regel.

Gekappt wird trotzdem: mehr als drei gespeicherte Einträge werden beim Laden
auf die letzten drei gekürzt. Ein Speicher, den jemand von Hand füllt, darf die
Reihe nicht sprengen.

## Realtime: ein Kanal, nicht N

Der naive Weg wäre `subscribeToThread` je Fenster — drei Fenster, drei Kanäle,
plus der bestehende für den Zähler. Der Kommentar an `subscribeToAllMessages`
(`chat.ts:207`) warnt ausdrücklich davor, und er warnt aus Erfahrung.

**Es gibt bereits genau einen Kanal, der alle Threads abdeckt**:
`useUngelesenLive` in der Hülle. Er bekommt jede eingehende Nachricht, die die
RLS durchlässt. Die Fenster hängen sich daran, statt eigene aufzumachen.

Zwei Zeilen in dessen Rückruf, **vor** der Pfad-Bedingung:

```ts
queryClient.setQueryData<ChatMessage[]>(
  messagesQueryKey(nachricht.threadId),
  (prev) => (prev ? mergeMessage(prev, nachricht) : prev),
);
```

`prev ? … : prev` ist die ganze Logik: **nur ein Cache-Eintrag, den es schon
gibt, wird fortgeschrieben.** Ein Eintrag existiert genau dann, wenn eine Fläche
diesen Thread gerade lädt oder zeigt. Damit weiss dieser Rückruf nichts über
Fenster, und es entsteht keine zweite Stelle, an der „welche Threads sind
offen?" beantwortet werden müsste.

**Belegt statt angenommen** (Plan-Review, opencode, MEDIUM — er verlangte für
diese Annahme denselben Codeverweis wie für die anderen, zu Recht):

- Der Cache unter `messagesQueryKey` ist ein **flaches `ChatMessage[]`**, keine
  paginierte Struktur: `ChatPage.tsx:62` ist ein `useQuery` mit
  `queryFn: () => fetchMessages(activeId!)`, und `fetchMessages`
  (`chat.ts:320`) gibt `ChatMessage[]` zurück. Es gibt dort keinen Cursor und
  kein `pages`-Feld.
- Genau dieser Aufruf steht **schon heute** so im Repo — `ChatPage.tsx:86`
  schreibt `setQueryData<ChatMessage[]>(messagesQueryKey(activeId), (prev) =>
  mergeMessage(prev ?? [], incoming))`. Neu ist nur das `prev ? … : prev`
  statt `prev ?? []`.
- `use-ungelesen.ts` importiert bereits aus `../../lib/chat`;
  `mergeMessage` und `messagesQueryKey` kommen aus demselben Modul, es entsteht
  kein Zirkel.

**Das Wettrennen bleibt, und es ist ein bekanntes:** trifft eine Nachricht ein,
bevor der erste `fetchMessages` eines gerade geöffneten Fensters zurück ist,
gibt es keinen Eintrag, `prev` bleibt `prev`, und die Nachricht fällt weg. Das
ist wortgleich die Lücke, die `ChatPage.tsx:81` seit AGE-248 benennt („zwischen
initialem fetchMessages und aktivem Channel eintreffende Nachrichten erscheinen
erst beim nächsten Refetch"). Dieser Change macht sie **nicht grösser** und
schliesst sie nicht — sie zu schliessen wäre ein eigener Vorgang für beide
Flächen.

Dass `ChatPage` daneben sein eigenes `subscribeToThread` behält, ist Absicht und
kostet nichts: `mergeMessage` ist über die `id` idempotent. Diese Leitung
anzufassen hiesse, die sorgfältig begründete Entflackerung in `ChatPage`
(`:83–101`) neu zu verhandeln — ein anderer Vorgang.

**Die Zusage „Fenster fügen keinen Kanal hinzu" trägt eine Bedingung**
(Plan-Review, opencode, Annahme 6): sie gilt, weil Fenster und `ChatPage` **nie
gleichzeitig montiert** sind — die Reihe steht auf den Chatrouten nicht, aus
demselben Grund, aus dem die Leiste dort nicht steht. Diese Bedingung steht
deshalb im Spec-Delta als Anforderung und nicht nur hier im Fliesstext.

### Der Zähler darf nicht zucken

`useUngelesenLive` überspringt die Neuzählung heute, wenn die Nachricht in das
Gespräch gehört, das gerade offen **vor** einem liegt:

```ts
if (pfad.current === `/chat/${nachricht.threadId}`) return;
```

Der Grund steht dort ausführlich: sonst steigt die Blase auf 1 und fällt beim
nächsten Abgleich zurück. Mit Fenstern gibt es eine **zweite** Art, ein Gespräch
vor sich zu haben. Die Bedingung wird deshalb verallgemeinert — ein neuer
Parameter:

```ts
useUngelesenLive(uid, pathname, sichtbareThreads: ReadonlySet<string>)
```

`sichtbareThreads` sind die Threads **aufgezogener** Fenster. Ein minimiertes
Fenster gehört nicht dazu: es ist nicht gelesen worden, und sein Zähler soll
laufen.

Der neue Parameter ist **erforderlich, nicht optional**. Ein Vorgabewert hätte
den einen Aufrufer stillschweigend beim alten Verhalten gelassen, und genau
solche Vorgabewerte sind die, die niemand mehr entfernt.

## `useGespraech` — eine Definition für Vollansicht und Fenster

Ein Fenster braucht dasselbe wie `ChatPage`: den Nachrichtenverlauf, das
Vorrücken des Lesestands und optimistisches Senden mit Rücknahme. Das sind rund
siebzig Zeilen.

Sie werden **geteilt**, nicht kopiert — `src/components/chat/use-gespraech.ts`,
benutzt von `ChatPage` und von `ChatFenster`. Das ist die Hausregel dieses
Moduls, nicht eine Vorliebe: `useThreadsSeite` und `useUngelesen` existieren aus
genau demselben Grund, und AGE-638 hat gerade erst aufgeräumt, was passiert,
wenn zwei Flächen dasselbe aus zwei Quelltexten tun.

```ts
useGespraech({ threadId, myId, aktiv })
  → { messages, isLoading, isError, sende }
```

`aktiv` steuert nur das Vorrücken des Lesestands. `ChatPage` übergibt
`Boolean(activeId)`, ein Fenster `!minimiert` — der Parameter ist damit an
beiden Aufrufstellen wirksam und an keiner toter Code.

**Ein minimiertes Fenster lädt seinen Verlauf trotzdem**, und der tragende Grund
dafür ist nicht der, der hier zuerst stand (Plan-Review, opencode, LOW — er hat
die schwächere Begründung als solche erkannt):

- *Schwach:* „sonst hätte der Zähler an seiner Titelzeile nichts, worauf er sich
  bezieht." Stimmt nicht — der Zähler kommt aus `ungelesen.jeThread`, also aus
  `unread_message_counts()`, und die RPC ist **ungeseitet** (`chat.ts:156`, kein
  `range`). Sie liefert jeden Thread mit Ungelesenem, auch einen, der ausserhalb
  der geladenen Threadliste liegt. Der Zähler steht also unabhängig vom Verlauf.
- *Tragend:* **der Merge-Pfad bricht ohne Cache-Eintrag.** `prev ? … : prev`
  schreibt nur fort, was schon da ist. Lüde ein minimiertes Fenster nichts, fiele
  jede Nachricht, die während des Minimiertseins eintrifft, aus dem Cache — und
  beim Aufziehen stünde ein Verlauf da, dem genau die neuen Zeilen fehlen, bis
  ein Refetch sie nachholt.

Damit steht auch die Kostenseite ehrlich da: drei minimierte Fenster halten drei
Verläufe im Speicher. Das ist der Preis dafür, dass Aufziehen sofort das Richtige
zeigt.

### Das Vorrücken hängt an der letzten FREMDEN Nachricht

`ChatPage` markiert heute an zwei Stellen: einmal beim Öffnen (Effect an
`activeId`) und einmal je eingehender fremder Nachricht (im Abo). Im geteilten
Hook wird daraus **ein** Effect:

```ts
const letzteFremde = messages.findLast((m) => m.senderId !== myId)?.id;
useEffect(() => { if (aktiv) void markThreadRead(...) }, [threadId, myId, aktiv, letzteFremde]);
```

Das feuert beim Öffnen, bei jeder eingehenden fremden Nachricht und beim
Aufziehen eines minimierten Fensters — und **nicht** beim eigenen Senden. Die
Zahl der Schreibvorgänge bleibt damit dieselbe wie heute; der Kommentar in
`ChatPage:68`, ein Effect über `messages` schriebe je Zeile erneut, trifft eine
Abhängigkeit an `messages.length` und nicht diese hier.

Ein Fehlschlag bleibt folgenlos (`.catch(() => {})`), aus dem Grund, der schon
dort steht: das Gespräch darf nicht an seiner Buchführung scheitern.

## Die Fensterreihe: Portal, Stapel, Nachbarn

### Portal an `document.body`

Nicht verhandelbar. Dieses Repository hat sich zweimal ein `position: fixed`
eingefangen, weil ein Vorfahre `transform` oder `backdrop-filter` trug —
`.fbc-card:hover` und der `<header>` mit `backdrop-blur`. `FeedbackButton`
trägt den Kommentar dazu bereits (`:125`). Die Reihe wird deshalb an
`document.body` portaliert, nicht in den Baum der Hülle gerendert.

### Stapelordnung

| Ebene | Was |
| --- | --- |
| `z-[60]` | DesignSwitcher (temporär, AGE-237/440) |
| `z-50` | Modale Overlays, Schubladen, **Toasts**, Profilmenü |
| `z-40` | Beide angedockten Leisten, Suchvorhang |
| **`z-30`** | **Fensterreihe**, Kopfzeile |
| — | Inhalt |

Die Reihe liegt **unter** allen modalen Flächen. Das ist richtig herum: ein
Overlay mit Scrim sperrt die Seite dahinter (`design-system/spec.md:586`), und
ein Chatfenster, das über dem Scrim stünde, wäre eine sichtbare, aber
unbedienbare Ausnahme von dieser Zusage.

Die Reihe berührt die Leisten nicht: sie sitzt links neben der rechten Leiste
und die linke steht am anderen Rand. Die Kopfzeile liegt oben, die Reihe unten;
bei 26 rem Fensterhöhe treffen sie sich erst unterhalb von 30 rem
Viewport-Höhe — dort ist die Reihe ohnehin abgeschnitten, und `xl` sagt nichts
über die Höhe.

### Die Toasts weichen aus

Gemessen: Toasts stehen bei `right-6` und sind bis 24 rem breit, also von 1,5
bis 25,5 rem vom rechten Rand. Die Reihe beginnt bei
`1 rem + Leistenbreite`, also bei 5,5 rem (eingeklappt). Sie überlappen — und
zwar in der Ecke, in der die **Sendezeile** des rechtesten Fensters sitzt. Der
Toast, der als erster dort landen würde, ist ausgerechnet „Nachricht nicht
gesendet".

Ausgeglichen über **eine geteilte CSS-Variable**, dasselbe Verfahren, mit dem
der Rahmen schon heute `--fbc-chat-w` verteilt:

```
--fbc-fenster-h : 0rem  |  2.75rem (nur minimierte)  |  26rem
Toast: bottom: calc(1.5rem + var(--fbc-fenster-h, 0rem))
```

Die Variable wird an **`document.documentElement`** geschrieben, aus einem
Effect in der Hülle. Nicht am Wurzel-`div` der Hülle: der `ToastProvider` steht
in `main.tsx:30` **oberhalb** von `App` und sähe eine dort gesetzte Variable nie.
An `:root` sieht sie jeder Knoten im Dokument, der Toast-Container inbegriffen —
er ist nicht portaliert, sondern steht im Baum des Providers (`Toast.tsx:37`),
also unter `<html>`.

**Sie wird auch wieder abgeräumt** (Plan-Review, opencode, LOW). Die Variable
folgt dem Zustand, und der Zustand kennt drei Werte statt zweier:

| Lage | Wert |
| --- | --- |
| Reihe steht nicht (Chatroute, unter `xl`, kein Fenster offen) | `0rem` |
| nur minimierte Fenster | `2.75rem` |
| mindestens ein aufgezogenes | `26rem` |

Weil der Wert aus demselben Ausdruck kommt, der über das Rendern der Reihe
entscheidet, fällt er beim Routenwechsel auf `/chat` von selbst auf `0rem`.
Zusätzlich räumt der Effect beim **Abbauen der Hülle** auf — beim Abmelden liegt
`/login` ausserhalb von `AppShell`, und eine an `:root` hängengebliebene
`26rem` liesse die Toasts dort ohne Grund in der Luft schweben.

**Der DesignSwitcher bekommt keinen Ausgleich.** Er ist ein Prüfwerkzeug, das
nach Detlevs Design-Entscheidung entfällt (AGE-440), er liegt auf `z-[60]` über
allem, und ihn hier einzurechnen hiesse, eine temporäre Fläche in einer
dauerhaften Rechnung zu verankern.

### Wohin der Fokus geht, wenn ein Fenster verschwindet

Plan-Review, opencode, MEDIUM — und in der ersten Fassung schlicht nicht bedacht.
Wird ein Fenster geschlossen, während der Fokus darin steht, fällt er auf
`document.body`, und wer mit der Tastatur arbeitet, steht mitten im Nichts.

Geregelt wird genau **ein** Fall, und zwar der, der wirklich eintritt:

- **Schliessen über den eigenen Schalter.** Der Fokus steht dann sicher im
  Fenster. Er wandert auf den Minimieren-Schalter des jetzt rechtesten
  verbliebenen Fensters; ist keines mehr da, auf den Pill der Nachrichten-Leiste
  (`[data-leisten-pill="rechts"]`), der immer steht, solange die Reihe stehen
  konnte.
- **Verdrängung durch ein viertes Gespräch** braucht keine Regel: der Klick, der
  sie auslöst, liegt in der Leiste, der Fokus also ohnehin dort. Ein `mousedown`
  verschiebt ihn, bevor die Verdrängung passiert.

Keine allgemeine Fokusverwaltung, kein `useOverlay`: die Fenster sind **nicht
modal**, sie fangen den Fokus nicht ein, und sie sperren die Seite nicht.

### Drei Annahmen, die ausgesprochen gehören

Alle drei aus der Plan-Review (opencode), alle drei **angenommen**, nicht
behoben:

1. **Zwei Tabs überschreiben einander.** Wer die Anwendung in zwei Tabs offen
   hat, dessen zuletzt schreibender Tab gewinnt `fbc.chatFenster.<uid>`. Das ist
   bei `fbc.sidebarCollapsed` und `fbc.chatCollapsed` seit AGE-499 genauso; hier
   wird es nur zum ersten Mal aufgeschrieben. Ein `storage`-Ereignis abzuhören
   wäre eine Synchronisierung zwischen Tabs, und die hat dieses Projekt nirgends.
2. **Unter `xl` verschwindet die Reihe, der Zustand bleibt.** Wer das
   Browserfenster verkleinert, sieht die Fenster nicht mehr; beim Verbreitern
   sind sie wieder da. Gewollt — der Zustand liegt in der Hülle, nicht in der
   Reihe — und in der Sichtprobe zu prüfen.
3. **Der Zähler eines minimierten Fensters kennt keine Umfangsgrenze.** Er kommt
   aus `unread_message_counts()`, und die ist ungeseitet. Das ist kein Zufall,
   auf den man sich verlässt, sondern in `chat.ts:156` nachgesehen.

## Was die Fenster NICHT vom Rahmen erben

Ein Chatfenster ist **gerundet und schwebend** — genau das, was
`design-system/spec.md:243` für die Leisten ausschliesst. Die Abgrenzung steht
im Spec-Delta, und sie ist inhaltlich, nicht ausweichend:

Die Doktrin sagt „the frame of the application, not a card floating on it". Sie
handelt von den **Kanten** — davon, dass der Rahmen bündig am Viewport sitzt und
nicht als Karte in einem zentrierten Container hängt. Sie hat nie jedes Element
über dem Inhalt gemeint; täte sie das, wären Toasts, Overlays, das Profilmenü
und die Hinweisglocke seit jeher Verstösse. Ein Chatfenster reiht sich in diese
Klasse ein: Werkzeug **im** Rahmen, nicht Teil des Rahmens.

## Abgelehnte Alternativen

**Fensterzustand im Query-Parameter (`?chat=a,b`).** Löste Reload und
Zurück-Taste geschenkt. Abgelehnt (Donald, 27.08.): jede Adresse trüge den
Arbeitszustand mit, und ein geteilter Link öffnete beim Empfänger Fenster zu
Gesprächen, an denen er nicht teilnimmt — die Threads sind für ihn per RLS gar
nicht sichtbar, das Fenster liefe also garantiert in einen Fehler.

**Minimieren zu einer Avatar-Blase.** Spart mehr Breite. Abgelehnt (Donald,
27.08.): der Name verschwindet. Bei drei Blasen müsste man die Gesichter kennen,
und ohne hinterlegtes Bild steht dort ein einzelner Buchstabe — `Avatar` fällt
auf die Initiale zurück.

**Unbegrenzt viele Fenster, der Platz entscheidet.** Abgelehnt (Donald,
27.08.): das Verhalten hinge an der Fenstergrösse, wäre nie zweimal dasselbe und
liesse sich schwer prüfen.

**Ein Riegel gegen das vierte Fenster („erst eines schliessen").** Abgelehnt:
ein Klick in der Leiste, der nichts tut, ist schlechter als einer, der einen
Platz räumt — zumal das Geräumte einen Zentimeter daneben weitersteht.

**Fenster auch unterhalb von `xl`.** Bei 1024 px bliebe neben der Leiste
Platz für zwei; ohne Leiste für drei. Abgelehnt: unterhalb von `xl` steht die
Leiste gar nicht angedockt, sondern als Schublade — ein Fenster, das aus einer
modalen Schublade heraus aufgeht, während diese sich schliesst, ist ein
zweiter Bewegungsablauf für dasselbe Ziel. Der Umbruchpunkt bleibt der der
Leiste.

## Risiken

| Risiko | Wie es sich zeigt | Gegenmassnahme |
| --- | --- | --- |
| Die Reihe läuft nach links über | Fenster unter der Navigationsleiste | `max-width` an der Reihe, Überlauf abgeschnitten (kein seitliches Schieben) |
| Ein wiederhergestelltes Fenster zeigt einen toten Thread | Fehlermeldung im Fenster | ist der vorgesehene Zustand; kein Vorab-Prüflauf |
| Drei Verläufe auf einmal beim Laden | drei `fetchMessages` beim Start | in Kauf genommen: drei Abfragen à einer Thread-Historie, nur für den, der drei Fenster offen gelassen hat |
| Der Ungelesen-Zähler zuckt | Blase springt auf 1 und zurück | `sichtbareThreads` in `useUngelesenLive`; im Browser gegen ein aufgezogenes **und** ein minimiertes Fenster geprüft |
| jsdom sieht die Geometrie nicht | grüne Tests, schiefe Reihe | Breiten und Überlauf werden **im Browser** gemessen, nicht in Zusicherungen behauptet |
