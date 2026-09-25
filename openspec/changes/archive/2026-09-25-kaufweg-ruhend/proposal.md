# Der Kaufweg wird ruhend gestellt, nicht abgebaut

Linear: **AGE-907** (Mobile Beta) · wartet darauf: **AGE-908** (Stripe live)

## Why

Die App soll als Beta in TestFlight und in einen geschlossenen Play-Test. Vorher
muss weg, was Apple nach Richtlinie **3.1.1** ablehnt: ein Weg zu einem
Bezahlvorgang außerhalb des In-App-Kaufs. `MitgliedschaftPage` ist genau das —
`startUpgrade` ruft `create-checkout-session` und schickt den Browser per
`window.location.assign` zu Stripe.

V5 will diesen Weg ohnehin nicht: Stufen setzt der Admin von Hand (AGE-707),
und AGE-908 („Stripe live") wartet auf Detlevs Freigabe. Der Kaufweg ist also
nicht bloß riskant, er ist derzeit auch funktionslos.

**Er wird deshalb ruhend gestellt und nicht abgebaut.** Seite, Preiskarten und
Edge Functions bleiben Zeile für Zeile, wie sie sind. Was verschwindet, ist
jeder Weg dorthin.

## Zwei gemessene Befunde, die den Zuschnitt bestimmen

**1. Es ist nicht ein Knopf, es sind sieben Wege.** AGE-907 nennt
`MembershipSummary.tsx:30` (`showManageCta`). Gezählt am 25.09. auf `main`
(44c4f70) mit `grep -rn '"/mitgliedschaft"' src/`:

| Einstieg | Stelle | sichtbar für |
| --- | --- | --- |
| „Mitgliedschaft verwalten" | `MembershipSummary.tsx:30` ← `ProfilAnsichtPage.tsx:122` | alle |
| Menüpunkt „Mitgliedschaft" | `AppShell.tsx:246` | `tier !== "impact"` |
| Kachel „Plan verwalten" | `MemberDashboard.tsx:180` | alle |
| „Stufe ansehen & upgraden" | `EinstellungenPage.tsx:279` | alle |
| Knopf „Upgrade" auf der Wand | `MembershipGate.tsx:52` | Stufe zu niedrig |
| „alle Ergebnisse" in der Suche | `HeaderSearch.tsx:224` | unter `discover` |
| „Mitgliedschaft ansehen" am Event | `EventDetailPage.tsx:649` | unter `discover` |

Nur `showManageCta` zu entfernen ließe sechs Wege offen. Und `/mitgliedschaft`
trägt seit AGE-494 **schon** keinen Menüeintrag (`section: "sub"`) — „ausblenden"
im Navigationssinn ist längst passiert und hat nichts geholfen.

**2. Wer die Preise sieht, ist genau das Prüferkonto.**
`MitgliedschaftPage.tsx:31` lautet `const zeigtPreise = tier !== "impact"`. Das
Prüferkonto steht nach `docs/pruefer-zugang.md` auf **`connect`**. Gemessen am
25.09., `MitgliedschaftPage` mit `tier: "connect", levelRank: 2` gerendert:

```
Preiskarten          = 6  (basic, connect, discover, exchange, focus, impact)
Upgrade-Knoepfe      = 4
Betraege             = 150 € / Jahr | 300 € / Jahr | 600 € / Jahr | 1200 € / Jahr
Jahr/Monat-Schalter  = true
„Testzahlung · Demo" = 4
```

Ein `impact`-Konto — also jedes aus WordPress übernommene Mitglied und damit
Donalds eigenes — sieht davon **nichts**. Das ist der Grund, warum die Fläche
beim Nachsehen in der App leer wirkt, obwohl sie offen ist. Wer sie geöffnet
sieht, ist der Prüfer und jedes selbstregistrierte Mitglied (`basic`).

## What Changes

- **`/mitgliedschaft` wird unerreichbar.** Der `navItem`-Block entfällt, und
  `App.tsx` leitet den Pfad auf `/` um — die Bauform von `/meine-chancen`
  (AGE-450). Lesezeichen laufen nicht ins Leere, sie landen auf der Startseite.
- **Alle sieben Einstiege entfallen**, jeder auf die Art, die zu seiner Fläche
  passt (design.md, Entscheidung 3). Drei behalten ihre Aussage und verlieren nur
  den Weg; einer wird zu einem Satz; einer fällt mit einem Zweig weg.
- **`showManageCta` entfällt ganz**, samt Knopf und den beiden Zusagen dazu. Der
  Entwurf wollte die Eigenschaft als Rückweg stehen lassen; der Wächter hat
  gezeigt, dass sie dann einen toten Link im Baum hinterlässt (design.md,
  Entscheidung 4).
- **Kein neuer Wächter.** `src/config/redirect-targets.test.ts` leistet das seit
  AGE-494 und **leitet** seine Routenliste aus `App.tsx` ab — `/mitgliedschaft`
  erscheint dort von selbst, sobald der Redirect steht. An ihm sind zwei Dinge
  geschärft worden: er sah bisher keinen `navigate(x ? … : "/route")` und hatte
  keine Positivkontrollen (design.md, Entscheidung 6).
- **Nichts an der Kaufstrecke selbst.** `MitgliedschaftPage`, `PricingCard`,
  `create-checkout-session`, `stripe-webhook`, `apply_upgrade`, die Preise in
  `levels.ts` — unverändert.

## Was dieser Change NICHT ist

- **Keine Stripe-Entscheidung.** Die ist AGE-908 und wartet auf Detlev.
- **Kein Abbau.** Nichts wird gelöscht. Der Rückweg ist ein `navItem` plus das
  Entfernen einer Redirect-Zeile, und die sieben Einstiege stehen einzeln in
  `design.md`, damit niemand sie später suchen muss.
- **Keine Änderung an den Rechten.** Die RLS, `apply_upgrade` und die Stufen
  bleiben unberührt. Wer heute `focus` hat, hat morgen `focus`.

## Zwei Punkte aus AGE-907, die ohne Spec-Delta mitlaufen

Sie stehen hier, weil sie im selben PR liegen, nicht weil dieser Change sie
verspricht. Kein bestehendes Requirement in `native-shell` oder `notifications`
sagt etwas über die Berechtigungsmenge des Manifests oder über den
Verschlüsselungsschlüssel der `Info.plist` — geprüft mit `grep -n
"Manifest\|plist\|permission\|Encryption" openspec/specs/native-shell/spec.md`.

- **`ITSAppUsesNonExemptEncryption = false`** kommt in `ios/App/App/Info.plist`.
  Die App spricht nur HTTPS. Ohne den Schlüssel fragt App Store Connect bei jedem
  Upload nach einer Exportangabe.
- **`POST_NOTIFICATIONS` ist schon da, und der Verdacht war falsch.** AGE-907
  und `docs/store-datenschutzangaben.md:62` vermuten, sie fehle. Gemessen am
  25.09. im **zusammengeführten** Manifest beider Varianten (debug und release,
  Berechtigungsmengen identisch): sie steht drin, beigetragen von
  `com.google.firebase:firebase-messaging:25.0.1`, laut
  `manifest-merger-debug-report.txt`. **Es wird deshalb nichts ergänzt** — eine
  zweite Deklaration derselben Berechtigung wäre eine zweite Wahrheit. Der
  Befund im Dokument wird korrigiert.
