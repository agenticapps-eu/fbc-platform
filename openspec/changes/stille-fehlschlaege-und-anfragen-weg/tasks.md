# Tasks — Stille Fehlschläge und der Weg zu Anfragen

RED vor GREEN. Alle Zustände unten sind heute **stumm**, also ist jede Zusage
darüber echt rot — kein Regressionsschutz, der grün startet. Eine Ausnahme ist
Aufgabe 2.1: dort steht ein bestehender Test, der die Lücke **festschreibt** und
umgedreht werden muss.

## 1. Der Weg zu eingehenden Anfragen (AGE-592)

- [ ] 1.1 Zusage (RED): bei einer offenen eingehenden Anfrage gibt es einen
      Navigationseintrag „Meine Anfragen" nach `/kontakte`. Geprüft wird die
      **Navigation**, nicht die Route — eine erreichbare Route ohne Eintrag ist
      genau der Fehler.
- [ ] 1.2 Zusage (RED): der Eintrag trägt die **Anzahl** (zwei Anfragen → „2"),
      und sein zugänglicher Name sagt, dass es **offene Anfragen** sind — nicht
      nur die Ziffer (Befund: eine nackte „2" ist keine Aussage darüber, was
      gezählt wurde).
- [ ] 1.3 Zusage (RED): **ohne** offene Anfrage erscheint der Eintrag **gar
      nicht** — keine Zahl, keine Null, kein leerer Menüpunkt. Das hält AGE-494.
- [ ] 1.4 Zusage (RED): auch in der **eingeklappten** Leiste ist die Zahl da,
      und der zugängliche Name trägt sie mit. (Achtung: `aria-label` am Link
      **ersetzt** den Inhalt — ein Abzeichen darin wird sonst nicht vorgelesen.)
- [ ] 1.5 Zusage: ausgeloggt wird die Abfrage **gar nicht** abgesetzt
      (`enabled: !!uid`) und der Eintrag erscheint nicht.
- [ ] 1.6 Zusage (RED): **scheitert der Abruf**, erscheint der Eintrag
      **trotzdem** — ohne Zahl, mit einem zugänglichen Namen, der sagt, dass die
      Anfragen nicht geladen werden konnten. Das ist der HIGH-Befund: sonst ist
      „Abruf kaputt" von „nichts da" nicht zu unterscheiden.
- [ ] 1.7 `SidebarNavItem.abzeichen?: { text, label }`; gerendert in beiden
      Leistenformen, zugänglicher Name zusammengesetzt.
- [ ] 1.8 `AppShell`/`SidebarContent` liest `fetchIncomingRequests` unter
      **demselben** `incomingRequestsQueryKey` wie das Widget und hängt den
      Eintrag an das Ergebnis. `/kontakte` bleibt `section: "sub"`.
- [ ] 1.9 `ANFRAGEN_STALE_TIME_MS` in `lib/contact-requests.ts`, von **beiden**
      Flächen benutzt. Kommentar: warum ausgesprochen und nicht Vorgabe.
- [ ] 1.10 Grün laufen sehen.

## 2. Registrierung ohne Sitzung (AGE-591)

- [ ] 2.1 **Bestehenden Test umdrehen (RED):** `AuthProvider.test.tsx` liefert in
      seinen Attrappen `{ data: { user: { id } }, error: null }` — also **nie**
      eine Sitzung — und prüft damit den Versand ausgerechnet im Fall, in dem er
      nicht laufen darf. Die Attrappen des Erfolgsfalls bekommen eine Sitzung.
- [ ] 2.2 Zusage (RED): kommt `signUp` ohne Fehler und **ohne Sitzung** zurück,
      wird **kein** `resend-activation` aufgerufen und **kein** `signup`-Ereignis
      gezählt. (HIGH — das ist die `42501`-Zeile aus den PROD-Logs.)
- [ ] 2.3 `AuthProvider.signUp` gibt `{ error, hatSession }` zurück; `hatSession`
      aus `data.session`. Kein Sitzungsobjekt nach außen. Nebenwirkungen hinter
      `data.session`. Signatur in `auth-context.ts` nachziehen.
- [ ] 2.4 `src/test/auth-fixtures.tsx` und die `signUp`-Attrappen in
      `LoginPage.test.tsx` führen `hatSession` mit. Vorgabe `true`, damit
      bestehende Tests weiter den Erfolgsfall prüfen und nicht versehentlich in
      den neuen Zweig fallen.
- [ ] 2.5 Zusage (RED): `signUp` löst ohne Fehler und ohne Sitzung auf → ein
      sichtbarer Hinweis erscheint, mit Weg zu **`/aktivierung`** (Zugangslink
      anfordern) und zur Anmeldung. **Nicht** „Passwort zurücksetzen" — die
      Betroffenen haben keines.
- [ ] 2.6 Zusage (RED): der Text des Hinweises **nennt keinen Grund** — er sagt
      nicht, ob die Adresse vergeben ist. Geprüft wird der gerenderte Text.
- [ ] 2.7 Zusage: **mit** Sitzung erscheint der Hinweis NICHT und der bisherige
      Verlauf bleibt.
- [ ] 2.8 Zusage: der Hinweis verschwindet beim Moduswechsel und beim nächsten
      Absenden — ein stehengebliebener Hinweis über einem neuen Versuch ist
      derselbe Fehlermodus.
- [ ] 2.9 `LoginPage.onSubmit` behandelt den dritten Ausgang. Grün laufen sehen.

## 3. Anfragen-Widget bei Fehler (AGE-593)

- [ ] 3.1 Zusage (RED): scheitert `fetchIncomingRequests` **ohne** vorliegende
      Daten, erscheint ein sichtbarer Hinweis.
- [ ] 3.2 Zusage (RED): scheitert ein **Nachladen**, während Anfragen vorliegen,
      bleiben sie sichtbar und beantwortbar. (Befund: der naive `isError`-Zweig
      hätte sie hinter einer Fehlermeldung versteckt, während das Abzeichen ihre
      Zahl weiterzeigt.)
- [ ] 3.3 Zusage: die **leere** Liste rendert weiterhin **nichts** — die
      Gegenprobe, ohne die aus dem Fix ein Leerzustand bei jedem Aufruf würde.
- [ ] 3.4 `isError && !data` statt `isError` in der Leer-Bedingung. Grün laufen
      sehen.

## 4. Sichtprobe und Abschluss

- [ ] 4.1 **Skript statt Handarbeit** (Befund gemini): `scripts/probe-age592-
      anfragenweg.ts` legt die Sondenanfragen im lokalen Stack an und räumt sie
      im `finally` wieder ab — ein vergessener Aufräumschritt verseucht sonst die
      lokale Umgebung.
- [ ] 4.2 **Im Browser** gegen den lokalen Stack: den Eintrag samt Zahl sehen,
      die Anfrage annehmen, Eintrag und Zahl verschwinden sehen.
- [ ] 4.3 Den **Fehlerfall im Browser** erzwingen (Abfrage scheitern lassen) und
      sehen, dass der Eintrag steht und das Widget redet. Ohne diese Probe ist
      der HIGH-Befund nur auf dem Papier behoben.
- [ ] 4.4 Bei 375 px und in der eingeklappten Leiste ansehen — das Abzeichen darf
      das Icon nicht verdecken. Höhe **und** Position messen, nicht schätzen.
- [ ] 4.5 `pnpm test`, `pnpm lint`, `pnpm build`, Prettier auf den berührten
      Dateien. Ausgaben lesen.
- [ ] 4.6 Gegenprobe: je eine Verbiegung pro Zusage muss sie rot machen —
      Eintrag auch bei 0 zeigen · Eintrag bei Fehler weglassen · `isError`
      zurück in die Leer-Bedingung · `hatSession` immer `true` · Nebenwirkungen
      zurück an `!error`. Vorher committen.
- [ ] 4.7 Diff-Review durch zwei fremde Vendoren, eigener Abschnitt in
      `REVIEWS.md`.
- [ ] 4.8 `openspec validate --all`, archivieren, PR.
