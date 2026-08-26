# Aufgaben — AGE-497 (temporaere Fassung)

> **Ueberarbeitet am 26.08. nach dem Plan-Review.** Zwei Reviewer, beide REJECT.
> Der erste Entwurf haette drei Regionen erfinden muessen, um den eigenen Test
> gruen zu bekommen; er hatte ein Szenario ohne moeglichen Rotlauf; und er schob
> zwei Links weg, mit denen die eigene Begruendung stand und fiel. Zwei Befunde
> sind am Repo widerlegt (Axiom, Verschachtelung). Siehe `REVIEWS.md`.

Quelle aller Texte: `~/Downloads/Projects/FBC/website`, geliefert 13.08.2026.
Kein Satz wurde erfunden. Wo ein Text der Plattform widerspricht, ist der
Widerspruch **benannt**, nicht geglaettet.

## 1. Inhaltsmodell und Renderer

- [x] 1.1 `src/content/legal/types.ts` — drei Blockarten, Verweise als Daten,
      `provisorisch` und Herkunft als Felder.

      **Erledigt. Drei Blockarten reichen — gemessen, nicht angenommen.** Beide
      Reviewer hielten das fuer zu wenig. Am pandoc-Export gezaehlt: 0
      verschachtelte Listen, 0 Tabellen, 0 nummerierte Listen, 0 eingerueckte
      Zeilen.
- [x] 1.2 RED zuerst: `<script>` kommt als Text an, erzeugt kein Element.

      **Erledigt und gegengeprueft.** Renderer probeweise auf
      `dangerouslySetInnerHTML` umgestellt → Test **rot**; zurueckgenommen →
      gruen. Die Zusage ist gemessen, nicht behauptet.
- [x] 1.3 `src/pages/LegalPage.tsx` — ein Renderer, ausserhalb der `AppShell`,
      Rueckweg als statischer Link auf `/`, plus Querverweise.

## 2. Die vier Dokumente einpflegen

- [x] 2.1 `impressum.ts` — 11 Abschnitte. Offener Punkt: nennt
      `www.fairbusinessclub.de`, nicht die Plattform.
- [x] 2.2 `agb.ts` — **178 Abschnitte** inkl. vier Anlagen. Im Browser
      nachgezaehlt: 178 `<h2>`, alle vier `ANLAGE`-Ueberschriften, das
      Muster-Widerrufsformular, **62 905 Zeichen** gerendert.
      Offene Punkte: ActivePoints 26-mal (im Code nur toter `src/vision/`),
      `eff.bee.zee` 0-mal.
- [x] 2.3 `datenschutz.ts` — von Hand kuratiert. **Fuenf Eingriffe**, jeder
      einzeln begruendet im Modulkopf und im Kuratierungsskript. Die Kommentare
      des Anwalts an Donald sind raus; ein Test haelt sie draussen.
- [x] 2.4 `cookies.ts` — 37 Abschnitte. Offene Punkte: Embeds laden ohne
      Einwilligung, **und** das beschriebene Einwilligungsverfahren gibt es
      nicht.
- [x] 2.5 `03 FBC Datenschutzerklärung.docx` **nicht** verwendet; Grund steht im
      Kopf von `datenschutz.ts`.
- [x] 2.6 **Vollstaendigkeitsabgleich Quelle ↔ Modul** ueber alle Woerter ab
      5 Buchstaben.

      **Erledigt — und er hat einen echten Konverterfehler gefunden, den kein
      Reviewer sah.** Fett gesetzte Zeilen ohne Folgetext wurden zu leeren
      Abschnitten und fielen heraus: alle vier `ANLAGE`-Ueberschriften und —
      am schwersten — *„Der Landesbeauftragte fuer den Datenschutz und die
      Informationsfreiheit Baden-Wuerttemberg"*, die **Beschwerdestelle nach
      Art. 77 DSGVO**. Nach der Reparatur fehlen nur noch Woerter, die in
      `titel`, `stand` oder `href` stecken.

      Laeuft **nicht** in CI: die `.docx` liegen unter `~/Downloads` und
      gehoeren nicht ins oeffentliche Repo. Handschritt bei jeder neuen Fassung.

## 3. Die gemessenen Angaben in der Datenschutzerklaerung

- [x] 3.1 Test: Supabase, Cloudflare, Sentry, Resend, Stripe **je mit Zweck**.
- [x] 3.2 Test: YouTube-/Vimeo-Einbettung genannt.
- [x] 3.3 **Region nur, wo belegt.** Belegt: Supabase (Frankfurt), Sentry (EU).
      Fuer Cloudflare, Resend und Stripe sagt die Seite ausdruecklich „noch
      nicht belegt" — sie schweigt nicht und raet nicht.
- [x] 3.4 Test: Session Replay im Fehlerfall wird **genannt**, die Maskierung
      als Schutz beschrieben — nicht als Beleg, dass nichts passiert.
- [x] 3.5 **Negativbefund als Test gegen den CODE**, nicht gegen die Seite.
      Scannt `src/`, `index.html` und `public/`.

      **Gegengeprueft:** eine eingeschleuste `fonts.googleapis.com`-Zeile machte
      den Test **rot**; nach dem Entfernen wieder gruen.

## 4. Footer

- [x] 4.1 RED zuerst: vier Rechtslinks, ausgeloggt und eingeloggt, je mit
      eigenem `href`.
- [x] 4.2 `AppFooter.tsx` mit `fbc-shell-offset`.

      **Im Browser belegt, dass die Klasse noetig ist:** bei 1440 px hat der
      Footer `padding-left: 256px` (= Sidebar-Breite), der erste Link steht bei
      288 px. Ohne die Klasse laege er bei 32 px — unter der fixierten Sidebar.
- [x] 4.3 Keine Override-Muster ueber `cn()`; nur vorhandene Tokens.

## 5. Routen und Einstiegsbildschirme

- [x] 5.1 Vier Routen ausserhalb des `AppShell`-Blocks.
- [x] 5.2 Test: alle vier rendern ausgeloggt, je mit **eigenem Titel**.
- [x] 5.3 Test: eingeloggt-**unbestaetigt** rendert die Rechtsseite, nicht den
      Aktivierungsbildschirm.
- [x] 5.4 **Links auf Login-Seite und Aktivierungsbildschirm** — aus dem
      Folge-Vorgang in diesen Change gezogen (§ 312i BGB, Art. 13 DSGVO).
- [x] 5.5 Test je Einstiegsbildschirm.

## 6. Entwurfshinweis

- [x] 6.1 RED zuerst: zwei Dokumente nennen **verschiedene** offene Punkte.
- [x] 6.2 RED zuerst: `provisorisch: false` zeigt **keinen** Hinweis.
- [x] 6.3 Sichtbar ohne Interaktion, vor dem Dokumentkoerper.

      **Im Browser korrigiert:** die Flaeche stand auf `bg-soft` — exakt der
      Seitenfarbe (beide `rgb(246, 248, 251)`), der Kasten hob sich nur durch
      seinen Rand ab. Jetzt `bg-canvas`. Kontraste gemessen: Ueberschrift
      **14,51:1**, Fliesstext **5,08:1** — beide ueber AA.

## 7. Sichtprobe im Browser

- [x] 7.1 Vier Routen bei 320 px, plus 390 px und 1440 px.

      **Ein echter Defekt gefunden, den alle 1756 Tests nicht sehen konnten:**
      bei 320 px lief die `<h1>` ueber — `/datenschutz` **13 px**, `/agb`
      **19 px**, und auf `/agb` schob die Seite seitlich (Dokumentbreite 323 px
      bei 320 px Fenster). Lange Komposita brechen nicht von selbst.
      Behoben mit `break-words hyphens-auto` (Silbentrennung greift, weil
      `<html lang="de">` steht). **Nachher: alle vier 320/320, null Ueberlauf.**
- [x] 7.2 Footer bei 320 px — am Inhaltsbedarf je Element gemessen, nicht an
      `documentElement.scrollWidth`. Vier Links, umbrechend, **kein** Ueberlauf.
- [x] 7.3 Kontrast geprueft (siehe 6.3).

      **Zum zweiten Theme:** `navy` aendert laut `src/index.css:205` nur die
      **Chrome**-Tokens, nicht die Inhaltsfarben — ein dunkles Inhaltsthema gibt
      es bewusst nicht. Gemessen: die Rechtsseite ist in beiden Varianten
      identisch, und das ist richtig so, kein Befund.

## 8. Buendelgroesse — nachtraeglich gemessen, nicht geplant

- [x] 8.1 Die Rechtstexte lagen zuerst im Hauptbuendel. Bei identischer
      Umgebung gemessen:

      | | roh | gzip |
      |---|---|---|
      | ohne | 1 077,93 kB | 311,20 kB |
      | mit, eager | 1 199,37 kB | 340,96 kB |
      | mit, nachgeladen | 1 081,87 kB | **312,30 kB** |

      **+29,8 kB gzip auf jedem Seitenaufruf** fuer vier kaum besuchte Seiten —
      nach AGE-584 (Mobilarbeit) nicht vertretbar. Metadaten (`meta.ts`) sind
      jetzt vom Volltext getrennt; die AGB liegen in einem eigenen 81-kB-Stueck.
      Rest-Zuwachs: **+1,1 kB gzip**.

      Die frueher vorhandene `index.ts` ist **geloescht**: sie sammelte alle
      vier Volltexte eager ein und waere die Falle fuer den Naechsten gewesen.
      `meta.test.ts` haelt Metadaten und Volltexte deckungsgleich.

## 9. Folge-Vorgaenge (nicht hier geloest)

- [ ] 9.1 **Die drei gemessenen Antworten an Detlev/den Anwalt schicken** und
      die finale Fassung 1.0 anfordern. Erste Handlung, nicht letzte.
- [ ] 9.2 **Video-Embeds laden ohne Einwilligung** auf der oeffentlichen
      Startseite — eigener Vorgang (Zwei-Klick oder Consent, AGE-260).
- [ ] 9.3 Verantwortlicher FBC ↔ DK Real Invest eG anwaltlich klaeren.
- [ ] 9.4 AGB nennen ActivePoints, die es nicht gibt — Detlev vorlegen. Bis zur
      Korrektur sind die AGB **nur informativ** veroeffentlicht und in keinen
      Vertragsweg eingebunden; dieser Change legt kein Zustimmungshaeckchen an.
- [ ] 9.5 Regionen fuer Cloudflare, Resend und Stripe aus Vertrag/AVV belegen.
- [ ] 9.6 Rolle je Empfaenger (Auftragsverarbeiter vs. eigener
      Verantwortlicher) rechtlich einordnen.
- [ ] 9.7 Axiom-Textreste entfernen (AGE-497 §3): 6 Treffer, alle Kommentare,
      die die Entfernung dokumentieren. **Kein Datenschutzbefund** — der Dienst
      ist seit ADR-0037 weg.

## 10. Abschluss

- [x] 10.1 `openspec validate --all` gruen.
- [x] 10.2 `vitest run` gruen — **1756 Tests, 152 Dateien**. `tsc --noEmit`
      gruen. `eslint` auf den neuen Dateien gruen. `vite build` gruen.
- [x] 10.3 `prettier --check` gruen auf allen angefassten Dateien.

      **`AppShell.tsx` und `SidebarNav.tsx` bewusst NICHT formatiert:** beide
      waren schon vor diesem Change unformatiert (AGE-606, repoweit 211
      Dateien). Sie jetzt mitzuformatieren haette eine fremde Aufraeumaktion in
      diesen Diff gebuendelt.
- [x] 10.4 Diff-Review durch einen fremden Anbieter, mit `git add -N` vorher.

      **Erledigt — 10 Befunde, REJECT.** Acht angenommen, zwei am Repo
      widerlegt. Der schwerste: `seite.lade()` hatte **kein `.catch`**, und der
      Kommentar daneben behauptete, die ErrorBoundary fange das ab. Sie faengt
      nur Renderfehler. Nach einem Deploy waere `/impressum` **dauerhaft leer**
      geblieben. Zweitschwerster: der Quelltext-Scan konnte gruen sein, ohne je
      gesucht zu haben (`catch` schluckte auch Status 2).

      Ausserdem entlarvte der daraus entstandene Ladezustand **vier eigene
      Tests**, die nur auf die Ueberschrift warteten — gruen auch dann, wenn
      der Text nie eintrifft, und flatterhaft obendrein. Siehe `REVIEWS.md`.
- [x] 10.5 Sicherheitspruefung (oeffentliches Repo): die Rechtstexte enthalten
      genau eine E-Mail-Adresse (`info@fairbusinessclub.de`) und einen Namen
      (Detlev Krause) — beides gesetzlich vorgeschriebene Impressumsangaben,
      kein Mitglieder-PII. Keine Token-, Schluessel- oder IBAN-Muster.
      „Donald" kommt ausschliesslich in Kommentaren und in den Suchmustern
      eines Tests vor, nie in gerendertem Text.
