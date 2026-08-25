# Tasks — Stille Fehlschläge und der Weg zu Anfragen

RED vor GREEN. Alle drei Zustände sind heute **stumm**, also ist jede Zusage
darüber echt rot — kein Regressionsschutz, der grün startet.

## 1. Der Weg zu eingehenden Anfragen (AGE-592)

- [ ] 1.1 Zusage (RED): bei einer offenen eingehenden Anfrage gibt es einen
      Navigationseintrag zu `/kontakte`. Geprüft wird die **Navigation**, nicht
      die Route — eine erreichbare Route ohne Eintrag ist genau der Fehler.
- [ ] 1.2 Zusage (RED): der Eintrag trägt die **Anzahl** (zwei Anfragen → „2").
- [ ] 1.3 Zusage (RED): **ohne** offene Anfrage trägt er **keine** Zahl, auch
      keine Null.
- [ ] 1.4 Zusage (RED): auch in der **eingeklappten** Leiste ist die Zahl da.
- [ ] 1.5 Zusage: ausgeloggt wird die Abfrage **gar nicht** abgesetzt
      (`enabled: !!uid`) und der Eintrag erscheint nicht.
- [ ] 1.6 `SidebarNavItem.zaehler?: number`; Abzeichen nur bei `> 0`, in beiden
      Leistenformen.
- [ ] 1.7 `/kontakte` von `section: "sub"` auf `"mein-bereich"`. Kommentar an
      Ort und Stelle: warum das AGE-494 nicht widerspricht.
- [ ] 1.8 `AppShell` liest `fetchIncomingRequests` unter **demselben**
      `incomingRequestsQueryKey` wie das Widget — eine Anfrage, ein Cache.
- [ ] 1.9 Grün laufen sehen.

## 2. Registrierung ohne Sitzung (AGE-591)

- [ ] 2.1 Zusage (RED): `signUp` löst ohne Fehler und **ohne Sitzung** auf → ein
      sichtbarer Hinweis erscheint, mit Weg zur Anmeldung und zum Zurücksetzen.
- [ ] 2.2 Zusage (RED): der Text ist bei vergebener und unbekannter Adresse
      **derselbe** — die Zusage vergleicht die gerenderten Texte beider Läufe
      miteinander, nicht gegen eine feste Zeichenkette.
- [ ] 2.3 Zusage: **mit** Sitzung erscheint der Hinweis NICHT und der bisherige
      Verlauf bleibt.
- [ ] 2.4 `AuthProvider.signUp` gibt `{ error, hatSession }` zurück; `hatSession`
      aus `data.session`. Kein Sitzungsobjekt nach außen.
- [ ] 2.5 `LoginPage.onSubmit` behandelt den dritten Ausgang.
- [ ] 2.6 Grün laufen sehen.

## 3. Anfragen-Widget bei Fehler (AGE-593)

- [ ] 3.1 Zusage (RED): scheitert `fetchIncomingRequests`, erscheint ein
      sichtbarer Hinweis.
- [ ] 3.2 Zusage: die **leere** Liste rendert weiterhin **nichts** — die
      Gegenprobe, ohne die aus dem Fix ein Leerzustand bei jedem Aufruf würde.
- [ ] 3.3 `isError` aus der Leer-Bedingung lösen. Grün laufen sehen.

## 4. Sichtprobe und Abschluss

- [ ] 4.1 **Im Browser** gegen den lokalen Stack: eine echte offene Anfrage
      anlegen, den Eintrag samt Zahl sehen, sie annehmen, die Zahl verschwinden
      sehen. Danach die Sondendaten löschen.
- [ ] 4.2 Bei 375 px und in der eingeklappten Leiste ansehen — das Abzeichen
      darf das Icon nicht verdecken.
- [ ] 4.3 `pnpm test`, `pnpm lint`, `pnpm build`, Prettier auf den berührten
      Dateien. Ausgaben lesen.
- [ ] 4.4 Gegenprobe: je eine Verbiegung pro Zusage muss sie rot machen —
      Zähler auch bei 0 zeigen · `isError` zurück in die Leer-Bedingung ·
      `hatSession` immer `true`. Vorher committen.
- [ ] 4.5 Diff-Review durch zwei fremde Vendoren, eigener Abschnitt in
      `REVIEWS.md`.
- [ ] 4.6 `openspec validate --all`, archivieren, PR.
