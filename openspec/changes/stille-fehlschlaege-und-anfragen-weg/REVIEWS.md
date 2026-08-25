---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2 (Modell vom CLI nicht ausgewiesen), gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 6d8a139ba2c51efeefc1c2244f73c63d494123a1ce28a7a9c0ce30ed2a68f1f9
---

# Change review — stille-fehlschlaege-und-anfragen-weg (AGE-591/592/593)

Plan-Review nach Schritt 2b, **vor der ersten Zeile Code**. Beide Vendoren fremd,
`REVIEWER_TIMEOUT=900`, beide exit 0.

> **STATUS: Befunde erfasst, Auflösungen AUSSTEHEND.** Die Sitzung endete an
> dieser Stelle auf Donalds Wunsch. Nichts hiervon ist eingearbeitet — die
> Artefakte stehen unverändert so da, wie die Reviewer sie gelesen haben. Erste
> Handlung der nächsten Sitzung: auflösen, dann erst Code.

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

**Ausstehend.** Siehe Status oben.

Erste Einschätzung, damit die nächste Sitzung nicht bei null anfängt — sie ist
noch keine Entscheidung: Die drei HIGH sind sachlich richtig und alle drei
verlangen eine Änderung am Entwurf, nicht nur am Text. Besonders der dritte ist
unangenehm treffend: ein Zähler, der bei Fehler verschwindet, ist derselbe
Fehler, den dieser Change behebt. Der MEDIUM zu AGE-494 ist ebenfalls berechtigt
— mein Proposal behauptet, keine Rücknahme zu sein, und das stimmt nicht, solange
der Eintrag statisch steht.
