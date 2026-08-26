# Die zwei Gaesteflaechen gestalten und von erfundenen Angaben befreien

## Why

Linear: **AGE-616** und **AGE-541**. Zusammen in einem Change, weil sie
dieselbe Flaeche betreffen: es waere unsinnig, die oeffentliche Startseite
umzugestalten, waehrend ihr Inhalt gerade entfernt wird.

Donald am 26.08. bei der Sichtprobe zu AGE-611: *„das ist keine schoene Ansicht
auf Desktop, ausserdem fehlt mir hier auch was schoenes, ein Bildheader, etwas
Text, das sieht alles sproede aus im Login"* und *„ausserdem fehlt eine rechte
sidebar auf dem desktop auf der homepage, so wie wir das in aktivitaet haben"*.

Beide Seiten sind **das, was ein Gast zuerst sieht**. Fuer die importierten
Mitglieder ist der Login sogar der erste Bildschirm der Plattform ueberhaupt.

### Die gemeinsame Ursache

Die Gaesteflaechen sind bei jedem Ausbau der eingeloggten Flaechen mitgelaufen,
ohne selbst gestaltet zu werden. AGE-589 hat die rechte Schiene ins
**eingeloggte** Dashboard gebaut (`MemberDashboard.tsx:185`), AGE-528 den
Aktivitaetsfeed (`CommunityFeed.tsx:311`) — die Gaesteseite blieb beide Male
unberuehrt und ist bis heute einspaltig.

## ⚠️ Der Login-Ausschluss ist eine getroffene Entscheidung, kein Versehen

`design-system` sagt heute woertlich:

> Form and reading routes (**sign-in**, onboarding, settings, profile editor)
> SHALL NOT carry an image header: over a form it is decoration in front of the
> task.

**Der Vorgang AGE-616 hat das falsch dargestellt.** Er schrieb, jede
Inhaltsseite halte die Bildkopf-Anforderung und der Login nicht — tatsaechlich
ist der Login ausdruecklich **ausgenommen**, mit Begruendung.

Donalds Entscheidung vom 26.08. — zweispaltig, Bild links, Formular rechts —
**verletzt diese Anforderung nicht, sie umgeht ihren Grund**: ein Bild *neben*
dem Formular ist kein Bildkopf *ueber* dem Formular. Die Begruendung
(„Dekoration vor der Aufgabe") trifft nicht zu, solange das Formular auf ruhigem
Grund steht und nichts auf dem Bild sitzt.

Die Anforderung muss das aber **sagen**. Bliebe sie unveraendert, staende in
`openspec/specs/` eine Regel, die der Code nicht mehr befolgt, und der naechste
Leser haette keinen Weg zu entscheiden, welches von beiden der Fehler ist.
Deshalb ein `MODIFIED`-Delta statt eines stillen Widerspruchs.

## What Changes

### 1 · Login: zweispaltig ab `lg`, einspaltig darunter

Links eine Bildflaeche ueber die volle Hoehe mit Marke und Claim, rechts das
Formular. Unterhalb von `lg` bleibt es bei einer Spalte — auf dem Telefon ist
Platz die knappe Ressource, und das Bild ist dort das Erste, was weichen darf.

Der heutige `fbc-hero`-Kasten (`LoginPage.tsx:186`) entfaellt: er wiederholt
Logo und Claim, die dann links stehen. **Unterhalb von `lg` bleiben Marke und
Claim aber kompakt ueber dem Formular** — sie dort ersatzlos zu verlieren waere
ein Rueckschritt fuer die Geraete, auf denen die meisten sich anmelden. Die
erste Fassung dieses Absatzes hatte genau das uebersehen.

#### Zwei Korrekturen an der ersten Fassung, beide aus der Review

**„Neun Motive, sechs davon ungenutzt" war falsch.** `src/config/formatHero.ts`
vergibt alle sieben uebrigen an Routen; zusammen mit `hero-start`
(oeffentliche Startseite) und `hero-see` (Dashboard) sind **9 von 9 belegt**,
und `public/images/CREDITS.md` fuehrt jedes mit Route und Herkunft. Es gibt
**kein** freies Motiv.

Donalds Entscheidung vom 26.08.: **`hero-mitglieder.webp` wird
wiederverwendet.** Das bricht die Eindeutigkeitsregel nicht — sie bindet die
*aus der Navigation erreichbaren* Seiten, und der Login ist keine. Entscheidend
ist etwas anderes: `/mitglieder` liegt hinter der Anmeldung, ein Gast sieht das
Motiv also **nirgends sonst**. Fuer die Zielgruppe gibt es keine Wiederholung.
`CREDITS.md` wird nachgezogen; ein Nachweis, der eine Verwendung verschweigt,
ist keiner.

**Die Breiten-Anforderung deckelt den Login bei 760 px** und nennt „sign-in"
namentlich (`design-system:281-283`). Die erste Fassung hatte das uebersehen und
die Ausnahme nur im Bildkopf-Abschnitt geregelt — das loest die Layout-Regel
nicht auf. Sie wird deshalb mit geaendert: **der Deckel gilt der Formularspalte,
nicht der Komposition.** Was er schuetzt, ist die Zeilenlaenge und die
Feldbreite, nicht die Leere daneben.

Kein neues Bild, kein fremder Ursprung — `design-system` verlangt jede
Fotografie vom eigenen Server.

### 2 · Oeffentliche Startseite: rechte Schiene ab `lg`

Inhalt (Donalds Entscheidung vom 26.08.): die **sechs Mitgliedsstufen** aus
`src/config/levels.ts` und **eine** Einladung. Beides ist echt und braucht keine
Datenbankabfrage; es beantwortet die Frage, die ein Gast tatsaechlich hat: was
bekomme ich, und was kostet es mich. `levels.ts` traegt Label, Zusammenfassung,
`priceYear` und `priceMonth` je Stufe, gelesen in `LEVEL_ORDER` — die Frage nach
den Kosten ist also aus dem Code beantwortbar.

**„Nach demselben Muster wie die beiden bestehenden Schienen" war unscharf: sie
sind nicht dasselbe Muster.** Das Dashboard nutzt
`lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]`, der Feed `1fr/16rem`.
Massgeblich ist das **Dashboard** — es ist die naehere Entsprechung, eine
Startseite neben einer Startseite.

`PageHero` laeuft dabei ueber die **volle Breite** ueber dem Raster, nicht in
der schmaleren Hauptspalte. So machen es beide Vorbilder, und der lange
Untertitel samt zwei Knoepfen wuerde in einer schmaleren Spalte leiden.

### 2a · Und der Knopf muss tun, was er sagt

`mode` in `LoginPage.tsx:92` ist lokaler Zustand ohne URL-Parameter. „Mitglied
werden" auf der Startseite fuehrt deshalb heute ins **Login**-Formular, nicht in
die Registrierung.

Einen dritten solchen Knopf in die Schiene zu stellen hiesse, eine weitere
Unwahrheit auszuliefern — an genau der Stelle, an der jemand sich entschieden
hat beizutreten. Der Weg in die Registrierung wird deshalb adressierbar, und die
bestehenden Knoepfe zeigen darauf.

Das ist kein Beifang: ohne diesen Schritt waere die Schiene, die dieser Change
baut, von Anfang an irrefuehrend.

### 3 · Die vier erfundenen Angaben ersatzlos raus (AGE-541)

* `HomePage.tsx:81` — `<Kpi value="120+" label="Mitglieder" />`, waehrend die
  Datenbank rund 70 Profile haelt
* `HomePage.tsx:82` — `<Kpi value="24" label="Events 2026" />`, nicht aus
  `events` berechnet
* zwei `<Testimonial>` mit erfundenen Zitaten, zugeschrieben an „Ein
  Impact-Mitglied" und „Ein Focus-Mitglied"

**Ersatzlos**, nicht durch echte Zaehler ersetzt — Donalds Entscheidung. Ein
echter Zaehler, der „70" sagt, ist ehrlich, aber er ist eine Produktfrage und
keine Aufraeumarbeit.

Die Komponenten `Kpi` und `Testimonial` sind danach **verwaist** — beide werden
nur in `HomePage.tsx` verwendet, sonst nirgends im Quelltext. Sie entfallen
mit. Das ist kein Beifang, sondern das Aufraeumen der eigenen Waisen.

## Impact

- `src/pages/LoginPage.tsx`, `src/pages/HomePage.tsx`
- **Spec:** `MODIFIED` auf „Every content page opens with an image header"
  (Login-Ausschluss praezisieren) und auf die Anforderung, die die erfundenen
  Angaben heute deckt — falls es eine gibt; sonst `ADDED`.
- **Keine** Migration, **keine** RLS-Aenderung, **keine** neue Abfrage.
- Bestehende Tests zu `LoginPage` und `HomePage` sind zu pruefen.

## Was dieser Change NICHT tut

- **Keine echten Kennzahlen.** Ein Zaehler auf `profiles`/`events` ist eine
  eigene Entscheidung mit Detlev, kein Nebenprodukt des Aufraeumens.
- **Keine echten Testimonials einholen.** Das ist Redaktionsarbeit.
- **Kein neues Bildmaterial.** Was da ist, wird verwendet.
- **Keine Aenderung am eingeloggten Dashboard.** Es hat seine Schiene bereits.

## Die offenen Fragen sind beantwortet

**Frage 1** war, ob die Anmeldeseite eine eigene Anforderung verdient. Die
Review hat die Frage schaerfer gestellt als ich: das Problem war nicht die
Ablage, sondern dass **drei Artefakte drei verschiedene Dinge** darueber sagten,
ob Marke und Claim auf dem Foto sitzen — und genau daran haengt die tragende
Unterscheidung. Geloest nicht durch eine eigene Anforderung, sondern durch eine
ehrlichere: es ist **dasselbe Mittel** wie ein Bildkopf, nur an anderer Achse.
Foto mit Verlauf, Text auf der ruhigen Flaeche, nichts auf dem Foto.

**Frage 2** ist am Quelltext beantwortet: `member-profiles` traegt bereits „A
member's own profile shows no invented data about them" — aber ausdruecklich
fuer **das eigene Profil eines Mitglieds**. Fuer Behauptungen gegenueber Fremden
gibt es die Regel nicht. Sie gehoert also formuliert.

Die Review hat sie dann **eingeengt**, zu Recht: woertlich genommen haette sie
auch Rechtstexte, Eventdaten, Preise und Zitate in fremdverfassten Beitraegen
erfasst, und ein gespeicherter Einwilligungsnachweis fuer Testimonials existiert
nirgends — eine Anforderung, die niemand pruefen kann, ist keine. Sie gilt jetzt
fuer **das, was die Plattform ueber sich selbst behauptet**, und verlangt eine
**benannte Person** statt eines Nachweises.

## Was bleibt offen, wissentlich

- **Die uebrigen Gaesterouten sind nicht saniert, nur abgesucht.** Was die Suche
  findet und nicht auf diese zwei Seiten gehoert, wird als Vorgang notiert.
- **Die Fotografennamen fehlen weiterhin** in `CREDITS.md` — ein offener Punkt
  seit dem 04.08., den dieser Change nicht loest, aber auch nicht vergroessert.
