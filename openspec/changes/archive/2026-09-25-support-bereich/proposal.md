## Why

Linear: AGE-904

`www.effbeezee.com` geht offline (AGE-906, von diesem Change blockiert). Die
Tutorials stehen heute **nur** dort — mit dem Abschalten verlöre die Plattform
ihre einzige Erklärfläche, und zwar genau für die Mitglieder, die gerade
ankommen. V5 (Bauplan §4) sagt, wohin sie gehören: „Tutorial/Hilfe gehört nach
Login in einen nachgeordneten Supportbereich."

Der Feedback-Knopf sitzt seit AGE-566 schon an dieser Stelle — unten in der
Seitenleiste, über dem Einklapp-Schalter. Er wird damit vom Einzelstück zum
ersten von zwei Einträgen eines Abschnitts, der einen Namen bekommt: **Support**.

## What Changes

- **Ein Abschnitt „Support" am Fuss der Seitenleiste** mit genau zwei Einträgen:
  **Tutorials** (neue Route) und **Feedback** (bestehendes Verhalten, unverändert).
  Er steht an der Stelle des heutigen Feedback-Knopfs, über dem Einklapp-Schalter.
  Beide Einträge sind in der eingeklappten Leiste und in der mobilen Schublade
  erreichbar. **Sonst ändert sich an der Navigation nichts** — die sieben
  Menüeinträge aus AGE-494 bleiben, wie sie sind.
- **Eine neue Route `/hilfe/tutorials`** als `section: "sub"` (geroutet, kein
  Menüeintrag — wie `/neues` und `/chat`). Kein `minTier`: was die Anwendung
  kann, ist keine Frage der Mitgliedsstufe.
- **Eine Tutorial-Seite als EINE Seite** mit Sprungmarken über die sieben
  Etappen, darunter Etappe für Etappe die Kapitel mit Bild und vollem Text
  (Entscheidung Donald, 25.09.). Sie liest `src/content/release-tutorial.ts`
  und `release-geschichten.ts` — **dieselbe Quelle wie der Blog, keine Kopie**.
- **Die 23 Kapitelbilder ziehen ins Bündel der Anwendung um**, als WebP:
  `blog/bilder/*.png` → `public/tutorial/*.webp`. Gemessen mit `cwebp -q 82`:
  5.177.430 B → 868.296 B bei gleichen Abmessungen. Der Blog-Bau liest sie
  danach von dort und liefert sie unter **derselben** Adresse aus, die in den
  Daten steht (`/tutorial/`) — `bild.src` ist eine Zeichenkette für zwei
  Flächen. Die Motive der Kopfbereiche bleiben unter `/bilder/`. Der Blog bleibt
  bis AGE-906 vollständig arbeitsfähig.
- **Kein Deep Link.** `/hilfe/tutorials` kommt NICHT in `src/lib/deep-links.ts`;
  von aussen angeklickt öffnet die Adresse den Browser, nicht die App. Das ist
  die Entscheidung und kein Versehen — die Menge der Deep Links zu erweitern
  kostet drei Dateien, einen Deploy und eine Gegenprobe am Gerät.

## Capabilities

### New Capabilities

- `support-tutorials`: Der Support-Abschnitt am Fuss der Seitenleiste und die
  Tutorial-Fläche **in** der Anwendung — welche Einträge er führt, wo sie
  erreichbar sind, was die Tutorial-Seite zeigt und woher ihre Bilder kommen.

### Modified Capabilities

- `feedback-qm`: Die Zusage „Der Feedback-Knopf schwebt nur dort, wo er nichts
  verdeckt" beschreibt einen **schwebenden** Knopf, den es seit AGE-566 nicht
  mehr gibt — er steht in der Seitenleiste. Die Drift ist älter als dieser
  Change; sie wird hier korrigiert, weil die neue Zusage über den
  Support-Abschnitt ihr sonst offen widerspräche. Die Sache, die die alte Zusage
  schützt (der Knopf verdeckt keine Bedienelemente), bleibt erhalten — sie gilt
  jetzt für einen Knopf, der gar nicht mehr über dem Inhalt liegen kann.

## Impact

**Navigation und Fläche**

- `src/components/AppShell.tsx` — Desktop-Fuss (heute Z. 899–906) und Schublade
  (Z. 1211–1214). `onOffenChange={setFeedbackInSchublade}` bleibt am
  Feedback-Eintrag (AGE-688: zwei `aria-modal` gleichzeitig); „Tutorials" geht
  in der Schublade über den bestehenden `onNavigate`-Weg, der sie sauber schliesst.
- `src/config/nav.ts` — ein navItem am ENDE der Liste, hinter `/neues`.
- `src/config/nav.test.ts` — `ALLE_ROUTEN` wächst von 14 auf 15 Zeilen.
- `src/pages/HilfeTutorialsPage.tsx` — neu, `lazy()` wie alle Seiten seit AGE-642.

**Inhalt und Bilder**

- `src/content/release-geschichten.ts` — 23 Bildpfade auf `/tutorial/<name>.webp`.
- `src/content/release-geschichten.test.ts` — Pfadmuster und Fundort der Dateien.
- `src/types/release.ts` — der Kommentar an `ReleaseGeschichte.bild` sagt heute,
  `src` zeige in den Ausgabeordner des Blogs und NICHT ins Bündel der Anwendung.
  Das dreht sich um.
- `public/tutorial/*.webp` — neu (23 Dateien, 884 KB); `blog/bilder/*.png` entfällt.
- `scripts/build-blog.ts` — `BILDER_QUELLE` und das Pfadmuster; der Blog liefert
  weiter unter `/bilder/` aus. `blog-artefakt-waechter.ts` bleibt unberührt: er
  prüft Ursprünge, keine Verzeichnisse.

**Nicht angefasst**

- Die sieben Menüeinträge, `src/App.tsx`, `src/lib/deep-links.ts`,
  `FeedbackButton.tsx` (das Formular selbst), `release_notes` und der Versand.
- Kein Verweis auf Mitgliedschaft oder Upgrade im Support-Abschnitt — AGE-907
  macht `/mitgliedschaft` gerade unerreichbar (Apple 3.1.1).

**Fremde Sitzungen**

- AGE-907 (`kaufweg-ruhend`) fasst `AppShell.tsx` Z. 239–253 (Profilmenü) und
  `nav.ts` Z. 163–170 (`/mitgliedschaft`) an — abgestimmt am 25.09., keine
  Überschneidung.
