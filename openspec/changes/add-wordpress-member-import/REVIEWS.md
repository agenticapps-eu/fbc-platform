---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-5.2-codex]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 7f55efc5265204fdd6160e23a2191980bfe639748f95fbc570665ec713ef7578
---

# Change review — add-wordpress-member-import

Beide Prüfer verlangen Änderungen. Vier der schwersten Behauptungen habe ich
gegen das Repository nachgemessen, bevor ich sie übernommen habe — alle vier
stimmen, und eine davon kippt eine Design-Entscheidung.

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

- [HIGH] proposal — Die WordPress-Passwort-Hashes (`user_pass`, Spalte 3) werden
  nirgends ausdrücklich verworfen. Aufgabe 6.2 impliziert es, aber die wichtigste
  Sicherheitsentscheidung des Vorgangs darf nicht implizit sein. — Als Entscheidung
  ausschreiben.
- [MEDIUM] design / Wächter — Ein Host-Vergleich allein ist zu schwach; ein
  schreibender Lauf gegen PROD braucht eine zweite, ausdrückliche Bestätigung.
- [MEDIUM] Bildstrecke — Netzwerkarbeit gegen einen fremden Server ist mit der
  Datenstrecke gekoppelt; ein Ausfall der alten Seite hinterlässt einen
  Halb-Zustand. — Eigener, für sich wiederholbarer Abschnitt.
- [LOW] Protokollierung — Ohne Regel landen Namen und Adressen über `stdout` in
  Shell-History und CI-Logs. — PII ausschließlich in den ignorierten Bericht.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

11 HIGH, 7 MEDIUM, 1 LOW. Vollständig in `/tmp/review-codex.txt`; hier die
Befunde, die etwas ändern.

- [HIGH] design / Wächter — **Der Host unterscheidet die Projekte nicht.**
  Nachgemessen: `demo_seed.lib.ts:10` verwendet
  `aws-1-eu-central-1.pooler.supabase.com` — regionsweit, für jedes Projekt
  gleich. Die Projektkennung steckt im **Benutzernamen** (`postgres.<ref>`,
  Zeile 56). Mein Wächter wäre gegen das falsche Projekt grün gewesen.
- [HIGH] spec / Trockenlauf vs. tasks 1.3 — Direkter Widerspruch: die Spec
  verlangt, dass ein Aufruf **ohne Argumente** vollständig durchläuft, Aufgabe 1.3
  verlangt Abbruch ohne Quellpfad. Beides zugleich ist nicht baubar.
- [HIGH] Zielabdeckung — **`profile_contacts` fehlt als Schreibziel.**
  Nachgemessen: eigene Tabelle mit `email`, `phone`, `website`
  (`20260611115655_community_foundation.sql:36`). Telefon und Kontaktadresse
  liegen dort, nicht in `profiles`. Weder Abbildung noch Vorher-/Nachher-Messung
  erfassten sie — Aufgabe 4.3 wäre grün geblieben, während der Trockenlauf
  Kontaktzeilen schreibt.
- [HIGH] Anmeldekonten — Der Mechanismus ist unbestimmt. Direkter SQL-Schreibzugriff
  auf `auth.users` und die GoTrue-Admin-Schnittstelle haben unterschiedliche
  Identity- und Transaktionseigenschaften; „kein Passwort" ist ein Zustand, der
  festgelegt und belegt werden muss.
- [HIGH] Wiederholbarkeit — „aktualisiert" definiert nicht, **welche Felder**
  überschrieben werden. Ein Lauf nach dem Go-Live könnte vom Mitglied gepflegte
  Daten, die Anmeldeadresse oder den Aktivierungszustand zurücksetzen.
- [HIGH] Dublettenabbruch — Der geforderte globale Abbruch **ohne jeden
  Schreibvorgang** ist mit Transaktionen je Datensatz nicht garantiert: eine spät
  erkannte Dublette fände frühere Datensätze bereits geschrieben.
- [HIGH] Kollision mit Bestandskonten — Konten, die schon auf der Plattform
  existieren und **keine** `legacy_source_id` tragen, sind nicht behandelt. Die
  CSV-interne Dublettenprüfung greift dort nicht.
- [HIGH] Freigaben — Design sagt „ohne die drei Lieferungen darf der echte Lauf
  nicht laufen", Spec und Aufgaben erlauben jeden Lauf ohne sie.
- [HIGH] Abbildungsmatrix — Die 26 Felder stehen im Linear-Issue, nicht im Change.
- [MEDIUM] `upsert: false` — Nachgemessen: der `avatars`-Bucket ist **`public`**
  (`20260613081627_profile_editor_storage.sql:17`). Meine Begründung („private
  Buckets scheitern an der SELECT-Policy") trägt hier nicht, und beim zweiten Lauf
  kollidiert das vorhandene Objekt.
- [MEDIUM] Abhängigkeiten — Nachgemessen: **kein `sharp`, kein CSV-Parser** in
  `package.json`; `supabase/seed/tsconfig.json` hat eine feste `include`-Liste mit
  drei Dateien, neue Importdateien liefen ohne Typprüfung.
- [MEDIUM] design / `member_since` — **Sachlich falsch von mir formuliert:** ich
  schrieb, die Rohangabe bleibe „über `legacy_tier` nachvollziehbar". `legacy_tier`
  trägt die alte Mitgliedsstufe, nicht das Beitrittsdatum.
- [MEDIUM] Bild-Vorabsicherung — Ein früher Trockenlauf persistiert keine Bilder;
  die behauptete Gegenmaßnahme gegen „alte Seite fällt ab" wirkt nicht.
- [MEDIUM] Berichtsrechte — Ein ignorierter Bericht liegt weiter im Arbeitsbaum;
  `git status` belegt weder Abwesenheit noch Dateirechte.
- [MEDIUM] Berichts-Vollständigkeit — „jeder Lauf klassifiziert alle N Datensätze"
  verträgt sich nicht mit einem Vorab-Abbruch (Kopfzeile, Dublette).
- [LOW] Normalisierung von E-Mail und `legacy_source_id` ist unbestimmt.

## Nicht gezählt

Keiner. Beide Prüfer lieferten mit Exit 0 (`REVIEWER_TIMEOUT=1500`; die
Standard-300 s hätten `codex` nicht gereicht). Hook- und Banner-Zeilen der
Vendor-CLIs wurden beim Protokollieren entfernt, nicht die Befunde.

## Resolution

**Übernommen, mit Änderung an Design und Spec** — alle HIGH-Befunde von `codex`
außer einem, plus alle vier von `gemini`. Im Einzelnen:

1. **Wächter** — Der Vergleich läuft künftig gegen die **Projektkennung aus dem
   Benutzernamen** gegen eine feste Ziel-Allowlist, nicht gegen den Host.
   Schreibmodus zusätzlich mit ausdrücklicher Zielnennung. Das war ein echter
   Fehler meines Designs.
2. **Widerspruch Trockenlauf/Pflichtpfad** — Die Spec sagt jetzt „mit Quelldatei,
   aber ohne Schreibschalter".
3. **`profile_contacts`** — als Schreibziel in Abbildung, Transaktion und
   Vorher-/Nachher-Messung aufgenommen.
4. **Passwort-Hashes** — als ausdrückliche Entscheidung: werden weder gelesen noch
   geschrieben noch protokolliert.
5. **Anmeldekonten** — Mechanismus festgelegt (Admin-Schnittstelle, danach eine
   Transaktion für Profil/Kontakte/Kennung), samt der Folge, dass die Wiedererkennung
   **zwei** Schlüssel braucht: `legacy_source_id` und die Adresse.
6. **Merge-Regeln** — je Zielspalte festgelegt; siehe die offene Frage unten.
7. **Vorabprüfung** — die ganze Datei wird vor dem ersten Schreibvorgang validiert
   (Kopfzeile, Dubletten, Kollision mit Bestandskonten). Erst danach schreibt der Lauf.
8. **Bildstrecke** — eigener, für sich wiederholbarer Abschnitt mit Zwischenablage
   außerhalb des Repositoriums; entkoppelt von der Datenstrecke.
9. **PII** — `stdout` führt nur Zeilennummer und `legacy_source_id`; alles Weitere
   in den Bericht, mit Rechten `0600`, neben der Quelle statt im Arbeitsbaum.
10. **Abhängigkeiten** — `sharp` und ein RFC-4180-fähiger CSV-Parser werden benannt,
    `supabase/seed/tsconfig.json` erweitert.
11. **Falsche Aussage zu `legacy_tier`** — gestrichen; die Rohangabe des
    Beitrittsdatums wird stattdessen im Bericht geführt.
12. **Abbildungsmatrix** — alle 26 Felder wandern als Tabelle ins Design.

**Nicht übernommen, mit Begründung**

- [HIGH, codex] *„Die Access-Control-Spec erwartet, dass das Anlegen den
  Aktivierungsversand anstößt; ohne ihn bleiben die Mitglieder ausgesperrt."* —
  **Widersprochen.** Der Ablauf ist bewusst umgekehrt und in AGE-534 §0
  festgelegt: die Rundmail nennt keinen Link, das Mitglied gibt seine Adresse auf
  der Seite ein und löst den Versand selbst aus (`issue_activation_token`). Ein
  Versand aus dem Import heraus wäre schädlich — er verschickte 70 Links, bevor
  Detlevs Rundmail draußen ist, und entwertete sie beim nächsten Lauf wieder
  (`access-control`: „ein neuer Versand entwertet das ausstehende Token").
  Der berechtigte Kern des Befunds — dass dies nirgends *stand* — ist übernommen:
  das Design sagt jetzt ausdrücklich, dass der Import **nicht** versendet.

- [MEDIUM, codex] *Mailversand erst nach finaler Freigabe, Rollback-Ledger für
  Storage* — Sinnvoll, aber außerhalb dieses Changes: der Import versendet nicht
  (siehe oben), und der Go-Live-Ablauf mit Backup und Stichproben ist in AGE-534 §5
  beschrieben, nicht hier. Als Anmerkung im Design vermerkt.

**Zurückgenommen nach Donalds Entscheidung (14.08.)**

- [HIGH, codex] *„Schreibmodus ohne vollständige, validierte Lieferungen hart
  blockieren."* — Zuerst übernommen (Punkt 8 oben in der ersten Fassung), dann
  von Donald gekippt: die Liste kommt, und die erste Zielumgebung ist DEV. Ein
  dort zu viel importiertes Ex-Mitglied lässt sich folgenlos entfernen; ein
  Riegel hielte die Arbeit an einer Lieferung auf, die unterwegs ist.
  Der Befund bleibt richtig **für einen Lauf gegen PROD** — die Antwort darauf
  ist der Go-Live-Ablauf mit Trockenlauf und Durchsprache (AGE-534 §5), nicht ein
  Riegel im Script. Spec, Design und Aufgabe 4.3 entsprechend zurückgebaut.

**Beantwortet** — die Merge-Regel für einen Lauf **nach** dem Go-Live: ein
zweiter Lauf füllt **nur leere Felder**; Verwaltungsfelder immer,
Aktivierungszeitpunkt und Anmeldeadresse nie (Donald, 14.08.). Steht als eigene
Anforderung in der Delta.
