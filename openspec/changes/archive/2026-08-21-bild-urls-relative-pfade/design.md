# Entwurf

## Die Entscheidung: Pfad in der Spalte, URL beim Anzeigen

### Verworfene Alternativen

**(B) Absolute URLs behalten, beim Umzug den Host austauschen.** Das ist
Schritt 3b des Neuaufbau-Plans. *Verworfen:* die Korrektur wird bei **jedem**
Projektwechsel erneut fällig, nichts erzwingt sie, und ihr Ausbleiben ist
unsichtbar — kein Grant-Test, keine Zeilenzählung und kein Typ-Fehler zeigt ein
leeres Profilbild. Genau so ist der Befund entstanden: er fiel erst bei einer
Sichtprobe im Browser auf.

**(C) Die URL serverseitig bauen**, in `profiles_public` oder den vier
DEFINER-RPCs. *Verworfen aus zwei Gründen.* Erstens müsste die Projektkennung
dafür in die Datenbank — die Kopplung wäre nicht beseitigt, sondern an eine
schlechtere Stelle verschoben, wo ein Umzug sie zusätzlich mitziehen müsste.
Zweitens dupliziert diese Fläche ihr Prädikat bereits an vier Stellen
(`profiles_public` mit `security_invoker=off` plus vier RPCs); jede neue Logik
dort braucht vier Änderungen, sonst ist sie Kulisse.

**(D) Über den Anwendungs-Origin ausliefern (Proxy).** *Verworfen:* es gibt
keinen Proxy, und einen einzuführen, um zwei Spalten zu entkoppeln, ist
Infrastruktur für ein Textproblem.

**(A) Gewählt: Pfad speichern, beim Anzeigen auflösen.** Es ist das Muster, das
für `event-covers` und `post-media` in diesem Repo bereits steht — nur einfacher,
weil `avatars` und `covers` öffentliche Buckets sind und keine Signatur brauchen.
Der Auflöser ist damit eine **reine Funktion**: keine Netzwerkrunde, kein
`async`, keine Lookup-Map, kein Cache.

## Der Auflöser

Eine Funktion, ein Modul, zwei Aufrufer-Arten:

```
bildUrl(bucket: "avatars" | "covers", wert: string | null): string | null
```

**Die tragende Regel: was schon absolut ist, wird unverändert durchgereicht.**
Ein nackter Pfad bekommt Bucket und Host davor.

Das ist bewusst *kein* „Fehlerbehandlung für einen Fall, der nicht eintreten
kann" — es sind zwei Fälle, die heute eintreten:

| Eingabe | Woher sie kommt | Ergebnis |
|---|---|---|
| `uid/1234.webp` | neue Uploads, migrierte Bestandszeilen | Host + Bucket davor |
| `https://….supabase.co/storage/…` | Bestandszeilen vor der Migration, ältere ausgelieferte Fassung | unverändert |
| `blob:http://localhost/…` | **die Editor-Vorschau beim Hochladen** | unverändert |
| `null` | kein Bild gesetzt | `null` |

Der `blob:`-Fall ist der, den ein Test in jsdom nicht findet und der die
Bildvorschau im Profil-Editor still zerstören würde. Er gehört deshalb in die
Testliste **und** in eine Sichtprobe im Browser.

## Wo der Auflöser aufgerufen wird

Nicht in den Mappern. `src/lib/directory.ts` reicht mit
`Database[…]["search_directory"]["Returns"][number]` den **rohen** RPC-Typ
durch — es gibt dort keinen Mapper, in den etwas hineinpasste. Ein Ansatz
„Auflöser in jeden Mapper" hätte genau hier ein Loch, und das Loch wäre die
meistbesuchte Fläche der Anwendung.

Stattdessen an den drei Stellen, die tatsächlich ein Bild **anzeigen**:

| Stelle | Warum sie einzeln zählt |
|---|---|
| `src/components/ui/Avatar.tsx` | einziger Trichter für Profilbilder — nachgemessen: kein `<img>` daneben rendert einen Avatar |
| `src/components/profile/ProfileHero.tsx` | Hintergrundbild, zwei Seiten |
| `src/pages/ProfilPage.tsx:287` | Cover-Vorschau im Editor, rendert den gespeicherten Wert an `ProfileHero` **vorbei** |

`Avatar` deckt damit auch `ProfilPage:262` und alle Listenflächen ab.

## Die Migration

**Diese Entscheidung wurde im Plan-Review gedreht.** Der erste Entwurf verbot,
die Projektkennung hart zu schreiben — sonst trüge die Migration die Kopplung,
die sie beseitigen soll. Dagegen steht ein besseres Argument: eine **einmalige
historische** Migration ist keine Laufzeitkopplung, und das weite Muster
`https://<irgendeine>.supabase.co/…/avatars/` schnitte auch eine absichtlich
externe URL aus einem *fremden* Supabase-Projekt mit gleichnamigem Bucket um —
im Widerspruch zum eigenen Szenario „fremde Werte bleiben unangetastet".

Die Auflösung ist besser als beide Ausgangspositionen: **umgeschnitten wird nur,
wenn das Objekt lokal nachweislich existiert.** Der extrahierte Pfad muss sich in
`storage.objects` mit passendem `bucket_id` und `name` wiederfinden.

Damit ist die Migration weder an eine Kennung gebunden noch je zu breit — sie
fasst genau die Werte an, deren Bild danach auch wirklich da ist. Ein fremd
gehostetes Bild überlebt, weil sein Objekt hier nicht liegt.

Jede Spalte nur gegen ihren eigenen Bucket: `avatar_url` gegen `avatars`,
`cover_url` gegen `covers`. Werte, die nicht passen, bleiben unangetastet — eine
Migration, die im Zweifel zuschneidet, macht aus einem falschen Wert einen
unrettbaren.

## Die Auslieferung zerfällt in zwei Stufen

Der schwerste Befund des Plan-Reviews, und er betrifft nicht den Code, sondern
die Reihenfolge:

| Reihenfolge | Was bricht |
|---|---|
| Migration zuerst | ein **altes** Bundle bekommt `uid/123.webp` und rendert `<img src="uid/123.webp">` — relativ zum Anwendungs-Origin, also ein totes Bild auf der **ganzen Fläche** |
| Erzeuger zuerst | neue Pfade in einer Datenbank, deren Leser sie noch nicht auflösen |

Das Durchreichen deckt nur „neuer Leser, alter Wert", nicht die Gegenrichtung.

**Stufe 1 ist nur der Leser** und für sich folgenlos: alle Bestandswerte sind
absolut und werden durchgereicht, es ändert sich nichts Beobachtbares. Erst wenn
sie **am ausgelieferten Bundle** nachweislich live ist, folgt Stufe 2 mit
Erzeugern und Migration.

Warum das nicht als ein Merge geht: `migrate-dev` wendet Migrationen auf `main`
automatisch an, der Frontend-Deploy läuft daneben. Die Reihenfolge wäre dem
Zufall überlassen.

## „Absolut" heisst: trägt ein URI-Schema

Keine Liste erlaubter Schemata. Der erste Entwurf zählte `https`, `blob` und
`data` auf — und übersah `http`, unter dem der **lokale Stack** läuft
(`supabase/config.toml:10`, Port 54321). Eine Whitelist hätte genau die lokalen
Entwicklungswerte beschädigt.

Nebenbei erledigt sich damit die Frage nach `data:`: nachgemessen entsteht sie
nirgends — alle Vorschauen laufen über `URL.createObjectURL` und liefern `blob:`.

## Was diese Change NICHT tut

- Keine Umstellung von `event-covers` oder `post-media` — die sind schon richtig.
- Kein Rückweg-Werkzeug. Die Migration ist vorwärts gerichtet; der Auflöser
  reicht absolute Werte ohnehin durch, ein Rückbau ist also nicht nötig.
- Keine Änderung an den Bucket-Policies oder am Aktivierungs-Gate.
