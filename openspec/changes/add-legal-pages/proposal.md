# Rechtsseiten als temporaere Fassung, verlinkt im Footer

## Why

Linear: **AGE-497** (C5 — Rechtsseiten, Go-Live August 2026). Die Plattform hat
heute **keine einzige Rechtsseite und keinen Footer**. Gemessen am 26.08.:
`grep -ril footer src/` trifft genau eine Datei, und das ist `CommunityFeed.tsx`
(ein Kommentar). Es gibt keine Route `/impressum`, `/datenschutz`, `/agb`.

Impressumspflicht (§ 5 DDG) und Informationspflicht (Art. 13 DSGVO) gelten ab
dem Moment, in dem echte Personendaten verarbeitet werden. PROD traegt seit dem
Import echte Mitglieder. Die Seiten fehlen also nicht „noch", sie fehlen
**bereits zu spaet**.

### Warum jetzt eine ausdruecklich temporaere Fassung

Donalds Auftrag: die Texte mit allem bauen, **was wir heute wissen**, bevor alle
Fragen geklaert sind. Das ist die richtige Reihenfolge — eine Seite, die es
nicht gibt, informiert niemanden, und die Struktur (Routen, Footer,
Erreichbarkeit ohne Konto) haengt an keiner offenen Frage.

Der Preis dieser Reihenfolge ist genau eine Gefahr: **eine unfertige Rechtsseite,
die fertig aussieht, ist schlechter als keine.** Sie erweckt den Eindruck einer
geprueften Zusage. Deshalb ist der Entwurfshinweis in diesem Change kein
Schmuck, sondern eine Anforderung mit eigenem Szenario.

### Die Texte kommen aus den Anwaltsdokumenten, nicht aus dem Kopf

Quelle ist `~/Downloads/Projects/FBC/website` (elf `.docx`, geliefert
13.08.2026). Vier davon werden hier verwendet:

| Datei | Zustand | Ergebnis hier |
|---|---|---|
| `05 FBC Impressum.docx` | fertig, 2,5k Zeichen | **vollstaendig uebernommen** |
| `01 FBC AGB.docx` | fertig, 62k Zeichen | **vollstaendig uebernommen** |
| `04 FBC Cookie Richtlinie.docx` | fertig | **vollstaendig uebernommen** |
| `FBC Datenschutz 260811.docx` | Entwurf, endet mit **drei Fragen** | uebernommen **plus** die drei am Code gemessenen Antworten |

Die generische Kanzleifassung `03 FBC Datenschutzerklärung.docx` wird
**nicht** verwendet: sie nennt nur Kategorien („Hosting-Dienstleister,
CRM-Systeme, Zahlungsdienstleister") und keinen einzigen konkreten Dienst. Der
eff.bee.zee-Entwurf ist die speziellere und damit richtige Grundlage.

### Die drei offenen Fragen des Anwalts sind am Code beantwortet

Der Entwurf endet mit: *„Wenn du mir seine Antworten gibst, mache ich daraus
anschliessend die finale Version 1.0 ohne Platzhalter."* Alle drei Antworten
sind am 26.08. **gemessen**, nicht geschaetzt:

| Frage des Anwalts | Gemessene Antwort | Beleg |
|---|---|---|
| Wo wird gehostet? | Frontend **Cloudflare Pages**; DB, Auth, Storage, Edge Functions **Supabase**, Region `aws-0-eu-central-1` (Frankfurt) | drift-gate-Log, `scripts/db-push-prod.test.ts` |
| Wer verschickt die Systemmails? | **Resend** ueber `api.resend.com`, Absender `noreply@effbeezee.com` | `supabase/functions/send-activation/index.ts` |
| Welche Fremddienste laufen im Frontend? | **Sentry** (`de.sentry.io`, 15 Dateien), **Stripe** (6 Dateien), **YouTube-/Vimeo-Embeds** (`src/lib/video-url.ts`) | `grep`, 26.08. |

**Und die Gegenprobe, die genauso zaehlt:** Google Fonts, Analytics, Captcha und
Maps ergeben **je 0 Treffer**. Die Schriften liegen selbst gehostet unter
`public/fonts/` (4 Dateien). Ein Negativbefund ist hier eine Zusage, keine
Auslassung — und er wird deshalb als **Test gegen den Code** gefuehrt, nicht als
Suchbefehl in einer Checkliste. Ein Test, der nur die Textseite auf Abwesenheit
von Begriffen prueft, bliebe gruen, wenn jemand spaeter `gtag` einbaut.

Damit ist der Abnahmepunkt „alle vier Auftragsverarbeiter genannt" aus AGE-497
**erfuellbar**, und zwar ueber die vier hinaus.

### Die Region ist nur fuer zwei Dienste belegt — und das steht so auf der Seite

Der erste Entwurf dieses Plans verlangte „Zweck **und Region**" fuer alle fuenf
Dienste. Beide Plan-Reviewer haben das zerlegt, und die Nachmessung gibt ihnen
recht:

| Dienst | Region belegt? | Beleg |
|---|---|---|
| Supabase | **ja** | `aws-0-eu-central-1` (Frankfurt), `scripts/db-push-prod.test.ts:17` |
| Sentry | **ja** | Org `factiv`, EU-Region, `docs/foundation-acceptance.md:128` |
| Cloudflare Pages | nein | globales Edge-Netz, keine Regionszusage im Repo |
| Resend | nein | nur der Endpunkt `api.resend.com` |
| Stripe | nein | kein Treffer, auch nicht in `.env.example` |

Der eigene Test haette also zum **Erfinden** von drei Regionen gezwungen — in
einem Change, dessen erster Satz „kein Text wird erfunden" lautet. Die Seite
nennt die Region deshalb nur, wo sie belegt ist, und sagt bei den anderen drei
ausdruecklich „noch nicht belegt". Schweigen waere hier die schlechtere
Loesung: es sieht aus wie eine Antwort.

### Was Sentry empfaengt — genau, nicht beschoenigend

Gemessen in `src/instrument.ts`: `replayIntegration({ maskAllText: true,
blockAllMedia: true })`, `replaysSessionSampleRate: 0`,
`replaysOnErrorSampleRate: 1.0`, **kein** `sendDefaultPii`. Zusaetzlich entfernt
`entnimmAktivierungsFragment()` das Aktivierungs-Token aus der Adresszeile
**vor** `init()`, damit es nicht im Replay landet.

Daraus folgt: keine anlasslose Aufzeichnung — **aber im Fehlerfall entsteht
sehr wohl ein Session Replay.** Das ist eine Verarbeitung und wird als solche
genannt. Die Maskierung ist ein Schutz, kein Beleg dafuer, dass nichts
passiert.

Der erste Entwurf dieses Absatzes zitierte nur `replaysSessionSampleRate: 0`
und zog daraus eine Folgerung, die beide Werte braucht.

## What Changes

- **Vier Routen** — `/impressum`, `/datenschutz`, `/agb`, `/cookies` — mit den
  Texten aus den Anwaltsdokumenten.
- **Ausserhalb der `AppShell`**, wie `/login`. Begruendung unten.
- **Ein Footer** in der `AppShell` mit den vier Links, dezent, in beiden Themes.
- **Ein Entwurfshinweis** auf jeder Seite, der benennt, **was an dieser Seite
  noch nicht final ist** — pro Seite verschieden, nicht ein Einheitssatz.
- **Ein Inhaltsmodell ohne neue Abhaengigkeit.** Kein Markdown-Renderer, kein
  `dangerouslySetInnerHTML`.

### Warum ausserhalb der `AppShell`, und warum das kein Detail ist

`App.tsx` wickelt die gesamte Shell in `<ActivationGate>`. Ein eingeloggtes,
noch **unbestaetigtes** Konto sieht dort ausschliesslich den
Aktivierungsbildschirm — „egal welche Route", so steht es im Kommentar und so
ist es gewollt.

Laegen die Rechtsseiten in der Shell, waere das Impressum fuer genau die Gruppe
unerreichbar, die es am dringendsten braucht: Menschen, die gerade ein Konto
bestaetigen und **vor** dem Passwortsetzen sehen wollen, worauf sie sich
einlassen. AGE-497 verlangt den Link auf dem Aktivierungsbildschirm aus genau
diesem Grund.

Ausserhalb der Shell erfuellen die Seiten alle drei Faelle mit einer Struktur:
ausgeloggt, eingeloggt-unbestaetigt, eingeloggt-bestaetigt.

### Warum kein Markdown-Renderer

Das Projekt hat heute **keine** Markdown-Abhaengigkeit (geprueft in
`package.json`). Einen einzufuehren hiesse: neue Lieferkette, und bei
`dangerouslySetInnerHTML` eine Injektionsflaeche fuer Text, den ein Mensch aus
einem Word-Dokument einpflegt.

Stattdessen ein Inhaltsmodell aus drei Blockarten — Absatz, Liste, Zeilenblock
(fuer Anschriften). Jede der drei hat einen echten Verwender in den vier
Dokumenten; eine vierte gibt es nicht, weil sie keinen haette. Verlinkungen sind
Daten, kein Markup.

## Impact

- **Neue Faehigkeit `legal-pages`.** Nicht `privacy`: die offene Change
  `add-dsgvo-compliance` (AGE-260) belegt `privacy` mit Consent, DSAR und
  Audit-Log — also mit **Mechanik**. Hier geht es um **veroeffentlichte
  Hinweise**. Zwei Deltas auf denselben Slot waeren beim Archivieren ein
  Konflikt.
- Betroffene Dateien: `App.tsx` (vier Routen), `AppShell.tsx` (Footer), neu
  `src/content/legal/*`, `src/pages/LegalPage.tsx`, `src/components/AppFooter.tsx`.
- Keine Migration, keine Edge Function, kein Schema, keine neue Abhaengigkeit.

## Was hier bewusst NICHT passiert

- **Kein Text wird erfunden, gekuerzt oder geglaettet.** Auch dort nicht, wo er
  der Plattform widerspricht. Drei solche Stellen sind gemessen und werden im
  Entwurfshinweis **benannt** statt stillschweigend repariert:
  1. Das Impressum nennt als Internetadresse `www.fairbusinessclub.de`, nicht
     die Plattform.
  2. Die AGB erwaehnen **ActivePoints 26-mal**. Im Code existiert das
     ausschliesslich in `src/vision/` — totem Code (8 Treffer, alle dort).
     Die AGB versprechen damit eine Funktion, die es nicht gibt.
  3. Die AGB nennen `eff.bee.zee` **0-mal**; sie sind auf „Fair Business Club"
     geschrieben.

  Was die AGB dagegen **richtig** haben, und das ist erwaehnenswert: § 3.2 nennt
  exakt die sechs Stufen `Basic · Connect · Discover · Exchange · Focus ·
  Impact` — identisch mit `src/config/levels.ts` und AGE-311. Der Text ist auf
  diesem Punkt aktueller als die Legacy-Dokumentation.

- **Der Widerspruch beim Verantwortlichen wird entschieden, nicht versteckt.**
  Impressum, AGB und Cookie-Richtlinie nennen „Fair Business Club, Inhaber
  Detlev Krause, Stockholmer Platz 1, 70173 Stuttgart". Der
  Datenschutz-Entwurf nennt „DK Real Invest eG, Rotebuehlplatz 23, 70178
  Stuttgart". **Donald hat am 26.08. auf Fair Business Club entschieden** —
  Konsistenz mit drei von vier Dokumenten. Der Entwurfshinweis der
  Datenschutzseite fuehrt die abweichende Angabe des Entwurfs auf, damit die
  Entscheidung beim Anwalt nachpruefbar ankommt und nicht als stille
  Textaenderung durchrutscht.

- **Keine Cookie-Banner-Mechanik.** Die Cookie-Richtlinie *beschreibt* den
  Einwilligungsweg; ein Consent-Dialog ist AGE-260. Dass die YouTube-/Vimeo-
  Embeds heute **ohne** Einwilligung Drittinhalte nachladen — auf der
  oeffentlichen Startseite, also fuer Ausgeloggte — ist damit **dokumentiert,
  aber nicht behoben**. Das ist der wichtigste offene Punkt dieses Changes und
  steht als Folge-Vorgang in den Aufgaben.

- **Axiom-Entfernung** aus AGE-497 §3 ist nicht Teil dieses Changes.
  `grep -rn axiom` trifft am 26.08. weiterhin **6-mal** — aber alle sechs sind
  **Kommentare, die die Entfernung dokumentieren** (ADR-0037);
  `functions/api/log.ts` schreibt nach Workers Logs. Axiom ist **kein**
  Empfaenger von Personendaten und gehoert nicht in die Datenschutzerklaerung.
  Offen ist nur die Textpflege. Ein Plan-Reviewer hat aus den 6 Treffern auf
  einen lebenden Dienst geschlossen; das ist am Code widerlegt und die
  urspruengliche Formulierung hier hat den Irrtum mitverursacht.

  Die Sentry-Konfiguration wurde *gelesen*, um die Datenschutzseite belegbar zu
  machen — geaendert wird sie nicht.

- **Nachtrag zum Zuschnitt: die zwei Links auf Login-Seite und
  Aktivierungsbildschirm sind jetzt DRIN.** Der erste Entwurf schob sie in
  einen Folge-Vorgang, weil Donalds Auftrag den Footer nennt. Beide
  Plan-Reviewer haben das unabhaengig als schwerwiegend markiert, mit
  derselben Begruendung: § 312i BGB verlangt die Verfuegbarkeit der AGB **bei
  Vertragsschluss**, Art. 13 DSGVO die Information **zum Zeitpunkt der
  Erhebung** — beides passiert auf Registrierung und Aktivierung, nicht im
  Footer einer Seite, die diese Gruppe nie sieht.

  Es sind zwei `<Link>` auf Routen, die dieser Change ohnehin anlegt. Sie
  draussen zu lassen haette die eigene Begruendung fuer die Routenlage zur
  blossen Behauptung gemacht.
