---
reviewers: [gemini, codex, opencode]
models: [nicht-ermittelbar, gpt-5.6-sol, hf:moonshotai/Kimi-K3]
verdicts: [APPROVE, REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 8b06cff09024a8c6a37bda78295cbd60d204e460
---

# Change review — rail-breakpoint-xl (AGE-652)

Drei Reviewer, drei Anbieter, drei verschiedene Modelle. **Keiner davon
`claude`** — der eigene Anbieter darf die eigene Änderung nicht prüfen.

Zur Modellzeile: **gemini's Modell liess sich nicht auflösen.** Headless-Läufe
hinterlassen kein Sitzungsprotokoll, und die Selbstauskunft des Modells
(`gemini-1.5-flash-latest`) widerspricht den jüngsten Sitzungsdateien auf der
Platte (`gemini-3-flash-preview`, `gemini-2.5-pro`). Hier steht darum
`nicht-ermittelbar` statt einer plausiblen Erfindung — das Feld existiert, um
zwei Arme auf demselben Modell zu entlarven, und eine geratene Kennung wäre
schlechter als eine offene Lücke. Die anderen beiden sind belegt: `codex`
meldete `model: gpt-5.6-sol`, `opencode` startete mit
`build · hf:moonshotai/Kimi-K3`.

**Zu codex im Besonderen**: die Projekt-Memory warnt, dass er Reviews an
Unter-Reviewer weiterdelegiert und fremde Modelle unter eigenem Namen
zurückliefert — womöglich `claude`, was ihn disqualifiziert hätte. Nachgesehen:
hier nicht eingetreten, er lief selbst auf `gpt-5.6-sol`.

---

## Reviewer: gemini (Modell nicht ermittelbar)

VERDICT: **APPROVE**

- **[LOW]** neuer Absatz im Delta — der Querverweis auf die andere Anforderung
  läuft über ihren lesbaren Titel, ein „weicher" Link. Wird der Titel je
  umbenannt, verrottet der Verweis und die beiden Anforderungen können erneut
  auseinanderlaufen. — Vorschlag: ein maschinenprüfbarer Verweis (Requirement-ID),
  falls OpenSpec das kann.

Ausserdem drei benannte Annahmen: (1) dass AGE-639 wirklich die massgebliche
Fassung ist; (2) dass keine **andere** Spec-Datei von der falschen `lg`-Klausel
abhängt — die Prüfung war auf eine Datei beschränkt; (3) dass die Messung auf
`/profil` für alle Flächen steht.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: **REQUEST-CHANGES**

- **[HIGH]** Delta / Szenario — „opens **any page**" verlangt einen Rail auch auf
  `/chat` und `/chat/:threadId` und widerspricht `messaging/spec.md`, das die
  stehende Fläche dort ausschliesst. Ein `MODIFIED`-Block würde den Widerspruch
  wortgleich neu ausstellen.
- **[HIGH]** `tasks.md` §4 — `pnpm release:entries` schreibt
  `src/content/release-entries.generated.ts` und widerspricht damit dem erklärten
  „nur OpenSpec, kein Quelltext".
- **[MEDIUM]** Delta — „a member who has **never touched** the right bar" passt
  nicht zu dem gerätelokalen, nicht kontogebundenen Speicher, den dieselbe
  Anforderung beschreibt. Auf einem geteilten Gerät erbt ein neues Mitglied den
  fremden Zustand.
- **[MEDIUM]** Delta / neuer Absatz — vermengt die **gespeicherte Vorliebe** mit
  ihrer **angedockten Darstellung**. Die Vorliebe besteht unterhalb von `xl`
  fort und muss beim Verbreitern wieder gelten.
- **[MEDIUM]** `tasks.md` — die vom Repo verlangten Linear-Statuswechsel fehlen.
- **[LOW]** `tasks.md` §2 — die Behauptung, **alle** `lg`-Nennungen seien
  durchgegangen, ist unvollständig: `:392` (`lg:grid-cols-3`) fehlt in der Liste.
- **[LOW]** `proposal.md` — Messungen bei 1100 und 1688 px belegen zwei
  Zustände, aber nicht, dass der Sprung **exakt** bei 1280 px liegt.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: **REQUEST-CHANGES**

> „The underlying diagnosis is real: `lg` in that scenario contradicts the
> current docking requirement, and `xl` is the correct threshold."

- **[HIGH]** `tasks.md` §4 — derselbe Befund wie codex, unabhängig gefunden: der
  Abschlussplan verletzt die eigene Umfangsgrenze; ausserdem wird die Korrektur
  so zu einem Neuigkeiten-Eintrag. Die Aufgabe einfach zu streichen macht den
  bestehenden Archiv-Test rot.
- **[MEDIUM]** Delta / neuer Absatz — „The collapsed state" greift weiter als die
  korrigierte Bedingung und zieht Persistenz, Speicher und Unabhängigkeit mit
  hinein. Ebenfalls unabhängig von codex gefunden.
- **[LOW]** `tasks.md` §§1 und 3 — die Messung ist nicht reproduzierbar: kein
  Protokoll, kein SHA, keine Viewport-Einrichtung, keine Speicher-Vorbedingung.
  **Ein 72-px-Rail bei 1688 px belegt keinen „never touched"-Zustand, solange
  nicht feststeht, dass `fbc.chatCollapsed` fehlte.**

## Auflösung

**[HIGH · codex] „any page" schliesst `/chat` ein.** *Eingearbeitet, nachdem der
Befund geprüft war.* `messaging/spec.md:259` sagt wörtlich „The standing surface
SHALL NOT render on the conversation page itself", der Code sagt
`!aufChatRoute` (`AppShell.tsx:474`), und im Browser ist der Rail auf `/chat` bei
1688 px **gar nicht im DOM**. Die Bedingung heisst jetzt „opens a page that
carries the right bar" — das bindet an die Zusage, statt die Routenliste aus
`messaging` ein zweites Mal zu führen, wo sie erneut driften könnte.

**[HIGH · codex + opencode] Der Umfang war falsch angegeben.** *Eingearbeitet.*
Beide haben recht: `release-entries.generated.ts` liegt unter `src/` und ändert
sich. Das Proposal sagt das jetzt ausdrücklich und begründet es. **Die Folge
haben aber beide überschätzt** — ein Eintrag geht nicht automatisch an die
Mitglieder, er landet in der offenen Liste unter `/admin/neuigkeiten`, und
zugestellt wird nur, was ein Admin in eine Mitteilung zieht. Für genau diesen
Fall hat AGE-636 das Kästchen „nicht relevant" gebaut. Den Erzeuger um einen
Ausschluss zu erweitern ist verworfen und im Proposal begründet.

**[MEDIUM · codex + opencode] Der neue Absatz griff zu weit.** *Eingearbeitet.*
Zwei unabhängige Leser haben dieselbe Fehllesart produziert — das ist kein
Missverständnis, sondern eine Eigenschaft des Textes. Er heisst jetzt „The
initial default and the rail it produces", und ein zweiter Absatz stellt
ausdrücklich klar, dass die gespeicherte Vorliebe jede Breite überlebt.

**[MEDIUM · codex] „never touched" vs. gerätelokaler Speicher.** *Eingearbeitet*,
obwohl es Bestandstext war: „a member with no stored right-bar preference".
Derselbe Grund wie beim ersten HIGH — ein `MODIFIED`-Block bekräftigt, was er
neu ausstellt.

**[MEDIUM · codex] Linear-Statuswechsel.** *Nicht eingearbeitet, begründet.* Die
GitHub-Automation schaltet den Vorgang bei PR-Öffnung auf *In Progress* und beim
Merge auf *Done*. Ein Schreibvorgang von Hand wäre eine zweite Quelle für
denselben Zustand. Steht so in `tasks.md`.

**[LOW · codex] `:392` fehlte in der Aufzählung.** *Eingearbeitet* — nachgesehen,
er stimmt: dort steht `lg:grid-cols-3` als Tailwind-Klasse in einem Absatz über
Spaltenraster, ohne Bezug zum Andocken. Jetzt aufgeführt, mit diesem Grund.

**[LOW · codex] Die Schwelle war nicht belegt.** *Eingearbeitet durch Messen.*
1279 px → `display: none`, Breite 0. 1280 px → `flex`, 72 px. Dazu die
Wurzelschriftgrösse (16 px) und Tailwinds `--breakpoint-xl: 80rem` aus dem
installierten Paket, damit „80rem = 1280 px" nicht auf einer Annahme ruht.

**[LOW · opencode] Die Messung belegte den Erstbesuch nicht.** *Eingearbeitet,
und der schärfste Befund der Runde.* Nachgesehen: `fbc.chatCollapsed` stand
tatsächlich auf `"1"` — gemessen war ein gespeicherter Zustand, nicht der
Vorgabefall. Schlüssel entfernt, neu geladen, erst dann die Messung. Das volle
Protokoll steht jetzt in `tasks.md` §2, samt Branch, Commit und der Notiz, dass
`resize_page` wirkungslos blieb und nur `emulate` echte Viewports liefert.

**[LOW · gemini] Weicher Verweis über den Titel.** *Nicht eingearbeitet,
begründet.* OpenSpec kennt keine Requirement-IDs; gemini hat das selbst als
Vorbehalt formuliert. Der Titel **ist** hier der Schlüssel: `openspec archive`
gleicht Anforderungen und Szenarien namentlich ab, eine Umbenennung lässt die
Bindung also nicht still verrotten, sondern **bricht das Archivieren**. Genau
das ist in der Sitzung vom 27.08. passiert. Das Risiko ist damit laut, nicht
leise — und ein lautes Risiko braucht keinen zweiten Mechanismus.

**[Annahme · gemini] Nur eine Datei geprüft.** *Nachgeholt.* Über alle Specs
gesucht: `design-system` ist die einzige Datei, die `lg`/`xl` überhaupt trägt,
und keine andere erwähnt die rechte Leiste. `feedback-qm` mit seinem `sm` ist
die Positivkontrolle, dass die Suche andere Dateien erreicht.
