---
reviewers: [gemini, opencode, codex]
models: [gemini-cli (Modell nicht in der Ausgabe genannt), "hf:moonshotai/Kimi-K3", codex-cli (Modell nicht in der Ausgabe genannt)]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: ce605f3bc9eec40a8055672d299f1956989195d268aefca291b38d48bcf8349a
---

# Change review — redesign-guest-surfaces

Drei Fremdanbieter, keiner davon Claude. Alle drei REQUEST-CHANGES.

Diese Runde hat **zwei Faktenfehler im eigenen Proposal** gefunden — beides
Behauptungen, die ich für geprüft hielt und die es nicht waren.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- **[MEDIUM]** Tasks §3 — kein Task prüft die bestehenden `LoginPage`-Tests,
  während §2.4 das für `HomePage` ausdrücklich tut.
- **[LOW]** Der Platz der Rechtslinks im zweispaltigen Layout ist unbestimmt.
- **[LOW]** Das dekorative Bild braucht `alt=""` bzw. `aria-hidden`.

Annahme: die Schienen-Struktur der eingeloggten Seiten lasse sich unverändert auf
`PublicHome` übertragen, ohne mit dessen `PageHero` zu kollidieren.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

- **[HIGH]** Proposal §1 gegen Task 3.6 gegen Spec-Szenario — **drei Artefakte
  sagen drei verschiedene Dinge** darüber, ob Marke und Claim auf dem Foto
  sitzen. Genau daran hängt die tragende Unterscheidung des ganzen
  `MODIFIED` („beside vs. over"); solange sie unscharf bleibt, ist der Einwand
  „Dekoration vor der Aufgabe" nicht ausgeräumt, sondern nur verschoben.
- **[HIGH]** Die `LoginPage`-Tests sind in keinem Task benannt, obwohl der
  Impact-Abschnitt sie nennt. Diese Datei ist die fragilere von beiden.
- **[MEDIUM]** `RegistrierungOhneSitzung` (AGE-591) und der `formError`-Pfad
  stehen in keinem Task. Der Registrierungsweg ist der, den die importierten
  Mitglieder tatsächlich treffen.
- **[MEDIUM]** Das Schicksal von „← Zurück zur Startseite" ist unbestimmt — ein
  Notausgang, den man beim Umbau lautlos verliert.
- **[MEDIUM]** Die neue Anforderung gilt für **jede** Gästefläche, geprüft
  werden aber nur vier Stellen auf einer Seite. Entweder besteht sie heute
  zufällig, oder sie wird irgendwo unbesehen verletzt — dann ist sie bei der
  Geburt falsch.
- **[MEDIUM]** Beide `ADDED` liegen in `design-system`, obwohl „keine Zahl ohne
  Quelle" Inhaltspolitik ist und die Schienen-Struktur Informationsarchitektur.
- **[LOW]** Bild-Barrierefreiheit; **[LOW]** die Schiene fügt einen **dritten**
  Beitritts-Aufruf auf denselben Bildschirm; **[LOW]** „was kostet es mich" sei
  aus `levels.ts` nicht beantwortbar.

## Reviewer: codex

VERDICT: REQUEST-CHANGES

- **[HIGH]** `design-system:279-288` — **die Breiten-Anforderung deckelt den
  Login bei 760 px und nennt „sign-in" namentlich.** Die Ausnahme im
  Bildkopf-Abschnitt zu regeln löst die Layout-Regel nicht auf.
- **[HIGH]** Dieselbe Marke/Claim-Widersprüchlichkeit wie opencode — und das
  Szenario ist noch schwächer als die Anforderung: es verbietet nur Felder,
  Beschriftungen und Knöpfe auf dem Foto, nicht Fließtext.
- **[HIGH]** **„Sechs ungenutzte Motive" ist falsch.** `formatHero.ts` vergibt
  alle sieben übrigen an Routen. Task 3.4 schließt zwei aus und lenkt die
  Umsetzung damit in die stille Wiederverwendung eines fremden Motivs, ohne
  `CREDITS.md` nachzuziehen.
- **[HIGH]** Die neue Besucher-Anforderung erfasst wörtlich auch Rechtstexte,
  Eventdaten, Preise und Zitate in fremdverfassten Beiträgen. „Agreed to it" hat
  keinen definierten oder gespeicherten Nachweis — die Erfüllung ist damit
  grundsätzlich nicht prüfbar.
- **[MEDIUM]** Unbestimmt, ob `PageHero` über beide Spalten läuft oder in die
  schmalere Hauptspalte gequetscht wird.
- **[MEDIUM]** `fbc-hero` entfernen + Panel erst ab `lg` = **auf dem Telefon
  verschwinden Logo und Claim vollständig** vom Login.
- **[MEDIUM]** „Die sechs Stufen" genügt der Zusage nicht: Felder, Reihenfolge
  (`LEVEL_ORDER`), Preisintervall und Ziel des Beitritts-Knopfes fehlen.
- **[MEDIUM]** Drei konkurrierende Einstiegs-Knöpfe — und ein „Mitglied
  werden"-Knopf öffnet die Registrierung gar nicht.
- **[MEDIUM]** Task 3.1 nennt nur Login-Bedienelemente, nicht den
  Registrierungszustand und nicht die grosse `RegistrierungOhneSitzung`-Fläche,
  die beide die Spaltenhöhe ändern.
- **[MEDIUM]** „70 Profile" ist keine Messung: keine Umgebung, kein Zeitpunkt,
  kein Aktivierungs-/Sichtbarkeitsfilter, keine 2026-Grenze.
- **[LOW]** `HomePage.test.tsx` rendert **nur** `PostPreview` — „bestehende
  Tests prüfen" ist dort gar keine Abdeckung.

## Nachgeprüft, bevor übernommen

| Befund | Belegt |
| -- | -- |
| Login ist bei 760 px gedeckelt, „sign-in" namentlich genannt | **ja**, `design-system:281-283` |
| Alle neun Motive sind vergeben | **ja** — `formatHero.ts` sieben, plus `hero-start` und `hero-see`; `CREDITS.md` führt alle neun mit Route |
| Die zwei Schienen sind **nicht** dasselbe Raster | **ja** — `1.9fr/1fr` (Dashboard) gegen `1fr/16rem` (Feed) |
| `RegistrierungOhneSitzung`, `formError`, Rückweg existieren | **ja** — `LoginPage.tsx:60`, `:280`, `:300` |
| `mode` ist lokaler Zustand ohne URL-Parameter | **ja** — `LoginPage.tsx:92`; „Mitglied werden" landet im Login-Formular |
| `LoginPage.test.tsx` prüft den `fbc-hero`-Kasten | **nein** — kein Treffer. gemini/opencode nahmen es an; der Task bleibt trotzdem, weil der Wurzel-Umbau anderes brechen kann |
| „was kostet es mich" sei unbeantwortbar | **nein, widerlegt** — `levels.ts` führt `priceYear` **und** `priceMonth` je Stufe |

## Resolution

| Befund | Entscheidung |
| -- | -- |
| **HIGH** 760-px-Deckel (codex) | **Übernommen.** Eigenes `MODIFIED` auf die Breiten-Anforderung: der Deckel gilt der **Formularspalte**, nicht der Komposition. Ohne das stünde in `openspec/specs/` eine Regel, die der Code bricht. |
| **HIGH** Marke/Claim (opencode, codex) | **Übernommen und anders gelöst als geplant.** Statt zu behaupten, es sei etwas anderes als ein Bildkopf, sagt die Anforderung jetzt: es ist **dasselbe Mittel**, nur an anderer Achse. Foto mit Verlauf, Text auf der ruhigen Fläche, **nichts** auf dem Foto. Szenario und Task sagen dasselbe wie die Anforderung. |
| **HIGH** kein freies Motiv (codex) | **Übernommen.** Donald hat am 26.08. entschieden: `hero-mitglieder.webp` wird wiederverwendet. Die Eindeutigkeitsregel bindet **aus der Navigation erreichbare** Seiten — der Login ist keine, also ist das kein Bruch. Entscheidend: `/mitglieder` liegt hinter der Anmeldung, ein Gast sieht das Motiv nirgends sonst. `CREDITS.md` wird nachgezogen. |
| **HIGH** Reichweite der Besucher-Anforderung (codex, opencode) | **Übernommen, Anforderung eingeengt.** Sie gilt jetzt nur für **von der Plattform selbst verfasste werbende Aussagen** auf Gästeflächen — nicht für Rechtstexte, nicht für Eventdaten, nicht für fremdverfasste Beiträge. Der unbelegbare Einwilligungsnachweis entfällt: verlangt wird eine **benannte Person**, kein gespeicherter Nachweis. Dazu ein Task, der die Gästerouten tatsächlich absucht. |
| **HIGH/MED** `LoginPage`-Tests (opencode, gemini) | **Übernommen**, eigener Task — obwohl der vermutete Anlass (Hero-Zusagen) sich nicht bestätigt hat. |
| **MED** `PageHero` über beide Spalten (codex) | **Übernommen und festgeschrieben**: Hero über die volle Breite, Schiene **darunter**. So machen es beide Vorbilder. |
| **MED** Marke verschwindet mobil (codex) | **Übernommen.** Unterhalb von `lg` steht eine kompakte Marke mit Claim über dem Formular. Sie ersatzlos zu verlieren wäre ein Rückschritt für genau die Geräte, auf denen die meisten Mitglieder sich anmelden. |
| **MED** Stufen-Felder und Reihenfolge (codex) | **Übernommen**, in der Anforderung benannt: `LEVEL_ORDER`, Label, Zusammenfassung, Jahres- **und** Monatspreis. |
| **MED/LOW** drei Einstiegs-Knöpfe (codex, opencode) | **Übernommen — und der eigentliche Defekt mitgenommen.** `mode` ist lokaler Zustand ohne URL-Parameter, „Mitglied werden" öffnet also das **Login**-Formular. Einen dritten solchen Knopf hinzuzufügen hiesse, eine weitere Unwahrheit auszuliefern. Der Weg in die Registrierung wird adressierbar, und die bestehenden Knöpfe zeigen darauf. |
| **MED** Registrierung, Fehlerpfade, Rückweg (opencode, codex) | **Übernommen**, alle in Task 3.1/3.2. |
| **MED** „70 Profile" (codex) | **Übernommen.** Die Zahl steht nicht mehr in der Anforderung. Im Proposal steht sie mit Umgebung und Abfrage oder gar nicht. |
| **LOW** `HomePage.test.tsx` deckt nichts ab (codex) | **Übernommen.** Es braucht einen echten Gäste-Render, nicht „bestehende Tests prüfen". |
| **LOW** Bild-Barrierefreiheit (gemini, opencode) | **Übernommen.** |
| **LOW** Platz der Rechtslinks (gemini) | **Übernommen**, in der Anforderung festgelegt. |
| **MED** Spec-Ablage (opencode) | **Nicht geändert, aber begründet.** `design-system` trägt bereits „Every main page opens empty with an invitation, not a status report" — eine Inhaltsregel, keine Gestaltungsregel. Der Präzedenzfall steht dort, und ein dritter Ort für dieselbe Frage ist der Anfang der Drift, die der Befund beklagt. |
| **LOW** „was kostet es mich" (opencode) | **Widerlegt**, siehe Tabelle oben. `levels.ts` führt beide Preise. |
