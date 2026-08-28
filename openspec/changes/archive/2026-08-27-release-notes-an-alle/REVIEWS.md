# Reviews — Release-Notes an alle Mitglieder (AGE-631)

## Plan-Review: NICHT ZUSTANDE GEKOMMEN (27.08.)

Der Ablauf verlangt vor dem ersten Code zwei Plan-Reviews von Fremdanbietern.
**Alle drei am 27.08. verfügbaren Arme haben versagt** — dieselbe Störung, die
schon die Diff-Review zu AGE-627 verhindert hat und dort ausführlich
dokumentiert ist (`openspec/changes/chat-rechte-sidebar/REVIEWS.md`):

| Arm | Ergebnis |
| --- | --- |
| `opencode run` | Antwortet gar nichts — Exit 0, nur die Kopfzeile `> build · hf:moonshotai/Kimi-K3` |
| `codex exec` | Lädt die gstack-Skill-Sammlung in seine Antwort statt zu prüfen |
| `cursor-agent -p` | `Authentication required. Please run 'agent login' first` |

**Das ist eine offene Flanke und wird hier nicht schöngeredet.** Der Plan ist
ungeprüft von fremder Hand.

## Was stattdessen an Prüfung dasteht

**Die Behauptungen des Proposals sind gemessen, nicht angenommen** — das ist die
Lektion aus früheren Runden, in denen Reviewer den Text prüften und nicht die
Welt:

| Behauptung | Gemessen am 27.08. |
| --- | --- |
| 50 archivierte Changes | `openspec/changes/archive/`, 50 Verzeichnisse |
| 21 ohne `# Titel`-Zeile | gezählt, Liste liegt vor |
| 19 ohne `Linear:`-Zeile | gezählt |
| Verzeichnisname immer `JJJJ-MM-TT-<slug>` | 50 von 50 parsebar |
| Glocke hat acht Typen | `HinweisGlocke.tsx:145–159` |
| Vier Opt-out-Schalter, Default AN | `20260827080000:50–54` |
| Glocke liest nur ungelesene, Deckel 50 | `hinweise.ts:31,44` |
| `notifications` ohne Absenderspalte | `20260612075901:90–97` |

**Ein Widerspruch zur bestehenden Spec wurde gesucht und gefunden**, statt
übersehen zu werden: `specs/admin` verbietet ausdrücklich Massenversand
(AGE-304). Der Change nimmt die Zusage **nicht** zurück, sondern prüft sie
klauselweise: die Klausel „die Mitgliederliste ist keine Empfängerauswahl"
bleibt unberührt und gilt weiter; die Klausel gegen Massen-Mail/CRM/Newsletter
bekommt eine benannte Ausnahme mit Begründung. Beides steht im Delta.

## Nachzuholen

- [ ] Plan-Review durch zwei Fremdanbieter, sobald wieder einer antwortet.
- [ ] Diff-Review nach der Umsetzung, dito.
