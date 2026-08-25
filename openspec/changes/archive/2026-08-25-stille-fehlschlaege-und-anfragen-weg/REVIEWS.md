---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2 (Modell vom CLI nicht ausgewiesen), gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 6d8a139ba2c51efeefc1c2244f73c63d494123a1ce28a7a9c0ce30ed2a68f1f9
---

# Change review — stille-fehlschlaege-und-anfragen-weg (AGE-591/592/593)

Plan-Review nach Schritt 2b, **vor der ersten Zeile Code**. Beide Vendoren fremd,
`REVIEWER_TIMEOUT=900`, beide exit 0.

> **STATUS: aufgelöst am 2026-08-25, vor der ersten Zeile Code.** Alle drei HIGH
> und alle sieben MEDIUM sind eingearbeitet; die Auflösungen stehen unten, Befund
> für Befund. Der `reviewed_artifacts_sha` im Kopf zeigt weiter auf den Stand, den
> die Reviewer gelesen haben — die Artefakte sind seither absichtlich geändert.

## Reviewer: codex (gpt-5.6-sol) — REQUEST-CHANGES

- **[HIGH] Das Delta widerspricht sich selbst.** Eine unbekannte Adresse erzeugt
  eine Sitzung und verlässt die Seite; eine bekannte bekommt den Hinweis. Damit
  können **niemals beide denselben gerenderten Text zeigen** — mein Szenario
  „Der Hinweis verrät nicht, ob die Adresse vergeben ist" ist so nicht
  erfüllbar, und die Oberfläche bleibt ein Existenz-Orakel. Entweder nur
  fordern, dass die **Meldung selbst** keine Existenzaussage macht, oder beide
  Ausgänge von außen ununterscheidbar bauen.
- **[HIGH] Die Nebenwirkungen hängen am falschen Zweig.** `logEvent("signup")`
  und das sitzungsgebundene `resendActivationLink()` laufen heute, sobald
  `error` null ist — also **auch bei einer Wiederholung**. Das erzeugt falsche
  Zahlen und genau die `42501`-Anfrage, die in den PROD-Logs steht. Alle
  Erfolgs-Nebenwirkungen gehören hinter `data.session`.
- **[HIGH] Der Zähler wird selbst ein stilles Loch.** Scheitert seine Abfrage,
  erscheint kein Abzeichen — ununterscheidbar von „keine Anfragen". Der Change
  reißt damit ein viertes Loch in genau der Fläche, auf die er sich verlässt.
- **[MEDIUM] Der Fluchtweg passt nicht zur betroffenen Gruppe.** Importierte,
  nicht aktivierte Mitglieder brauchen `/aktivierung` bzw. „Zugangslink
  anfordern" — nicht „Passwort zurücksetzen", dessen Oberfläche etwas anderes
  verspricht. Das sind 70 von 73 Konten.
- **[MEDIUM] „Ein Schlüssel heißt eine Anfrage" stimmt nicht.** Mit den
  Vorgaben von React Query v5 sind Daten sofort veraltet; Mounten, Fokus und
  Reconnect holen neu. Und `fetchIncomingRequests` setzt bei vorhandenen Zeilen
  **zwei** Supabase-Anfragen ab. Frische und Nachladeverhalten gehören
  ausgesprochen und gezählt, nicht behauptet.
- **[MEDIUM] Fehler beim Nachladen ≠ Fehler beim ersten Laden.** Ein einfacher
  `isError`-Zweig verstecKte vorhandene, beantwortbare Anfragen aus dem Cache,
  während das Abzeichen ihre Zahl weiter zeigt.
- **[MEDIUM] Der Menüeintrag IST eine Rücknahme von AGE-494.** `/kontakte`
  statisch nach `mein-bereich` zu ziehen zeigt ihn **jedem** eingeloggten
  Mitglied, auch ohne offene Anfrage. Mein Proposal behauptet das Gegenteil.
  Entweder ausdrücklich zurücknehmen oder den Eintrag bedingt rendern.
- **[MEDIUM] Eine nackte „2" neben „Meine Kontakte" bedeutet nicht „zwei
  Entscheidungen offen"** — sie kann genauso „zwei Kontakte" heißen. Der Test
  auf die Ziffer belegt weder Verständlichkeit noch Zugänglichkeit.
- **[MEDIUM] Die bestehende Anforderung gehört MODIFIZIERT, nicht ergänzt.**
  „Nach einer erfolgreichen Selbstregistrierung" bleibt sonst mehrdeutig
  zwischen HTTP-Erfolg und tatsächlich angelegtem Konto mit Sitzung.
- **[LOW] Die Impact-Liste ist unvollständig:** `auth-context.ts`, die
  Test-Fixtures und die bestehenden `signUp`-Attrappen müssen mit, sobald
  `hatSession` Pflicht wird.

## Reviewer: gemini — REQUEST-CHANGES

- **[MEDIUM]** Kein `staleTime` festgelegt — der Zähler im AppShell lädt mit den
  Vorgaben häufiger nach als nötig.
- **[MEDIUM]** Aufgabe 4.1 verlässt sich auf Sondendaten, die von Hand wieder
  gelöscht werden. Ein vergessener Aufräumschritt verseucht die lokale Umgebung.
  Skripte statt Handarbeit.
- **[LOW]** Das Abzeichen braucht eine zugängliche Benennung, nicht nur eine
  sichtbare Zahl.
- **[LOW]** Die Zusammenfassung im Proposal liest sich, als würde der **Eintrag**
  bedingt gerendert; gemeint war das **Abzeichen**.

## Resolution

Aufgelöst 2026-08-25. **Drei der Befunde haben den Entwurf geändert, nicht nur den
Text** — und einer hat einen echten Fehler im bestehenden Code freigelegt, der
nicht einmal Teil des Changes war.

### Übernommen — codex

**[HIGH] Das Delta widerspricht sich selbst.** Berechtigt und in der schärferen
Lesart übernommen. Das Szenario „Der Hinweis verrät nicht, ob die Adresse
vergeben ist" war **unerfüllbar**: Eine unbekannte Adresse erzeugt eine Sitzung
und löst die Seite ab, sie kann denselben Hinweis gar nicht zeigen. Von den zwei
angebotenen Auswegen ist der zweite (beide Ausgänge ununterscheidbar bauen) ein
Umbau des Registrierungsverlaufs samt der Entscheidung aus AGE-445 — außerhalb
dieses Vorgangs. Gewählt ist der erste: Die Anforderung verlangt jetzt, dass die
**Meldung selbst keinen Grund nennt**, und benennt die verbleibende
Unterscheidbarkeit ausdrücklich als **Nicht-Zusage** statt sie als Szenario zu
behaupten. Neu ist auch der Satz, dass die Oberfläche den Grund gar nicht erfragen
darf.

**[HIGH] Die Nebenwirkungen hängen am falschen Zweig.** Am Code bestätigt:
`AuthProvider.tsx` hat `if (!error) { logEvent("signup"); … resendActivationLink() }`.
Beides zieht hinter `data.session`. Das ist **ein Fehler im ausgelieferten Code**,
den der ursprüngliche Change nicht adressiert hätte — er steht jetzt als eigener
Punkt im Proposal, als MODIFIED-Anforderung in `access-control` und als Aufgaben
2.1–2.3.

Der Nachschlag beim Nachprüfen: Der bestehende Test in `AuthProvider.test.tsx`
**schreibt die Lücke fest**. Seine Attrappen liefern `{ data: { user: { id } },
error: null }` — nie eine Sitzung — und behaupten damit, der Versand gehöre genau
in den Fall, in dem er verboten ist. Der Kommentar darüber sagt derweil „die
Sitzung besteht, bevor der Versand beginnt". Aufgabe 2.1 dreht ihn um.

**[HIGH] Der Zähler wird selbst ein stilles Loch.** Übernommen, und der Befund
wird durch die Entscheidung zum bedingten Eintrag (siehe unten) noch schärfer:
Dann fehlte bei einem gescheiterten Abruf nicht nur die Zahl, sondern der **ganze
Weg**. Neue Anforderung in `contact-requests`: Bei Fehler erscheint der Eintrag
**ohne** Zahl, kenntlich als „unbekannt", mit eigenem zugänglichem Namen. Fail
loud, und in die sichere Richtung.

**[MEDIUM] Der Fluchtweg passt nicht zur betroffenen Gruppe.** Übernommen. Der
Hinweis führt auf `/aktivierung` — die Seite zeigt ohne Token das Formular
„Bestätigungslink anfordern", also genau das, was 70 von 73 Konten brauchen.
„Passwort zurücksetzen" ist als erster Weg raus; die Anmeldung steht daneben.

**[MEDIUM] „Ein Schlüssel heißt eine Anfrage" stimmt nicht.** Übernommen, in
beiden Teilen. `ANFRAGEN_STALE_TIME_MS = 30_000` wird ausgesprochen und von
beiden Flächen geteilt; Proposal und Design sagen jetzt, dass
`fetchIncomingRequests` bei vorhandenen Zeilen **zwei** Supabase-Anfragen absetzt
und der geteilte Cache daraus eine **Ladung** macht, nicht eine Anfrage.

**[MEDIUM] Fehler beim Nachladen ≠ Fehler beim ersten Laden.** Übernommen. Die
Bedingung heißt `isError && !data`; über vorliegenden Anfragen bleibt die Liste
stehen und bekommt eine Zeile zum veralteten Stand. Als eigenes Szenario in der
Spec (3.2).

**[MEDIUM] Der Menüeintrag IST eine Rücknahme von AGE-494.** Berechtigt — das
Proposal behauptete das Gegenteil und lag falsch. **Donald hat am 25.08.
entschieden: der Eintrag wird bedingt gerendert**, nicht der Change zur Rücknahme
erklärt. `/kontakte` bleibt `section: "sub"`; die Sidebar bekommt für den offenen
Vorgang einen eigenen Eintrag, der mit ihm kommt und geht.

**[MEDIUM] Eine nackte „2" bedeutet nicht „zwei Entscheidungen offen".**
Übernommen, und es hat das Label geändert: Der Eintrag heißt **„Meine Anfragen"**,
nicht „Meine Kontakte" — unter der Bedingung „es liegt eine Anfrage an" wäre der
alte Name für seinen Anlass falsch. Dazu ein zugänglicher Name, der sagt, was
gezählt wurde („Meine Anfragen, 2 offen").

**[MEDIUM] Die bestehende Anforderung gehört MODIFIZIERT.** Übernommen. Das
access-control-Delta ist von `ADDED` auf `MODIFIED` + `ADDED` umgestellt; der neue
Wortlaut bindet „erfolgreich" an die **Sitzung** statt an den ausbleibenden
Fehler. Genau diese Zweideutigkeit trägt den Fehler aus dem zweiten HIGH.

**[LOW] Die Impact-Liste ist unvollständig.** Übernommen: `auth-context.ts`,
`src/test/auth-fixtures.tsx`, die `signUp`-Attrappen in `LoginPage.test.tsx` und
`AuthProvider.test.tsx` sowie `SidebarNav.tsx` und `lib/contact-requests.ts`
stehen jetzt drin.

### Übernommen — gemini

**[MEDIUM] Kein `staleTime` festgelegt.** Übernommen, siehe oben — derselbe
Befund wie codex' fünfter, aus der anderen Richtung.

**[MEDIUM] Aufgabe 4.1 verlässt sich auf Handarbeit.** Übernommen. Die Sonde ist
jetzt ein Skript nach dem Muster der `scripts/probe-*.ts`, das im `finally`
aufräumt.

**[LOW] Das Abzeichen braucht eine zugängliche Benennung.** Übernommen, und beim
Umsetzen kam eine Falle dazu, die keiner der beiden Reviewer sehen konnte: Die
eingeklappte Leiste setzt `aria-label` am Link, und ein `aria-label` **ersetzt**
den Inhalt — ein Abzeichen darin wäre für Screenreader unsichtbar gewesen. Der
Name wird deshalb zusammengesetzt; Aufgabe 1.4 hält es fest.

**[LOW] Das Proposal liest sich, als würde der Eintrag bedingt gerendert.**
Erledigt sich durch die Entscheidung oben: Jetzt **wird** der Eintrag bedingt
gerendert, und Proposal wie Design sagen das gleichlautend.

### Beim Bauen dazugekommen — eine Messung, die die Prämisse verschoben hat

Keiner der beiden Reviewer konnte das sehen, und der Plan hat es geglaubt statt
geprüft: **Der stumme 200er ohne Sitzung hängt an einer Einstellung des
Anmeldedienstes.** Er tritt nur auf, solange die eingebaute E-Mail-Bestätigung
EINGESCHALTET ist — so stand PROD vom 16. bis zum 25.08., daher die Beobachtung.
Seit `mailer_autoconfirm` wieder `true` ist, antwortet GoTrue mit HTTP 422
`user_already_exists`. Am 2026-08-25 gegen den lokalen Stack gemessen, der
dieselbe Einstellung trägt.

Der heute live sichtbare Fehler ist damit ein anderer: Das Formular zeigte den
rohen Satz „User already registered" — englisch, führt nirgendwohin, und er
spricht die Existenz des Kontos aus. Das ist ausgerechnet die Aussage, gegen die
der erste HIGH-Befund die Zusage geschärft hat.

Beide Wege enden jetzt im selben neutralen Hinweis; der Zweig „ohne Sitzung"
bleibt, weil das Umlegen jener Einstellung ihn sofort wieder aktiv macht. Das ist
eine **Erweiterung** des Issues gegenüber dem gegengelesenen Plan und steht
deshalb hier, nicht stillschweigend im Diff.

### Nicht übernommen

Nichts abgelehnt. Der einzige Befund, dessen radikalere Variante nicht umgesetzt
wird, ist der erste HIGH (beide Registrierungsausgänge ununterscheidbar bauen) —
begründet oben, und in der Spec als ausdrückliche Nicht-Zusage vermerkt statt
verschwiegen.


---

# Diff-Review (Schritt 4) — 2026-08-25

Nach der Umsetzung, auf `git diff main...HEAD` über `src/` und `scripts/`
(1847 Zeilen). Beide Vendoren fremd, `timeout 1500`, beide exit 0.

**Ein Hinweis zur Belastbarkeit, weil er zum Ergebnis gehört:** Der erste
codex-Lauf lieferte gar keine Befunde — er las stattdessen Skill-Dokumente aus
seiner eigenen Umgebung. Erst ein Auftrag, der ausdrücklich untersagt, andere
Dateien zu lesen, brachte eine Prüfung des Diffs zustande. Ein Reviewer-Lauf,
der „nichts gefunden" meldet, ist ohne diesen Nachweis wertlos.

## Reviewer: codex (gpt-5.6-sol) — 4 × MEDIUM

- **[MEDIUM] Der Hinweis bleibt beim Wechsel in den Login-Modus stehen.**
  `onZumLogin` rief nur `setMode("login")`, nicht `setOhneSitzung(false)`.
  → **ÜBERNOMMEN, echter Fehler.** Und ein lehrreicher: Der Moduswechsel-Knopf
  UNTEN räumte den Hinweis korrekt, der Knopf IM Hinweis nicht — zwei Wege zum
  selben Zustand, einer davon vergessen. Die Zusage prüfte nur, dass das
  Passwortfeld erscheint; sie ist um die Abwesenheit des Hinweises erweitert und
  war damit erst rot, dann grün.

- **[MEDIUM] `levelRank === null` gibt die Anmeldung frei.**
  → **BEWUSST SO, nicht übernommen.** Das ist keine Lücke, sondern die
  ausdrückliche Zusage der Anforderung („SHALL NOT sperren, solange die Stufe
  unbekannt ist"). Die Hürde ist `register_for_event`, nicht diese Zeile; ein
  Ladezustand, der ein berechtigtes Mitglied aussperrt, wäre der teurere Fehler.
  Richtig ist der Kern des Befunds: In diesem Zustand spiegelt der Knopf die
  Schwelle nicht — deshalb steht die Grenze als Nicht-Zusage in der Spec und
  nicht bloß im Code.

- **[MEDIUM] `finally` läuft bei Strg-C nicht.**
  → **ÜBERNOMMEN, und der Kommentar war schlicht falsch.** Er behauptete, ein
  Abbruch dürfe die Zeilen nicht stehen lassen; ohne eigenen Signal-Handler
  beendet Node sofort. Jetzt merkt ein `SIGINT`/`SIGTERM`-Handler den Abbruch
  und löst die Warteschleife regulär auf — `process.exit()` im Handler wäre
  derselbe Fehler eine Ebene höher gewesen. **Gemessen:** SIGINT an den Prozess,
  danach `req=0 notif=0`, und das Protokoll zeigt den Aufräumlauf.

- **[MEDIUM] Das Aufräumen greift zu weit.**
  → **ÜBERNOMMEN.** Der erste Entwurf löschte jede Benachrichtigung der
  Beteiligten seit `beginn` und jeden Thread zwischen ihnen — auch was parallel
  echt entsteht, während der Kommentar „damit nichts Fremdes fällt" behauptete.
  Jetzt zusätzlich auf die beiden Typen eingeschränkt, die dieser Trigger
  überhaupt erzeugt, und beim Thread darauf, dass der EMPFÄNGER eine der beiden
  Seiten ist.

## Reviewer: gemini — keine Befunde

> „Ich finde keine ernsten Fehler. Die Änderungen sind durchdacht, die
> Begründungen in den Kommentaren schlüssig, und die Tests decken die kritischen
> Randfälle ab."

**Das ist als Freigabe wenig wert und wird hier nicht als solche gezählt.** Ein
Satz auf 1847 Diff-Zeilen belegt keine Prüfung, und codex hat im selben Diff
vier Befunde gefunden, drei davon berechtigt. Notiert als das, was es ist: ein
Lauf ohne Widerspruch, keine zweite Bestätigung.

## Resolution des Diff-Reviews

Drei von vier Befunden eingearbeitet, der vierte begründet abgelehnt und die
Begründung in die Spec gehoben. `pnpm test` 1632 grün, `tsc --noEmit` sauber,
`eslint` ohne Fehler (vier vorbestehende Warnungen, keine aus diesem Diff).
