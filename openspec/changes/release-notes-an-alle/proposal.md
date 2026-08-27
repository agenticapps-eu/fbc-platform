# Release-Notes: archivierte Changes als redigierbare Nachricht an alle Mitglieder

Linear: **AGE-631**

## Why

Mitglieder erfahren heute **gar nicht**, dass sich die Anwendung geändert hat.
Gemessen am 27.08.: es gibt keine Änderungsliste, keine Ankündigung, keinen
Hinweistyp dafür — die vier Typen aus AGE-620 melden ausschliesslich, was
*andere Mitglieder* tun (Beitrag, Event, Kommentar, Reaktion). Was *wir* tun,
meldet nichts.

Gleichzeitig liegt das Material vollständig vor: **50 archivierte Changes**
unter `openspec/changes/archive/`, jeder mit Titel und einem Abschnitt
„What Changes". Ein archivierter Change ist genau das, was ein Mitglied
interessiert — er wird zusammen mit dem Code archiviert, ist also ausgeliefert.

Donald am 27.08.:

> „Ich möchte die User informieren, was es Neues in der App gibt. Dafür haben
> wir ja die OpenSpec-Changes … Dafür hätte ich aber gerne, dass man ein neues
> Release in Administration sieht, den Text prüft und korrigieren kann, mehrere
> neue Sachen zu einer Nachricht zusammenfassen kann und dann in die
> Notifications von allen Usern schickt."

**Die Redaktion ist der Kern, nicht die Zutat.** Ein Proposal ist für
Entwickler geschrieben. „notify-contact-request liest über eine DEFINER-RPC
statt als service_role" ist ein wahrer Satz, der einem Mitglied nichts sagt.
Ein Automatismus, der solche Titel verschickt, wäre schlechter als gar nichts.

**Und das Archiv ist keine saubere Datenquelle.** Gemessen, nicht angenommen:

| Eigenschaft | Befund |
| --- | --- |
| Archivierte Changes | **50** |
| davon mit `# Titel` in Zeile 1 | **29** — die übrigen **21** beginnen direkt mit `## Why` |
| davon mit `Linear:`-Zeile | **32** von 51 Dateien; **19** ohne |
| Verzeichnisname `JJJJ-MM-TT-<slug>` | 50 von 50 parsebar |
| Titellänge (wo vorhanden) | 36 / 57 / 89 Zeichen (min / median / max) |

Der einzige verlässliche Teil ist der **Verzeichnisname**. Alles andere ist ein
Vorschlag, den ein Mensch prüfen muss — was die Anforderung ohnehin verlangt.

## What Changes

- **Ein Admin sieht die noch nicht angekündigten Changes.** Die Liste entsteht
  zur **Bauzeit** aus `openspec/changes/archive/` als erzeugtes Modul und liegt
  damit im ausgelieferten Bündel. Kein CI-Geheimnis, kein `service_role`-Weg in
  die Datenbank, keine zweite Tabelle für Einträge.
- **Er wählt mehrere aus und bekommt einen Entwurf**, den er frei überschreibt.
  Der Entwurf ist ein Vorschlag, kein Ergebnis.
- **Eine neue Tabelle `release_notes`** hält Titel, Text, die Menge der
  abgedeckten Verzeichnisnamen und den Zustand `draft` / `sent`.
- **Eine `SECURITY DEFINER`-RPC `send_release_note(id)`** stellt zu: sie schaltet
  den Zustand **bedingt** um und schreibt erst dann je aktiviertem Mitglied eine
  `notifications`-Zeile vom Typ `release_note`. **Zweimal senden ist
  ausgeschlossen**, und zwar in der Datenbank, nicht im Knopf.
- **Ein neuer Hinweistyp `release_note`** in der Glocke, mit eigenem Renderer.
- **Eine Seite `/neues`**, die alle zugestellten Release-Notes zeigt. Ohne sie
  wäre ein weggeklickter Hinweis unauffindbar: die Glocke liest nur ungelesene
  und deckelt bei 50 (`hinweise.ts:31`).
- **Ein Menüeintrag** in der Administration — die Anforderung „Das
  Administrationsmenü trägt seine Flächen vollständig" gilt auch für diese.

## Was ausdrücklich NICHT dazugehört

- **Kein E-Mail-Versand.** Die Anforderung lautet auf „Notifications".
- **Keine Empfängerauswahl.** Der Kreis ist „alle aktivierten Mitglieder" und
  sonst nichts — das ist der Grund, warum diese Fläche nicht das ist, was
  AGE-304 verboten hat (siehe `specs/admin/spec.md` in diesem Change).
- **Kein CRM, kein Themen-Newsletter.**
- **Keine öffentliche Changelog-Seite für Gäste.**
