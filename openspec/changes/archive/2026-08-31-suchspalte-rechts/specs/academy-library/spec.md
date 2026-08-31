## ADDED Requirements

### Requirement: Die Academy hat Suche, Hashtags und Sortierung in einer rechten Spalte

Die Academy SHALL eine rechte Inhaltsspalte führen, die beim Blättern mitläuft,
mit denselben Massen und demselben Umbruchverhalten wie die Filterspalte der
Aktivität: 16rem breit, 24 px Abstand, ab `lg` neben dem Regal, darunter im
Fluss hinter einem zugeklappten Schalter.

Die Spalte SHALL enthalten:

- ein **Volltextfeld**, das über den Beitragstext sucht,
- die Facette **Hashtags**, deren Werte aus dem Bestand der sichtbaren Videos
  abgeleitet werden SHALL,
- die **Sortierung** mit den Ordnungen, die die Feed-Schicht bereits führt —
  „Neueste" und „Beliebteste".

Die Sortierung SHALL die vorhandenen Ordnungen der Feed-Schicht benutzen und
keine eigene einführen. Die Academy ist eine gefilterte Sicht auf `posts`, und
deren Blätterung trägt seit AGE-667 in allen drei Ordnungen
`veroeffentlicht_ab` als führendes Feld, in der Ordnung „Beliebteste"
zusätzlich `like_count` im Cursor. Eine zweite, eigene Ordnung hier hiesse, den
Cursorvertrag ein zweites Mal zu bauen.

Volltextfeld und Sortierung SHALL immer stehen. Die Hashtag-Karte SHALL **nicht
rendern**, wenn kein sichtbares Video ein Hashtag trägt. Damit trägt die Spalte
auch auf dünnem Bestand, ohne eine leere Hülle zu zeigen — auf der Produktion
steht heute genau ein Video, und keines trägt ein Hashtag.

Die drei kuratierten Lektionen SHALL bleiben, wo sie sind: als redaktioneller
Block oberhalb der geteilten Videos. Sie sind kein Bestand, den man filtert.

#### Scenario: Die Spalte trägt auch ohne Hashtags

- **WHEN** die Academy geöffnet wird und kein sichtbares Video ein Hashtag
  trägt
- **THEN** erscheint keine Hashtag-Karte
- **AND** Volltextfeld und Sortierung stehen trotzdem

#### Scenario: Die Hashtag-Facette kommt aus dem Bestand

- **WHEN** sichtbare Videos die Hashtags `leadership` und `marketing` tragen
- **THEN** bietet die Facette genau diese beiden zur Auswahl

#### Scenario: Die Sortierung nutzt die vorhandenen Ordnungen

- **WHEN** „Beliebteste" gewählt und weitergeblättert wird
- **THEN** führt `like_count` die Ordnung
- **AND** der Cursor trägt `likeCount`, wie es die Feed-Schicht für diese
  Ordnung verlangt

#### Scenario: Die kuratierten Lektionen bleiben oben

- **WHEN** die Academy ab `lg` geöffnet wird
- **THEN** stehen die drei kuratierten Lektionen weiterhin oberhalb der
  geteilten Videos und nicht in der Spalte
