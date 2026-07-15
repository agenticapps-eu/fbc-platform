# Spec — FBC Navigation & IA-Umbau (Sommerfest-MVP)

**Repo:** `fbc-platform` · **Quelle:** Detlev, `260715 FBC Plattform Architektur_6 Stufen.docx` (bestätigt 15.07.2026) + Dashboard-Mock
**Kontext:** Ziel Sommerfest-MVP — Mitglieder sollen in Minuten verstehen: „Der Club kennt mich, entwickelt mich, verbindet mich, eröffnet Chancen." Bewusst MVP, nicht fertige Plattform.

---

## 1. Grundprinzip
**Alle sehen dieselbe Navigation.** Funktionen werden **ausschließlich über Berechtigungen** (Level) freigeschaltet, nicht über unterschiedliche Menüs. (Rechte-Matrix siehe `2026-07-15-fbc-6level-upgrade.md` §2.)

## 2. Ziel-Navigation (verbindlich)
```
ENTDECKEN            MEIN BEREICH          SERVICE
🏠 Start             👤 Mein Profil        ⚙ Einstellungen
🧭 Compass           🎯 Meine Chancen
🎓 Academy           📚 Meine Kurse
📅 Events            📆 Meine Events
👥 Mitglieder        🤝 Meine Kontakte
⚡ Aktivität
```
Reihenfolge erzählt die Reise: Compass (entdecke mich) → Academy (entwickle mich) → Events (treffe Menschen) → Mitglieder (finde Passende) → Aktivität (hier lebt der Club).

## 3. Seiten-Umbau — Deltas zum heutigen Build
| Seite heute | Änderung |
|---|---|
| **Community** (Feed + Suche gemischt) | **wird aufgeteilt** → Mitgliedersuche nach `Mitglieder`, Feed nach `Aktivität`. Community-Seite entfällt. |
| **Aktivität** (neu) | ersetzt den Community-Feed: Beiträge, Kommentare, Likes, Fotos/Videos, Eventberichte, Erfolgsgeschichten, neue Mitglieder, Academy-News, Empfehlungen, neue Matchings. Der lebendige Mittelpunkt. |
| **Mitglieder** | nur noch Suche · Filter · Profile · Kontaktaufnahme. **Keine Beiträge mehr.** |
| **Biete & Suche** (eigene Seite) | **wird Teil von `Compass`**: Interessen, Ziele, Ich suche, Ich biete, Kompetenzen. Basis für alle Empfehlungen/Matchings. |
| **Matching** | **umbenennen → `Meine Chancen`**. Wenige, hochwertige Empfehlungen statt vieler Treffer (Qualität > Masse). |
| **Startseite** | **persönliches Dashboard** statt vollem Feed: Willkommen, Mein Fortschritt (Compass %), aktuelle Mitgliedschaft, nächstes Event, 2–3 neue Mitglieder, 2 aktuelle Beiträge, Buttons „Alle Mitglieder" / „Zur Aktivität". Ruhig & übersichtlich. |
| **Mein Profil** | **vereinfachen**: Profil, Ziele, Interessen, Kompetenzen, Profilfortschritt. Komplexe Scores/Statistiken (heutiger `potential_score`/„Impact Score") für den MVP **ausblenden**, später ergänzbar. |
| **Academy** | bewusst einfach, wenige hochwertige Inhalte, keine komplizierte Verwaltung. |
| **Meine Kurse / Meine Events / Meine Kontakte** | persönliche Bereiche. `Meine Kontakte` = Kontaktanfragen, Kontakte, Nachrichten, Empfehlungen (keine Statistiken). |
| **Einstellungen** | schlank: Konto, Mitgliedschaft, Benachrichtigungen, Sichtbarkeit. |

## 4. Events nach Stufe
Für alle sichtbar, Nutzung gestuft: **Basic** ansehen · **Exchange** teilnehmen · **Focus** weitere Formate · **Impact** volle Nutzung.

## 5. ⚠️ Konsistenz-Watch für den Agent
- Der Dashboard-Mock zeigt noch Badges **„Focus" und „Legacy"**. **`Legacy` (und `Circle`) sind gestrichen** — keine Legacy/Circle-Badges/Tiers einbauen. Gültig sind nur `basic, connect, discover, exchange, focus, impact`.
- Marke im Mock = FBC (Krone, Marineblau/Gold) → konsistent mit Design-Variante **H/I (Navy & Gold)** im Repo. Diese Variante als Default fixieren, Switcher später strippen.
- „Aktivität"/Feed nicht neu von Grund auf bauen — der Community-Feed existiert schon; er wird **verschoben/umbenannt**, nicht neu erfunden.

## 6. Reihenfolge (fügt sich in den Wochenplan)
1. Nav-Gerüst auf die 6+5+1 Einträge umstellen (gleich für alle).
2. Community → Mitglieder + Aktivität splitten; Biete&Suche in Compass ziehen; Matching → Meine Chancen umbenennen.
3. Startseite auf Dashboard umbauen; Mein Profil vereinfachen.
4. Rechte je Level anhängen (RLS aus der 6-Level-Spec).
