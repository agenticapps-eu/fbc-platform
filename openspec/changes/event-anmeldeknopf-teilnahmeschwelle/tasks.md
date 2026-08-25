# Tasks — Anmeldeknopf und Teilnahmeschwelle (AGE-594)

- [x] 1.1 Zusage (RED): unter `discover` ist der Knopf bei einem
      `members`-Event **gesperrt**.
- [x] 1.2 Zusage (RED): der Grund steht daneben, auf Deutsch, mit der nötigen
      Stufe — und der rohe Datenbanktext erscheint nicht.
- [x] 1.3 Gegenprobe: ab `discover` ist der Knopf frei.
- [x] 1.4 Gegenprobe: bei einem `public`-Event sperrt nichts.
- [x] 1.5 Gegenprobe: der **Host** darf zu seinem eigenen `members`-Event, auch
      auf `basic`. Die Ausnahme, die eine reine Stufenprüfung übersieht.
- [x] 1.6 `darfSichAnmelden` als reine Funktion; `RegistrationPanel` liest
      `levelRank` aus dem Auth-Context. Unbekannte Stufe sperrt NICHT.
- [x] 1.7 Grün laufen sehen, Gegenprobe durch Verbiegung.
- [x] 1.8 Diff-Review (gemeinsam mit dem Nachbar-Change, Befund zu
      `levelRank === null` begruendet abgelehnt).
- [ ] 1.9 `openspec validate --all`, archivieren, PR.
