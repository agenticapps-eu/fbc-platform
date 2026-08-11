---
reviewers: [gemini, opencode]
models: [gemini-3-pro-preview, "hf:moonshotai/Kimi-K3"]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: review-527
---

# Change review — signup-password-after-confirmation (AGE-527)

Gelaufen am 2026-08-11, **vor** der ersten Codezeile. Eigener Hersteller
(claude) ausgeschlossen.

## Reviewer: gemini (gemini-3-pro-preview)

VERDICT: APPROVE — keine HIGH- oder MEDIUM-Befunde.

- [LOW] `AuthProvider.tsx` — `crypto.getRandomValues` könnte fehlschlagen; ein
  Fehlerpfad wäre denkbar.

Genannte Annahmen: CSPRNG verfügbar und verlässlich; die Sitzung nach der
Registrierung lebt lange genug für den Aktivierungsbildschirm; die
Passwortregeln des Anmeldedienstes bleiben stabil.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES. Hat die Behauptungen gegen den Bestandscode geprüft
und Zeilennummern mitgeliefert.

- [HIGH] `LoginPage.tsx` — Das gemeinsame Zod-Schema verlangt `password` in
  **beiden** Modi (Z. 10–20). Wer nur das Feld entfernt, bekommt einen Knopf,
  der wortlos nichts tut: `handleSubmit` scheitert an einem Feld, das gar nicht
  gerendert wird.
- [MEDIUM] Der Impact ist unterzählt — `auth-context.ts` trägt die Signatur ein
  zweites Mal, und `LoginPage.test.tsx:55` assertiert heute hart den Aufruf
  **mit** Passwort.
- [MEDIUM] `ActivationRedeemPage.tsx` — Die Verzweigung ist zweiwertig
  (`token && status !== "activated"`, Z. 181). Der Erfolg ist ein dritter Fall;
  wer ihn nur anhängt, zeigt dem gerade aktivierten Mitglied das „Link
  anfordern"-Formular.
- [MEDIUM] Das Spec-Delta stand im falschen Zuhause: „kein Passwort erheben"
  hing an `member-profiles`/„Sign-up auto-provisions a profile", einer
  Anforderung über den `handle_new_user`-Trigger und INSERT-Grants. Außerdem
  diktierte es Client-Innenleben (CSPRNG), das ins Design gehört.
- [LOW] D3 widersprach sich selbst: „Abmeldung und Weiterleitung passieren
  danach" hieße, dass der Browser zehn Sekunden ein widerrufenes Token hält.
- [LOW] Neuladen oder Zurück-Knopf auf dem Erfolgsschirm ist unbenannt.

Unbenannte Annahmen: keine Kompositionsregeln beim Passwort; `crypto` läuft in
der Testumgebung wirklich (sonst beweist der Verschiedenheits-Test nichts); die
Registrierung fremder Adressen bleibt möglich; `LoginPage` ist der einzige
Aufrufer; der Rückweg über `/passwort-vergessen` trägt auch für ein
unbestätigtes Konto.

## Resolution

**Alle HIGH und MEDIUM eingearbeitet:**

- **HIGH** → Im Code nachgeprüft und bestätigt: `password: z.string().min(10)`
  gilt für beide Modi. Der Impact benennt die modusbewusste Schema-Änderung
  jetzt ausdrücklich, und Task 2.2 verlangt einen roten Test auf den
  **durchlaufenden** Submit statt nur auf den Aufruf. Ohne diese Schärfung wäre
  auch der grüne Lauf grau gewesen.
- **MEDIUM (Impact)** → `auth-context.ts` und die drei Testdateien stehen jetzt
  im Impact.
- **MEDIUM (Verzweigung)** → Ebenfalls im Code bestätigt (Z. 181). D3 sagt
  jetzt, dass der Erfolg ein **dritter** Fall ist, und Task 3.1 trägt die
  Negativprobe: weder Passwort- noch Anfordern-Formular.
- **MEDIUM (Spec-Zuhause)** → Angenommen. Das `member-profiles`-Delta ist
  **entfallen**; beide Anforderungen stehen in `access-control`, und die
  Kryptoaussage ist auf zwei Eigenschaften reduziert (nicht kennbar, nicht über
  Konten hinweg gleich). Wie sie erzeugt werden, steht im Design.
- **LOW (D3)** → Präzisiert: `signOut` sofort, nur die Weiterleitung wartet.
  Task 3.6 prüft genau das.
- **LOW (Neuladen)** → Als Non-Goal aufgenommen, mit Begründung.

**Aus den Annahmen geprüft statt geglaubt** (neuer Abschnitt D5 im Design):

- `password_requirements = ""`, `minimum_password_length = 10`
  (`config.toml:230,233`) → 43 Zeichen base64url genügen ohne Kompositionszwang.
- `/passwort-vergessen` liefert für ein **unbestätigtes** Konto `issued`, nicht
  `issued_reset` (`20260807200000:133-140`) — der Rückweg trägt, nur unter
  anderem Namen. Das Proposal behauptete es vorher beiläufig.
- `LoginPage` ist der einzige Aufrufer von `signUp`.
- Task 2.3 verlangt jetzt ausdrücklich **keinen Krypto-Mock**.

**Nicht übernommen:**

- geminis [LOW] zum Fehlerpfad für `crypto.getRandomValues`. Schlägt es fehl,
  wirft `signUp` und das Formular zeigt seinen Fehler — das ist bereits das
  richtige Verhalten. Ein eigener Zweig mit Wiederholung wäre
  Fehlerbehandlung für einen Fall, den die Invarianten ausschließen
  (`crypto.getRandomValues` ist in jedem Zielbrowser und in Node ≥ 19 vorhanden
  und wirft nur bei zu großem Puffer).
