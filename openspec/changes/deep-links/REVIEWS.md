---
reviewers: [gemini, opencode]
models: [gemini-cli (Modell nicht ausgewiesen), "hf:moonshotai/Kimi-K3"]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 72f8f65a677d60ec
---

# Change review — deep-links (AGE-643)

Zwei Reviewer, zwei Anbieter, beide **nicht** der implementierende Host.
`codex` nicht angesetzt: er delegiert bei dieser Artefaktgröße nachweislich
zurück (festgehalten aus AGE-718, 11.09.).

Die Überschriften unten tragen den Anbieternamen **blank**. Ein Zusatz in
Klammern macht den Namen für das Gate unbekannt und die Stimme zählt nicht; das
Modell steht deshalb in der Zeile darunter.

## Reviewer: gemini

Modell: gemini-CLI, Version im Lauf nicht ausgewiesen.

VERDICT: REQUEST-CHANGES

[MEDIUM] AndroidManifest — Der Entwurf ist uneins über die Zahl der
`intent-filter`: „What Changes" sagt zwei, Spec-Delta „je einen", Aufgabe 5.3
Einzahl. Ein einziger Filter mit `VIEW`, `DEFAULT`, `BROWSABLE` und `https` auf
dem Host genügt. — Fix: in allen Abschnitten auf einen Filter vereinheitlichen.

[LOW] apple-app-site-association — Die vier Zielpfade sind genannt, aber nicht
in der Syntax, die `components` verlangt; `/chat/:threadId` muss `/chat/*`
heissen. — Fix: die genauen Werte in Design oder Aufgaben ausschreiben.

[LOW] Tasks §8 — Der Rückweg in die ursprüngliche Anwendung (Brotkrume auf iOS,
Zurück-Taste auf Android) wird nirgends geprüft. — Fix: einen Abnahmeschritt
ergänzen.

Angenommen, aber nicht ausgesprochen: Portalrechte für *Associated Domains*;
Lesbarkeit von `ANDROID_KEYSTORE_BASE64`; dass die vier Pfade vollständig sind
und jeder weitere einen neuen App-Bau verlangt.

## Reviewer: opencode

Modell: `hf:moonshotai/Kimi-K3`. Der Lauf hat das Repo selbst durchsucht
(`grep`, `ls`) — daher die Fundstellen mit Zeilennummern.

VERDICT: REQUEST-CHANGES

[HIGH] Tasks §7 / Design „Zielerhaltung" — Der Mechanismus existiert nicht und
wird nie verortet. `src/components/RequireAuth.tsx` verwirft den Ort heute
vollständig. „Umsetzen" ist ein Platzhalter, keine Aufgabe. Zudem gebe es mit
`ActivationGate` eine zweite Wand. — Fix: Dateien benennen, Mechanismus wählen,
`ActivationGate` entscheiden.

[HIGH] Android-Manifest — unspezifiziert und in sich widersprüchlich. Ohne
Pfadeinschränkung beansprucht Android die **ganze Domain**, während AASA auf
vier Pfade begrenzt: ein Passwort-Link öffnete auf Android die App, auf iOS den
Browser. — Fix: die vier Pfade im Manifest spiegeln oder die Asymmetrie als
Entscheidung festhalten.

[MEDIUM] Design „Context" — Der Aktivierungs-Token steht im **Fragment**, nicht
im Query. Die Übersetzung muss das Fragment mitführen, sonst bricht der
Aktivierungsweg. — Fix: Tabelle korrigieren, Zusage ins Delta.

[MEDIUM] Tasks 8.3 — „direkt installiertes Paket" nennt die Signaturbedingung
nicht. Ein Debug-Bau scheitert an `autoVerify` mit genau dem irreführenden Bild,
vor dem der Change warnt. — Fix: Upload-Schlüssel verlangen, vorher
`apksigner verify --print-certs`.

[MEDIUM] Tasks §5/§8 — Loch im iOS-Abnahmeweg. Entitlement und Manifest sind
nativ und reisen nicht über OTA; ohne Store-Einreichung erreicht keine Fassung
mit `applinks:` ein Gerät. — Fix: den Auslieferungsweg des Abnahme-Baus als
Aufgabe benennen.

[LOW] Die Zustellung von `appUrlOpen` beim Kaltstart ist behauptet, nicht
gemessen — in einem Change, der Vite und Cloudflare peinlich genau misst.

[LOW] `/passwort-neu` wird nie besprochen, obwohl es dieselbe Gestalt hat.

[LOW] Die vier Pfade stünden an drei Stellen und liefen auseinander.

## Resolution

**Zwei am Repo nachgeprüft, bevor etwas geändert wurde** — Reviewerbefunde sind
Behauptungen, bis man sie misst:

- `RequireAuth.tsx` tut tatsächlich `<Navigate to="/login" replace />` und führt
  den Ort nicht mit. **Bestätigt.**
- Der Token steht tatsächlich im Fragment: `src/instrument.test.ts:37`,
  `App.test.tsx:232`, `ActivationRedeemPage.test.tsx`. **Bestätigt.**
- `ActivationGate` dagegen **navigiert nicht**, es tauscht den gerenderten Baum
  (`return <ActivationScreen />`). Die Adresse bleibt stehen, das Ziel geht dort
  also **nicht** verloren. **Teilweise widerlegt** — die Zusage wird trotzdem
  gepinnt, weil sie heute nur aus der Bauart folgt.

Übernommen:

| Befund | Was daraus wurde |
| --- | --- |
| opencode HIGH, Zielerhaltung | Entscheidung 11; Aufgaben 7.3 und 7.3b nennen `RequireAuth.tsx` und `LoginPage.tsx` und wählen den Navigationszustand statt eines Query-Parameters — `?modus=` liegt dort schon, und ein Ziel im Query stünde in jedem Protokoll |
| opencode HIGH + gemini MEDIUM, Manifest | Entscheidung 9; **ein** Filter mit vier `pathPrefix`, Aufgabe 5.3b prüft, dass nicht die ganze Domain beansprucht wird. Beide Reviewer trafen dieselbe Stelle, aus verschiedenen Gründen |
| opencode MEDIUM, Fragment | Entscheidung 8; Delta verlangt `pathname` + `search` + `hash`, Aufgabe 6.1b ist der rote Test dazu |
| opencode MEDIUM, Signatur | Aufgabe 8.3 verlangt den Upload-Schlüssel und `apksigner verify` davor |
| opencode MEDIUM, iOS-Abnahmeweg | Aufgabe 8.0b: Direktinstallation aus Xcode auf ein registriertes Gerät |
| opencode LOW, Kaltstart | Aufgabe 8.0 misst ihn **zuerst** |
| opencode LOW, `/passwort-neu` | Entscheidung 10 — bewusst draußen, mit Grund |
| opencode LOW, Dublette | Aufgabe 6.3b: einmal als Modul, Kommentarverweis aus AASA und Manifest |
| gemini LOW, `components`-Syntax | in Aufgabe 4.1 als Anforderung an die Datei; die genaue Schreibweise gehört an die Datei, nicht ins Design |
| gemini LOW, Rückweg zur Ursprungs-App | in 8.4 mit aufgenommen |

Nicht übernommen: nichts. Alle Befunde beider Reviewer sind eingearbeitet.

**Was die Review gekostet und gebracht hat:** zwei Läufe, und sie haben den
teuersten Pfad des Changes vor der ersten Codezeile gerettet. Ein
Aktivierungslink, der die App ohne Token öffnet, wäre am Gerät als „Deep Links
gehen nicht" aufgefallen — nach dem Bau, nach der Portal-Einrichtung, nach dem
Gerätelauf.

<!-- openspec-review-trailer v1
implementing-host: claude
digest: sha256:7fcfca2c09fce60bb2bfd798aa438fa1efe9722f4ef40be132665f2924940117
producer-version: 1.2.0
tasks-digest: sha256:8db562c275e3f47f627a692f2e299cda36d3b29561a990ad33ca48acdcfbd958
-->
