# Tasks — Gaesteflaechen gestalten, erfundene Angaben entfernen (AGE-616, AGE-541)

> Ueberarbeitet nach der Plan-Review (`REVIEWS.md`, drei Fremdanbieter, dreimal
> REQUEST-CHANGES). Die Abschnitte 3, 5.6, 6.2, 6.6 und 7 gaebe es ohne sie
> nicht, und zwei Faktenbehauptungen des ersten Entwurfs waren schlicht falsch.

## 1 · Messen, bevor etwas geaendert wird

- [x] 1.1 Login bei 1440 px: `main` ist **448 px** breit, **31 %** des Fensters,
      **992 px** daneben ungenutzt, **null** Bilder auf der Seite
- [x] 1.2 Oeffentliche Startseite bei 1440 px: `grid-template-columns: none` —
      einspaltig, Inhaltsbreite 1169 px
- [x] 1.3 Die vier erfundenen Angaben stehen ausgeloggt auf der Seite: „120+",
      „24" und zwei Zitate mit „— Ein Impact-Mitglied" / „— Ein Focus-Mitglied".
      Der Beleg ist, dass es **fest verdrahtete Zeichenketten im JSX** sind, aus
      keiner Abfrage. Eine Gegenzahl aus PROD wird **nicht** behauptet: sie
      braeuchte Umgebung, Zeitpunkt und eine Definition, wer als Mitglied zaehlt
- [x] 1.4 `Kpi` und `Testimonial` haben **ausserhalb** von `HomePage.tsx` keinen
      Aufrufer — 0 Treffer im Quelltext
- [x] 1.5 **Korrektur des Proposals:** es gibt **kein** freies Motiv.
      `formatHero.ts` vergibt alle sieben uebrigen, `hero-start` und `hero-see`
      sind belegt — 9 von 9. Donald hat am 26.08. `hero-mitglieder.webp`
      gewaehlt; `/mitglieder` liegt hinter der Anmeldung, ein Gast sieht das
      Motiv nirgends sonst
- [x] 1.6 **Korrektur des Proposals:** `design-system:281-283` deckelt „sign-in"
      namentlich bei **760 px**. Die Breiten-Anforderung muss mit geaendert
      werden, sonst bricht der Code eine Regel, die stehen bleibt

## 2 · Die erfundenen Angaben entfernen (AGE-541)

> Zuerst, nicht zuletzt: die Schiene soll nicht um Inhalte herum gebaut werden,
> die gerade verschwinden.

- [x] 2.1 **Erst einen echten Gaeste-Render bauen.** `HomePage.test.tsx` rendert
      heute nur `PostPreview` und koennte das Entfernen der Kacheln gar nicht
      bemerken — „bestehende Tests pruefen" waere hier keine Abdeckung
- [x] 2.2 Test: die Seite zeigt ausgeloggt weder „120+" noch „24" noch eines der
      beiden Zitate
- [x] 2.3 Die zwei `<Kpi>` und die zwei `<Testimonial>` samt Abschnitten
      entfernen — **ersatzlos**
- [x] 2.4 Die verwaisten Komponenten `Kpi` und `Testimonial` entfernen
- [x] 2.5 **Die uebrigen Gaesterouten absuchen**, sonst ist die neue Anforderung
      bei ihrer Geburt womoeglich schon verletzt. Was dort gefunden wird und
      nicht hierher gehoert, wird als Vorgang notiert, nicht mitgenommen

## 3 · Der Weg in die Registrierung (aus der Review)

> `mode` ist lokaler Zustand ohne URL-Parameter (`LoginPage.tsx:92`). „Mitglied
> werden" landet heute im **Login**-Formular. Einen dritten solchen Knopf in der
> Schiene zu ergaenzen hiesse, eine weitere Unwahrheit auszuliefern.

- [x] 3.1 Test: die Registrierungsadresse zeigt das Registrierungsformular
- [x] 3.2 Test: **ohne Neumontieren** — von `/login` auf die
      Registrierungsadresse navigieren zeigt die Registrierung, nicht den
      vorherigen Zustand. Ein `useState(startwert)` naehme den spaeteren Wert nie
      an, und ein Zuruecksetzen im Effect kaeme zu spaet
- [x] 3.3 Umsetzen und die bestehenden Hero-Knoepfe darauf zeigen lassen

## 4 · Login: Panel neben dem Formular ab `lg`

- [x] 4.1 Test: das Formular ist bei jeder Breite vollstaendig und bedienbar —
      **Login- und Registrierungszustand**, E-Mail, Name, Passwort, Absenden,
      Moduswechsel, „Passwort vergessen?"
- [x] 4.2 Test: `RegistrierungOhneSitzung` (`LoginPage.tsx:60`) und der
      `formError`-Pfad (`:280`) rendern im neuen Layout. Der Registrierungsweg
      ist der, den die importierten Mitglieder tatsaechlich treffen
- [x] 4.3 Test: der Rueckweg „← Zurueck zur Startseite" (`:300`) und die
      Rechtslinks aus AGE-497 stehen weiterhin auf der Seite
- [x] 4.4 **Bestehende `LoginPage`-Tests laufen lassen und lesen.** Sie treffen
      keine Zusage ueber den `fbc-hero`-Kasten — geprueft, 0 Treffer — aber der
      Umbau der Wurzel kann anderes brechen
- [x] 4.5 Umsetzen: links Panel mit `hero-mitglieder.webp`, Verlauf, Marke und
      Claim **auf der ruhigen Flaeche**; rechts das Formular. Der heutige
      `fbc-hero`-Kasten (`:186`) entfaellt
- [x] 4.6 **Nichts** sitzt auf dem Foto — kein Fliesstext, keine Beschriftung,
      kein Bedienelement
- [x] 4.7 Das Bild ist dekorativ: `alt=""` bzw. `aria-hidden`
- [x] 4.8 Unterhalb von `lg`: eine Spalte, Panel weicht — **aber Marke und Claim
      bleiben** kompakt ueber dem Formular. Sie ersatzlos zu verlieren waere ein
      Rueckschritt fuer die Geraete, auf denen die meisten sich anmelden
- [x] 4.9 Die Formularspalte bleibt bei 760 px gedeckelt; nur die Komposition
      nutzt die Breite

## 5 · Oeffentliche Startseite: rechte Schiene ab `lg`

- [x] 5.1 Test: ab `lg` steht die Schiene neben dem Leseinhalt, darunter dahinter
- [x] 5.2 Test: die Stufen kommen aus `src/config/levels.ts` in `LEVEL_ORDER`
      und tragen Label, Zusammenfassung und Preis — keine zweite, eigene Liste
- [x] 5.3 `PageHero` laeuft ueber die **volle Breite** ueber dem Raster, nicht in
      der schmaleren Hauptspalte. So machen es beide Vorbilder
- [x] 5.4 Raster nach `MemberDashboard.tsx:185`
      (`lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]`) — **nicht** nach
      `CommunityFeed.tsx:311` (`1fr/16rem`). Die beiden sind **nicht** dasselbe
      Muster, und das Dashboard ist die naehere Entsprechung
- [x] 5.5 Schiene: die sechs Stufen und **eine** Einladung, die in die
      Registrierung fuehrt
- [x] 5.6 Preise mit Intervall darstellen (Jahr **und** Monat liegen vor), nicht
      als nackte Zahl

## 6 · Sichtprobe im Browser

- [x] 6.1 Login bei 1440 px, 1024 px, 375 px und 320 px — **in beiden Modi**
- [x] 6.2 Login mit Fehlermeldung im Browser geprueft (1024 px, leeres Formular
      abgeschickt): Meldung rendert, kein Ueberlauf, Panel bleibt stehen.
      **Die `RegistrierungOhneSitzung`-Flaeche ist NICHT im Browser gesehen** —
      sie verlangt eine Registrierung, die keine Sitzung zurueckgibt, und das
      laesst sich lokal nicht ohne Weiteres herstellen. Sie ist ueber den
      Einheitentest aus 4.2 im neuen Layout belegt, nicht ueber den Augenschein
- [x] 6.3 Startseite ausgeloggt bei denselben vier Breiten
- [x] 6.4 Kein waagerechter Ueberlauf: **am Inhaltsbedarf gemessen**, nicht an
      `scrollWidth`, und `innerWidth` waechst in der Emulation mit dem Fehler mit
- [x] 6.5 Beide Themes (`hell`, `navy`)
- [x] 6.6 **Angesehen**, nicht nur gemessen — gruene Tests haben in AGE-492 ein
      visuell falsches Ergebnis durchgewunken

## 7 · Nachweise nachziehen

- [x] 7.1 `public/images/CREDITS.md`: `hero-mitglieder.webp` wird jetzt auch vom
      Login verwendet. Ein Nachweis, der eine Verwendung verschweigt, ist keiner

## 8 · Abschluss

- [x] 8.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` gruen
- [x] 8.2 Diff-Review durch einen unabhaengigen Leser
- [x] 8.3 `openspec validate --all` gruen, Change archivieren
- [x] 8.4 PR, AGE-616 und AGE-541 auf Done
