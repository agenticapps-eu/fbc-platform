# Lastenheft eff.bee.zee / Fair Business Club

**Nachträglich erstellt am 31.08.2026 · Fassung 1.0**
Auftraggeber: Detlev Krause (Fair Business Club) · Umsetzung: Donald Vlahović (Factiv / AgenticApps)

---

## Über dieses Dokument

### Warum es nachträglich entsteht

Die Plattform wurde nicht gegen ein Lastenheft gebaut. Sie entstand aus
Gesprächen, Konzeptpapieren und wöchentlichen Entscheidungen — und wechselte
dabei zweimal die Grundlage. Das war für die Geschwindigkeit richtig und für
die Nachvollziehbarkeit teuer: Wer heute fragt, warum eine Funktion so ist,
wie sie ist, findet die Antwort verstreut über Linear-Issues, Chatverläufe
und ein Repository.

Dieses Dokument holt das nach. Es beschreibt **den Stand vom 31.08.2026** und
**wie er zustande kam**. Es ist damit zweierlei: eine Bestandsaufnahme und ein
Entscheidungsgedächtnis.

### Für wen es geschrieben ist

Teil A bis F sind fachlich und ohne Technikkenntnisse lesbar — sie richten
sich an Detlev Krause und alle, die über die Plattform mitentscheiden.
Die Anhänge sind technisch und richten sich an Entwickler, an Nachfolger und
an externe Partner.

### Was es nicht ist

Kein Vertrag. Kein Pflichtenheft. Keine Roadmap. Es beschreibt, was ist und
was war — nicht, was als Nächstes kommt. Neue Anforderungen gehören nicht in
dieses Dokument, sondern in den in [Teil G](#teil-g--wie-neue-anforderungen-hereinkommen)
beschriebenen Weg.

### Wie Status gelesen wird

Jede Anforderung in Teil D trägt eine Kennzeichnung:

| Kennzeichen | Bedeutung |
|---|---|
| **Umgesetzt** | Live in der Plattform, durch Tests oder Abnahme belegt |
| **Umgesetzt, ruhend** | Gebaut und funktionsfähig, aber für Mitglieder bewusst nicht erreichbar |
| **Teilweise** | Grundfunktion steht, benannte Teile fehlen |
| **Konzipiert** | Im Konzept beschrieben, nicht gebaut |
| **Verworfen** | Geprüft und bewusst abgelehnt — mit Begründung in Teil E |

### Quellenlage und ihre Grenzen

Alle Aussagen sind belegt. Die Belege sind:

- **Linear** (Team AgenticApps, Präfix `AGE-`) — Issues und Projekte, die
  Entscheidungen und ihre Begründungen tragen
- **Das Repository** `agenticapps-eu/fbc-platform` — `openspec/specs/`
  (23 Capability-Spezifikationen), `supabase/migrations/` (111 Migrationen),
  `docs/decisions/` (5 Architekturentscheidungen)
- **Die Konzeptunterlagen** in Dropbox `FBC Konzept 260520` und im
  Projektordner `Fair Business Club`

Drei Einschränkungen, die beim Lesen mitzudenken sind:

1. **Die Konzeptunterlagen sind überwiegend Chat-Mitschriften**, kein
   Spezifikationswerk. Sie enthalten Vorschlag, Verwerfung und Gegenvorschlag
   nebeneinander. Das zentrale Dokument sagt das selbst: „Das Dokument ist
   bewusst kein klassisches Lastenheft"
   (`260714 Plattform-Product-Bible v4.0.docx`).
2. **Stichtag der Konzeptauswertung ist der 31.07.2026.** Spätere
   Konzeptpapiere (u. a. die REAL-TRUST-Ausarbeitungen vom 09.08.) sind auf
   Wunsch des Auftraggebers hier **nicht** berücksichtigt.
3. **Ein erheblicher Teil der jüngeren Arbeit liegt in Linear ohne
   Projektzuordnung** (ab 23.08.2026). Wer nur die Projekte liest, sieht den
   Stand nicht vollständig.

---

# Teil A — Ausgangslage und Ziel

## A.1 Woher das Projekt kommt

Der Fair Business Club ist eine bestehende Unternehmer-Gemeinschaft mit rund
70 Mitgliedern, gewachsen seit Juli 2018, mit Schwerpunkt Stuttgart. Ihr
digitales Zuhause bestand aus zwei Teilen: einer WordPress-Website
(`fairbusinessworld.de`) mit den Mitgliederdaten und einem Odoo-Portal
(`fairbusinessclub.odoo.com`), in dem viel installiert und wenig genutzt war
— am 02.06.2026 nachgesehen: 103 Kontakte, 5 Abonnements, davon vier echte
Zahler (`FBC_Analyse_Briefing.md`).

Detlev Krauses Anstoß, aus seiner Mail vom 30.05.2026: eine „Plattform, die
LinkedIn und Facebook vereint" — etwas Eigenes statt eines Baukastens, frei
nach seinen Vorstellungen gestaltbar.

## A.2 Das Geschäftsziel

Die Plattform verkauft keine Software. Sie verkauft **Chancen**. Mitglieder
zahlen zwischen 0 und 1.200 € im Jahr — nicht für Funktionen, sondern für
Begegnungen, die zu Geschäft führen. Das ist im Konzept ausdrücklich als
Leitprinzip formuliert:

> „EFF.BEE.ZEE verkauft keine Mitgliedschaften. EFF.BEE.ZEE schafft Chancen."
> — `260718 Plattform-Product-Bible v4.0-Boost-Connect.docx`

Daraus folgen drei Ziele in dieser Reihenfolge:

1. **Ein Vertrauensraum.** Mitglieder sollen einander finden können, ohne
   dass ihre Kontaktdaten frei im Netz stehen. Wer wen erreicht, entscheidet
   der Erreichte.
2. **Vermittelte Geschäfte.** Das Matching — Suche trifft Biete — ist im
   Konzept durchgehend als „Herzstück des FBC" bezeichnet.
3. **Wachstum über die Community hinaus.** Ab Juli 2026 kam ein zweites Ziel
   dazu: die Plattform soll nicht nur den Club tragen, sondern offen sein.
   Zielgröße im Konzept: „10 Millionen Menschen" — erklärtermaßen eine
   Wachstumsambition, keine Planzahl.

## A.3 Die drei Epochen des Konzepts

Das Konzept hat zwischen Mai und Juli 2026 **zweimal die Grundlage
gewechselt**. Wer die Unterlagen liest, muss wissen, aus welcher Epoche ein
Dokument stammt — sie sind in Preisen, Stufennamen, Markenlogik und Farbwelt
unvereinbar.

| Epoche | Zeitraum | Produktidee | Stufen | Farbwelt |
|---|---|---|---|---|
| **I — FBC-Plattform** | 20.05.–~30.06.2026 | Eigene Plattform für den Fair Business Club | 7 Stufen, 0–4.800 € | Smaragd & Gold |
| **II — eff.bee.zee-Wende** | 05.07.–19.07.2026 | Offene Chancen-Plattform, FBC als eine Community darauf | 6 Level, 0–1.200 € | Dunkelblau, Gold als Akzent |
| **III — MVP-Zuschnitt** | 15.07.–29.07.2026 | Radikal reduziertes MVP | 6 Level (BOOST…IMPACT) | Blau |

**Verbindlich ist Epoche III.** Detlevs Entscheidung vom 29.07.2026 formuliert
sie als Satz:

> „Keine kleine Mitglieder-Plattform, sondern eff.bee.zee als offene
> Plattform, FBC ist die Premium-Community darin."

Am 04.08. wurde daraus auch die Markenlogik: **eff.bee.zee ist die Marke, der
Fair Business Club die Premium-Community (Stufe `impact`) darin.** Die zuvor
erwogene Formel „powered by eff.bee.zee unter Fair Business Club" wurde
ausdrücklich als „genau verkehrt herum" verworfen (AGE-444).

## A.4 Was heute läuft

Stand 31.08.2026:

- Die Plattform ist seit dem **17.08.2026 intern live** — für die
  bestehenden FBC-Mitglieder, ohne öffentliche Registrierungskampagne und
  ohne aktive Zahlungen.
- **70 Mitglieder wurden aus WordPress übernommen.** Am 25.08. gemessene
  Verteilung in der Produktivdatenbank: 72 auf `impact`, 1 auf `discover`,
  1 auf `basic` (AGE-598).
- Eine **mobile App für iOS und Android** ist in Arbeit (Entscheidung
  27.08.2026: Capacitor, beide Plattformen gleichzeitig). Push-Serverseite
  steht, die Hülle ist offen.
- Der **öffentliche Start** — offene Registrierung, sichtbare Preisstufen,
  aktive Zahlungen — steht noch aus.

---

# Teil B — Zielgruppen und Rollen

## B.1 Wer die Plattform nutzt

Das Konzept unterscheidet drei Gruppen, die die Plattform bewusst
unterschiedlich anspricht:

**Privatpersonen.** Verbraucher, Familien, Berufseinsteiger, Fachkräfte,
Arbeitssuchende, Senioren, Studenten. Ihr Nutzen: gefunden werden,
Kontakte, Chancen, Vorteile.

**Unternehmen und Unternehmer.** Gründer, Investoren, Händler,
Dienstleister, Experten. Ihr Nutzen: Sichtbarkeit, Reputation, neue
Kundenkontakte, Zugang zu Kapital und Partnern.

**Organisationen.** Vereine, Schulen, Hochschulen, Kommunen. Ihr Nutzen:
Mitglieder aktivieren, Reichweite, Feedback zu Veranstaltungen.

Heute erreicht die Plattform faktisch nur die zweite Gruppe — die
übernommenen FBC-Mitglieder. Die Ansprache der ersten und dritten Gruppe
gehört zum konzipierten, nicht gebauten Teil (siehe D.10).

## B.2 Rollen im System

| Rolle | Was sie darf | Wie sie vergeben wird |
|---|---|---|
| **Gast** (nicht angemeldet) | Startseite, Rechtsseiten, Mitglieder-Schaufenster ohne Namen | — |
| **Mitglied** | Alles nach Stufe (siehe Teil C) | Registrierung oder Import, danach Aktivierung per E-Mail |
| **Matching-Manager** | Die Routing-Warteschlange für großvolumige Anfragen einsehen und bearbeiten | Nur serverseitig, über die Tabelle `staff_roles` |
| **Admin** | Mitgliederverwaltung, Stufen setzen, Feedback einsehen, Release-Notes veröffentlichen | Nur serverseitig, über `staff_roles` |

**Bewusst nicht vorgesehen:** Ein Admin kann **kein fremdes Passwort setzen**.
Er kann nur einen Zugangslink auslösen. Begründung vom 17.08.2026: Ein Admin
könnte sich sonst als Mitglied anmelden und dessen Nachrichten und
Kontaktdaten lesen, „ohne dass das irgendwo steht" (AGE-566).

Konzipiert, nicht gebaut, sind die Mitgestalter-Rollen aus dem
Organisationskonzept vom 19.07.2026: Community Host, Event Host, City Lead,
Country Lead, Moderator, Sponsor Manager und weitere.

---

# Teil C — Mitgliedsstufen

## C.1 Das gültige Modell

Sechs Stufen, aufsteigende Rechte, von Detlev am **15.07.2026** bestätigt
(AGE-311). Das Modell ist im Repository als verbindliche Spezifikation
hinterlegt (`openspec/specs/membership-tiers/spec.md`).

| Rang | Schlüssel | Name in der Plattform | Preis / Jahr | Löst ab |
|---|---|---|---|---|
| 1 | `basic` | Basic | 0 € | *(neu)* |
| 2 | `connect` | Connect | 0 € | `discover` (alt) |
| 3 | `discover` | Discover | 150 € | `explore` |
| 4 | `exchange` | Exchange | 300 € | `impuls` |
| 5 | `focus` | Focus | 600 € | `active` |
| 6 | `impact` | Impact | 1.200 € | `prime` |

> **Namensabweichung:** Das Konzeptpapier vom 18.07.2026 nennt die erste
> Stufe durchgehend **BOOST**. In Datenbank und Oberfläche heißt sie
> **Basic** (`20260715150000_six_level_model.sql`, `src/config/levels.ts`).
> „BOOST" kommt im Produkt nirgends vor. Wenn die Marketing-Sprache gelten
> soll, ist das eine offene Entscheidung — kein Versehen der Umsetzung.

Die früheren Stufen `circle` (2.400 €) und `legacy` (4.800 €) sind **ersatzlos
entfallen**. Neue Konten starten auf `basic`.

> **Achtung, häufige Verwechslung:** `discover` bezeichnet in beiden Modellen
> etwas anderes. Im alten Modell war es die kostenlose Einstiegsstufe, im
> neuen ist es die erste bezahlte. Bestandsmitglieder auf altem `discover`
> (0 €) wurden auf `connect` überführt (Entscheidung Donald, 15.07.).

## C.2 Was die Stufen freischalten

Die Rechte-Matrix stammt aus der Upgrade-Spezifikation
`docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md` §2 (AGE-311) und
lebt heute in `src/config/levels.ts`. Sie steht **nicht** in
`openspec/specs/membership-tiers/spec.md` — dort stehen nur Leiter, Ränge,
Preise und der Vorgabewert.

| Ab Stufe | Was freigeschaltet wird |
|---|---|
| `basic` | Profil anlegen, Kompass beginnen, entdecken |
| `connect` | Kompass vervollständigen, erste Matchings, Favoriten |
| `discover` | Academy, volles Verzeichnis, erweiterte Matchings |
| `exchange` | Events, Kontaktanfragen, Aktivitätsbereich |
| `focus` | Als Anbieter auftreten, Leistungen veröffentlichen, Leads |
| `impact` | Volle Plattform, Priorität, Teams, Partnerprogramme |

**Immer gratis, unabhängig von der Stufe:** Nachrichten an bereits
akzeptierte Kontakte.

**Welpenschutz:** Neue Mitglieder sollen 30 Tage lang nicht kalt
kontaktierbar sein.

## C.3 Wo das Modell heute vom Soll abweicht

Zwei Abweichungen sind bekannt, dokumentiert und noch nicht behoben:

**1. Kontaktanfragen sind für alle offen.** Am 05.08.2026 wurde der
Plattform-Schalter `open_contact` auf `true` gesetzt — ein Erbe der
Sommerfest-Vorbereitung. Er hebelt seither jede Stufen-Schranke für
Kontaktanfragen und den Welpenschutz aus. Gemessen und dokumentiert am
25.08.2026 (AGE-598).

**2. Die korrigierte Rechte-Matrix ist entschieden, aber nicht gebaut.**
Donald hat am 25.08.2026 festgelegt: Verzeichnis sehen ab `connect` statt ab
`discover`; erweiterte Profilfelder bleiben bei `discover`; jedes Mitglied
wird gelistet, auch `basic`; Kontaktanfragen gestaffelt — `connect` darf nur
`connect` anschreiben, ab `discover` alle, `basic` gar nicht. Anlass war die
Frage „wieso sind basic-Mitglieder nicht im Verzeichnis?". Die Umsetzung
steht aus und setzt voraus, dass `open_contact` abgeschaltet wird (AGE-598).

---

# Teil D — Funktionale Anforderungen

Die Reihenfolge folgt der Nutzung, nicht der Bauzeit.

## D.1 Zugang und Identität

### D.1.1 Aktivierung als Zugangsvoraussetzung — **Umgesetzt**

Ein Konto ist erst nutzbar, wenn seine E-Mail-Adresse bestätigt wurde. Die
Prüfung liegt **in der Datenbank**, nicht in der Oberfläche: ohne bestätigte
Adresse gibt die Datenbank keine Mitgliederdaten heraus, gleich welche Stufe
das Konto trägt.

Der Ablauf, in der am 13.08.2026 festgelegten Fassung:

1. Das Mitglied ruft die Plattform auf und gibt seine E-Mail-Adresse ein.
2. Es erhält einen Aktivierungslink — vorgesehene Gültigkeit 72 Stunden,
   einmalig verwendbar. In der Datenbank liegt nur ein Hash des Tokens.
3. Über den Link setzt es sein Passwort. Mindestlänge 10 Zeichen.
4. Danach ist das Konto aktiv.

**Warum so:** Am 04.08. war noch eine Rundmail mit einem gemeinsamen
Standardpasswort vorgesehen — abgesichert dadurch, dass das Passwort allein
wertlos sein sollte (AGE-495). Am **13.08.** wurde das Standardpasswort dann
ganz verworfen: „solche Mails werden weitergeleitet" (AGE-534, Abschnitt 0).
Die Kehrseite ist benannt: Wer nicht mehr an seine hinterlegte Adresse kommt,
kommt ohne Admin-Hilfe gar nicht hinein.

**Warum nicht Supabase-Bordmittel:** Deren Bestätigungsmails sind auf zwei
Stück pro Stunde begrenzt. Bei 70 Mitgliedern an einem Abend unbrauchbar.
Zudem bestand Detlev auf dem Absender `info@fairbusinessclub.de`, den die
Bordmittel nicht hergeben (AGE-495).

### D.1.2 Passwort vergessen — **Umgesetzt**

Ein Mitglied kommt ohne fremde Hilfe zurück in sein Konto. Der Rückweg
verrät nicht, welche Adressen registriert sind. Es gelten dieselben
Versandgrenzen wie beim Aktivierungslink (`openspec/specs/password-reset/`).

### D.1.3 Selbstregistrierung — **Umgesetzt, ruhend**

Technisch vorhanden. Für den öffentlichen Start fehlen die
Voraussetzungen aus Teil D.10.

## D.2 Profil

### D.2.1 Das Mitgliederprofil — **Umgesetzt**

Jedes Mitglied pflegt: Name, Berufsbezeichnung, Kurzbeschreibung, Branche
(aus einer kuratierten Liste), vollständige Anschrift, Kontaktdaten,
Profilbild, Hintergrundbild, „Ich biete" und „Ich suche" — jeweils getrennt
nach Kategorie und Freitext.

Die Aufnahme der **vollständigen Anschrift** war eine bewusste Entscheidung
vom 13.08.2026; der Vorschlag, sie aus Datensparsamkeit wegzulassen, wurde
verworfen (AGE-534).

### D.2.2 Kontaktdaten sind geschützt — **Umgesetzt**

Telefonnummer, E-Mail-Adresse und die übrigen Kontaktdaten sind für
niemanden sichtbar außer dem Eigentümer — bis eine beidseitig angenommene
Kontaktanfrage zwischen zwei Mitgliedern existiert. Diese Regel ist als
Sicherheitsinvariante in der Datenbank verankert und lässt sich durch die
Oberfläche nicht umgehen.

### D.2.3 Vollständigkeits- und Potenzialwert — **Umgesetzt**

Das System berechnet serverseitig, wie vollständig ein Profil ist und einen
Potenzialwert. Beide sind vom Mitglied nicht schreibbar.

## D.3 Verzeichnis und Suche

### D.3.1 Mitgliederverzeichnis mit Filtern — **Umgesetzt**

Serverseitige Suche über Name, Branche, Ort sowie über die Kompass-Kategorien
„Ich biete" und „Ich suche". Zwei Reiter: alle Mitglieder und die eigenen
Kontakte.

### D.3.2 Gestufte Sichtbarkeit — **Umgesetzt**

Was ein Betrachter sieht, hängt von seiner Stufe ab. Für Gäste werden Namen
verschleiert; ohne Anmeldung fragt die Anwendung keine Autorendaten ab.

### D.3.3 Suche aus der Kopfzeile — **Umgesetzt**

Mit Tastatur und auf dem Telefon bedienbar. Suchergebnisse überleben keinen
Wechsel der angemeldeten Person.

## D.4 Kompass

### D.4.1 Der Kompass, wie er heute ist — **Umgesetzt**

Elf Kategorien, aus denen Mitglieder auswählen, was sie bieten und was sie
suchen: Kapital & Beteiligungen · Kontakte & Netzwerk · Expertise &
Know-how · Mentoring & Sparring · Immobilien · Leistungen · Investoren ·
Partner & Co-Founder · Experten & Berater · Mentoren · Projekte & Deals.

Der Kompass ist **kein eigener Menüpunkt**. Er erscheint als Filter über der
Mitgliederliste und als Block im Profil.

**Warum so:** Entscheidung vom 04.08.2026. Als eigene Seite „wirkt sie dünn",
und die matching-nahen Teile sollten zum Go-Live nicht sichtbar sein
(AGE-447, AGE-494).

> **Sprachregelung:** In der Oberfläche heißt es durchgängig „Kompass". In
> Datenbank und Quelltext heißt dasselbe weiterhin `compass`. Eine
> Umbenennung in der Datenbank wurde am 04.08. verworfen: sie „kostet eine
> Kaskade und bringt dem Nutzer nichts" (AGE-494).

### D.4.2 Der Kompass, wie er konzipiert ist — **Konzipiert**

Im Konzept ist der Kompass deutlich mehr: Er entsteht **automatisch** aus dem
Chancen-Profil und analysiert Potenziale, Interessen, Talente sowie passende
Kontakte, Unternehmen, Communities, Veranstaltungen, Jobs und Projekte. „Der
Nutzer erstellt keinen Compass" — er entsteht
(`260718 Plattform-Product-Bible v4.0-Boost-Connect.docx`).

Ausdrücklich **verworfen** für den Go-Live wurden dabei: der Fragebogen, das
Erfolgsradar und die Skalen zu Sein/Tun/Haben/Wirken (AGE-538).

## D.5 Matching und Kontaktanfragen

### D.5.1 Match-Engine — **Umgesetzt, ruhend**

Das System erzeugt serverseitig Übereinstimmungen zwischen den „Ich suche"-
und „Ich biete"-Angaben zweier Mitglieder und errechnet dazu einen
transparenten, gewichteten Wert. Matches sind nur für die Beteiligten
sichtbar.

**Ruhend:** Der Menüpunkt wurde zum Go-Live entfernt, die Routen leiten auf
die Startseite um. Der Code ist vollständig vorhanden (AGE-450, AGE-494).

### D.5.2 Kontaktanfrage-Ablauf — **Umgesetzt**

Ein Mitglied stellt eine Anfrage. Der Empfänger nimmt an oder lehnt ab. Erst
mit der Annahme werden Kontaktdaten freigegeben und ein Chat möglich. Pro
gerichtetem Paar existiert höchstens eine Anfrage; Absender können sich nicht
selbst annehmen und Anfragen nicht nachträglich umschreiben.

### D.5.3 DKRI-Routing für großvolumige Anfragen — **Umgesetzt, ruhend**

Übersteigt das Transaktionsvolumen einer Anfrage eine hinterlegte Schwelle,
wird sie zusätzlich in eine Warteschlange gelegt, die nur Matching-Manager
sehen. Der normale Ablauf bleibt davon unberührt — Phase 1 ist ausdrücklich
nur Warteschlange und Sichtbarkeit, nicht Freigabesteuerung (ADR-0002).

Die endgültige Volumenschwelle ist mit Detlev noch nicht festgelegt.

## D.6 Nachrichten

### D.6.1 Direktnachrichten — **Umgesetzt**

Ein Gesprächsfaden je Mitgliederpaar, sichtbar nur für die beiden
Beteiligten. Senden setzt eine angenommene Kontaktanfrage voraus. Neue
Nachrichten erscheinen in Echtzeit.

Umgesetzt sind außerdem: privater Lesestand je Mitglied, Ungelesen-Zähler in
der Oberfläche, seitenweises Laden langer Verläufe, Zeitstempel,
Emoji-Auswahl, und Gesprächsfenster, die unten am Bildschirmrand andocken —
das Mitglied bleibt auf der Seite, auf der es gerade ist.

## D.7 Aktivität, Events und Academy

### D.7.1 Aktivitätsfeed — **Umgesetzt**

Beiträge mit Text, bis zu sechs Bildern, Video-Link und kuratierten Tags.
Kommentare erben die Sichtbarkeit ihres Beitrags. Likes, Speichern für
später, Umfragen, geplante Beiträge, Filter nach Beitragstyp, seitenweises
Laden. Ohne Anmeldung ist der Feed ein Schaufenster.

### D.7.2 Events — **Umgesetzt**

Format, Zeitraum, Gastgeber, Kapazität, Titelbild, Themen. Drei Reiter:
Kommende, Vergangene, Meine. Anmeldung läuft über eine kapazitätsprüfende
Serverfunktion; nur der Gastgeber kann Anwesenheit setzen.

Ein neues Event **kündigt sich selbst im Feed an** — als verknüpfter
Beitrag, nicht als Kopie. Begründung: „Sonst steht im Feed morgen ein Titel,
den es nicht mehr gibt" (AGE-533).

### D.7.3 Academy — **Umgesetzt**

Die Academy ist eine **gefilterte Sicht** auf Beiträge mit Video — kein
eigenes Datenmodell. Zwei Regale: „Alle" und „Meine Academy" (aus den eigenen
Likes).

### D.7.4 Video-Einbettung mit Einwilligung — **Umgesetzt**

Videos von YouTube und Vimeo werden erst nach ausdrücklicher Zustimmung
geladen (Zwei-Klick-Lösung). Die Freigabe ist merkbar und widerrufbar.
Eigenes Video-Hosting ist ausgeschlossen — das war Detlevs Vorgabe von
Anfang an.

## D.8 Verwaltung

### D.8.1 Mitgliederverwaltung — **Umgesetzt**

Admins sehen eine Mitgliederliste in drei Sichten mit Anzahl je Reiter,
erreichen auch unbestätigte Profile, können Profile und die Login-Adresse
ändern, die Stufe in beide Richtungen setzen, einen Zugangslink auslösen,
ein Mitglied direkt aktivieren, es aus dem Verkehr nehmen oder entfernen —
ohne die Zeile zu löschen. Privilegierte Änderungen hinterlassen eine Spur
in einem Prüfprotokoll.

**Bewusst nicht enthalten:** ein Massenversand-Werkzeug.

### D.8.2 Qualitätsmanagement — **Umgesetzt**

Ein Feedback-Knopf schwebt dort, wo er nichts verdeckt. Admins sehen das
gesammelte Feedback auf einer eigenen Fläche.

### D.8.3 Release-Notes — **Umgesetzt**

Ein Admin stellt aus den archivierten technischen Änderungen eine redigierte
Mitteilung „Neues in der App" zusammen. Sie erreicht jedes aktivierte
Mitglied genau einmal, öffnet sich mittig, kann Bilder tragen und bleibt
danach auffindbar.

## D.9 Zahlungen

### D.9.1 Stripe-Upgrade — **Umgesetzt, ruhend**

Ein Mitglied startet ein Abonnement über Stripe Checkout. Die Stufe wird
**nicht** von der Oberfläche gesetzt, sondern ausschließlich vom
Stripe-Webhook, dessen Echtheit über die Stripe-Signatur geprüft wird.
Upgrades sind wiederholungsfest und können nie zu einer Herabstufung führen.

**Ruhend, weil:** Für Bestandsmitglieder auf `impact` sind die Preistafeln
ausgeblendet — sie haben bereits die höchste Stufe (AGE-633). Der Betrieb
läuft im Stripe-Testmodus.

**Nicht enthalten:** Rechnungsstellung und anteilige Verrechnung bei
unterjährigem Wechsel.

## D.10 Was konzipiert, aber nicht gebaut ist

Diese Anforderungen stehen in den Konzeptunterlagen bis Ende Juli 2026 und
sind **nicht umgesetzt**. Sie sind hier vollständig aufgeführt, damit die
Lücke zwischen Konzept und Plattform sichtbar bleibt.

| Thema | Was das Konzept vorsieht | Quelle |
|---|---|---|
| **ActivePoints** | Ein Punktesystem, das jede Aktivität belohnt: bewerten, scannen, einladen, Erfolge teilen. Kernmechanik der Stufe BOOST | Boost-Connect-Papier, 18.07. |
| **Bewertungen** | Nutzer bewerten Unternehmen, Organisationen und Veranstaltungen; daraus entsteht Reputation | Boost-Connect-Papier |
| **Gutschein-Börse** | Jedes CONNECT-Mitglied darf Vorteile einstellen und wird damit Sponsor. Gestaffelte Kontingente je Stufe (1 / 5 / 20 / unbegrenzt). Verrechnung der Einlösung auf beiden Seiten | Boost-Connect-Papier |
| **QR-Codes und Marketing-Kit** | Nach Veröffentlichung eines Vorteils entstehen automatisch QR-Code, Tischaufsteller, Poster, Flyer, Social-Media-Vorlagen, Bildschirmversion — als Download-Paket im Corporate Design | Boost-Connect-Papier |
| **Erfolgsgeschichten / Chancen-Feed** | Ein eigener Bereich, in dem Mitglieder Gewinne und Erfolge teilen; diese Beiträge werden ihrerseits bewertet und erzeugen Punkte | Boost-Connect-Papier |
| **Reputation aus echten Beziehungen** | Vertrauen entsteht aus belegten gemeinsamen Projekten, Arbeitgebern, Veranstaltungen, Ausbildungen — nicht aus anonymen Bewertungen | Boost-Connect-Papier |
| **Organisationen und Communities** | Unternehmen, Vereine und Schulen als eigene Objekte mit eigenen Profilen, Mitgliedern und Rechten | Organisationskonzept, 19.07. |
| **Project OS** | Projektverwaltung und Kooperationsrahmen als Kernbaustein | Organisationskonzept |
| **Wallet** | Guthaben- und Punktekonto als Kernbaustein | Organisationskonzept |
| **Module und Solution Partner** | Ein Drei-Ebenen-Modell: schlanker Kern, Module darauf, externe Lösungen über standardisierte Schnittstellen. Dazu ein Developer Kit mit API-Dokumentation, SDK, Sandbox und Freigabeprozess | Organisationskonzept |
| **Mitgestalter-Rollen und Cooperation Kits** | Community Host, City Lead, Country Lead und weitere Rollen, je mit standardisiertem Werkzeugkasten | Organisationskonzept |
| **Ambassadoren-Provision** | Mitglieder-Akquise über Botschafter: 25 % werben, 25 % betreuen, 50 % Zentrale | Epoche I, Konzeptordner |
| **Regionale Communities** | Ausrollen von Stuttgart in weitere Städte über Connectoren | Epoche I |
| **Library** | Wissens- und Vorlagenbereich als eigenes Format | Epoche I, 7 Formate |
| **Transaction Manager** | Zertifizierte Begleiter, die Vermittlungen betreuen | Epoche I |
| **Ökosystem-Anbindung** | Capital Parks als Ankaufsprofil im Matching, gemeinsame Ventures aus Plattform-Projekten | Epoche I |

---

# Teil E — Nichtfunktionale Anforderungen

## E.1 Sicherheit und Datenschutz

**Die Sicherheitsgrenze liegt in der Datenbank, nicht in der Oberfläche.**
Das ist die tragende Regel des Systems, seit dem 12.06.2026 durchgehalten und
als Spezifikation festgeschrieben. Jede Tabelle ist mit
Row-Level-Security geschützt; ohne passende Regel wird eine Anfrage
abgelehnt. Die Oberfläche ist Komfort, kein Schutz — wer sie umgeht, gewinnt
nichts.

**Zwei unabhängige Schranken liegen übereinander:** die Aktivierung und die
Mitgliedsstufe. Eine hohe Stufe ersetzt die Aktivierung nicht.

**Kontaktdaten werden nie stillschweigend freigegeben.** Siehe D.2.2.

**EU-Hosting.** Alle Dienste laufen in der EU: Datenbank und Dateien in
Frankfurt (`eu-central-1`), Fehlerprotokollierung über die EU-Instanz
`de.sentry.io`.

**Auftragsverarbeiter**, die in der Datenschutzerklärung genannt sind:
Supabase, Cloudflare, Sentry, Resend (AGE-497) sowie **Stripe** — die
ausgelieferte Erklärung (`src/content/legal/datenschutz.ts`) nennt es an zwei
Stellen.

**Selbst gehostete Schriften.** Google Fonts werden nicht eingebunden —
„in DE ein Abmahnthema" (AGE-492, 04.08.2026).

**Offen:** Das vollständige DSGVO-Paket — Auftragsverarbeitungsverträge,
Betroffenenrechte, Einwilligungsverwaltung, Audit-Protokollierung — ist
Backlog (AGE-260). Die Rechtsseiten Impressum, Datenschutz und AGB sind
seit dem 26.08.2026 erreichbar, aber ausdrücklich als **vorläufige Fassung**
gekennzeichnet.

## E.2 Betrieb und Verfügbarkeit

**Zwei strikt getrennte Umgebungen**, ohne Umschalter. Entscheidung vom
04.08.2026: „Wenn an einem Flag hängt, ob Produktion auf die Demo-Datenbank
zeigt, zeigt sie irgendwann versehentlich falsch" (AGE-496, ADR-0004).

**Migrationen erreichen die Produktion nur bewusst.** Der Auslöser war eine
Havarie am 14.06.2026: Code gemergt, Aufgaben auf erledigt, Tests grün,
Frontend ausgeliefert — und drei Datenbankänderungen fehlten in der
Produktion, drei Funktionen waren live kaputt. Jede Anzeige stand auf grün.
Seither: automatisch auf die Entwicklungsumgebung, ein Abgleich-Wächter vor
jeder Auslieferung, Produktion nur von Hand (siehe Anhang A.4).

## E.3 Sprache, Gestaltung, Bedienbarkeit

**Sprache:** Deutsch, durchgängig, auch in der technischen Benennung neuerer
Teile.

**Zwei Themes** über ein gemeinsames Vokabular an Gestaltungswerten: hell und
navy. Das Theme ist eine **Einstellung des Mitglieds**, kein Prüfwerkzeug,
und wird vor dem ersten Bildaufbau angewendet.

> **„navy" ist kein Dunkelmodus.** Es färbt ausschließlich Seitenleiste und
> Kopfzeile. Der Inhalt — Karten, Seitenhintergrund, Fließtext, Akzent,
> Statusfarben — trägt in **beiden** Themes dieselben Werte. Einen
> Dark-Reading-Mode gibt es bewusst nicht (AGE-499, Entscheidung 04.08.).

**Gestaltungsgrundsätze**, festgelegt am 04.08.2026 (AGE-492):
Akzentfarbe Blau `#2F6BD1` in beiden Themes; `#5B90E0` ist der Akzent **auf**
der dunklen Leiste. Fließtext in Anthrazit `#1E2A3A` — „nie reines Schwarz".
Schriften Fraunces und Inter. Leuchteffekte wurden entfernt, weil sie dem
Anspruch „ruhig und seriös" widersprechen.

**Bedienbarkeit:** Keine Seite lässt sich seitlich schieben. Overlays halten
die Seite dahinter still und den Fokus fest. Farbe trägt nie allein eine
Bedeutung. Jede Hauptseite öffnet leer mit einer Einladung, nicht mit einer
Fehlermeldung.

**Werbeaussagen brauchen eine Quelle.** Am 26.08.2026 wurden erfundene
Kennzahlen („120+ Mitglieder", „24 Events 2026") und erfundene Testimonials
von der öffentlichen Startseite entfernt — „‚120+' neben 70 echten Konten
ist eine Zahl, die jemand nachrechnen kann" (AGE-541).

## E.4 Qualitätssicherung

Jede Änderung durchläuft vor der Zusammenführung: Lint, Typprüfung,
automatische Tests und einen vollständigen Build. Zusätzlich wird jede
Datenbankänderung gegen eine leere Datenbank angewendet. Stand 31.08.2026:
**2.323 automatische Tests** in 210 Dateien, dazu 133 Tests der
Server-Funktionen.

---

# Teil F — Entscheidungshistorie

Jede Zeile: Datum, Entscheidung, Anlass, Konsequenz, Beleg.

## F.1 Mai bis Juni 2026 — Konzept und Prototyp

| Datum | Entscheidung | Anlass und Konsequenz |
|---|---|---|
| 30.05. | Eigene Plattform statt Odoo-Baukasten | Detlevs Mail. Am 02.06. geprüft: Odoo kaum genutzt, kein Lock-in, Migrationsaufwand ≈ 1 Stunde. `FBC_Analyse_Briefing.md` |
| 09.06. | Prototyp beauftragt: Profil, Verzeichnis, Matching-Hub, Feed, Events. Stufen Discover/Prime/Legacy. Pauschale 5.000 €, vier Wochen | Strategie-Spezifikation Detlev Krause. Linear-Projekt „FBC Plattform – Prototyp" |
| 11.06. | Datenmodell wird auf die verbindliche Spezifikation gezogen — durch vorwärts korrigierende Migrationen, nie durch Umschreiben | Das Fundament war vor der Spezifikation gebaut worden. ADR-0001 |
| 12.06. | Sichtbarkeit wird in der Datenbank erzwungen, nicht in der Oberfläche. Keine automatische Freigabe von Kontaktdaten | Leitprinzip. Prägt jede spätere Entscheidung. AGE-235 |
| 14.06. | Eigene Tabelle für Mitarbeiterrollen statt eines Feldes am Profil | Das vorhandene Rollenfeld ist vom Mitglied selbst beschreibbar — ein Mitglied hätte sich zum Admin machen können. ADR-0002 |
| 14.06. | **Havarie:** drei Migrationen fehlten in der Produktion, drei Funktionen live kaputt, alle Anzeigen grün | Auslöser für die Umgebungstrennung im August. `docs/w2-acceptance.md` |
| 15.06. | Abnahme Matching und Kontakt: Kontaktdaten erst nach Annahme, Chat nur für Beteiligte, Manager-Warteschlange rollengeschützt — in der Datenbank nachgewiesen | `docs/w3-acceptance.md` |
| 16.06. | **Prototyp abgenommen, 8 von 8 Kriterien grün** | Live gegen die Testumgebung verifiziert. AGE-255 |
| 16.06. | Phase 2 definiert: Stripe, Onboarding, Academy, DSGVO-Paket, Odoo-Anbindung | Bewusste Verschiebung nach der Abnahme |
| 16.06. | Demo-Daten: Der Schutz vor versehentlichem Überschreiben ist eine ausdrückliche Bestätigung, keine Umgebungserkennung | Entwicklung und Produktion waren dasselbe Projekt — eine Erkennung war unmöglich. ADR-0003 |
| 30.06. | In-Plattform-CRM **statt** Odoo | Odoo als CRM ist damit vom Tisch. AGE-301 |

## F.2 Juli 2026 — Die Wende

| Datum | Entscheidung | Anlass und Konsequenz |
|---|---|---|
| ~05.07. | **eff.bee.zee-Wende:** aus der Club-Plattform wird eine offene Chancen-Plattform | Epoche II. Konzeptunterlagen Dropbox |
| 14.07. | Product Bible v4.0 als zentrales Konzeptdokument | Erklärt sich selbst als „bewusst kein klassisches Lastenheft" |
| **15.07.** | **6-Level-Modell bestätigt** (`basic`→`impact`). `circle` und `legacy` entfallen | Detlevs Bestätigung. Rechte-Matrix wird in der Datenbank verankert; der alte Prüfhelfer `is_prime_plus()` wird durch einen Rang-Vergleich ersetzt. AGE-311 |
| 15.07. | Bestands-`discover` (0 €) wird zu `connect`; Neuanmeldungen starten auf `basic` | Die Spezifikation ließ den Schnitt offen. AGE-311 |
| 15.07. | Gestufte Beitrags-Sichtbarkeit entfällt im MVP | Nach Streichung von `legacy` wäre jeder legacy-Beitrag für niemanden sichtbar gewesen. Stufung wandert auf die Seitenebene. AGE-311 |
| 17.07. | Stripe-Upgrade fertig; die Stufe setzt allein der Webhook | AGE-259 |
| 18.07. | **BOOST und CONNECT als Wachstumsmotor konzipiert:** ActivePoints, Bewertungen, Gutschein-Börse, Marketing-Kit, Erfolgsgeschichten | Ziel „10 Millionen Menschen". Nichts davon ist gebaut — siehe D.10 |
| 19.07. | **Drei-Ebenen-Organisationsmodell:** schlanker Kern, Module, Solution Partner. Donald wird „Chief Platform Architect", nicht Programmierer von allem | Skalierung ohne Entwicklungsabteilung. Organisationskonzept |
| 21.07. | Sommerfest-Launch: Präsentationsversion bis Fr 24.07., Richtungstermin Mi 22.07. | Detlevs Mail: „Es geht nicht darum, alles umzusetzen, sondern die Richtung festzulegen". AGE-440 |
| 21.07. | E-Mail-Bestätigung für das Sommerfest abgeschaltet | Gäste registrieren vor Ort am Handy; mit Bestätigungspflicht bricht ein großer Teil ab. **Am 04.08. vollständig umgekehrt.** AGE-445 |
| 22.07. | Chancen und Matching raus aus dem Sommerfest-Umfang | QA mit Detlev, neun Beobachtungen. AGE-450 |
| **29.07.** | **Detlevs Pivot:** „Keine kleine Mitglieder-Plattform, sondern eff.bee.zee als offene Plattform, FBC ist die Premium-Community darin" | Die bisherige Roadmap ist damit inhaltlich überholt. Sommerfest-Launch fällt aus |

## F.3 August 2026 — Umbau und Go-Live

| Datum | Entscheidung | Anlass und Konsequenz |
|---|---|---|
| 03./04.08. | Roadmap Phasen 1–4 abgeschlossen und abgelöst durch „Go-Live August" und „Backlog danach". Acht Sommerfest-Aufgaben abgebrochen, je mit Begründung | Folge des Pivots |
| 04.08. | **Markenlogik gedreht:** eff.bee.zee ist die Marke, FBC die Premium-Community darin | „powered by eff.bee.zee unter Fair Business Club" wäre „genau verkehrt herum". AGE-444 |
| 04.08. | **Gestaltung neu:** Blau statt Gold, zwei Themes, Theme als Nutzereinstellung. Umbenennen statt Aliasen | 250 Stellen in 57 Dateien. Alle früheren Gestaltungsvarianten gelöscht. AGE-492 |
| 04.08. | Google Fonts raus, Schriften selbst hosten | Abmahnrisiko. AGE-492 |
| 04.08. | Axiom verworfen, Sentry bleibt (EU-Instanz) | AGE-497 |
| 04.08. | **Kompass wird schlank:** kein Fragebogen, kein Radar, kein eigener Menüpunkt — Filter über der Mitgliederliste | „Als eigene Seite wirkt sie dünn". AGE-447, AGE-494 |
| 04.08. | „Compass" heißt sichtbar „Kompass" — nur in der Oberfläche | Eine Umbenennung in der Datenbank „kostet eine Kaskade und bringt dem Nutzer nichts". AGE-494 |
| 04.08. | Navigation auf sieben Einträge. Nichts gelöscht, nur unerreichbar gemacht | Go-Live-Zuschnitt. AGE-494 |
| 04.08. | **E-Mail-Bestätigung wird Zugangsvoraussetzung**, in der Datenbank erzwungen | Kehrt die Entscheidung vom 21.07. um. AGE-495 |
| 04.08. | Supabase-Bestätigungsmails werden nicht genutzt — eigener Token, Versand über Resend | Zwei Mails pro Stunde Grenze; Absender nicht steuerbar. AGE-495 |
| 04.08. | **Zwei getrennte Supabase-Projekte, ausdrücklich ohne Umschalter.** Mindestlänge Passwort von 6 auf 10 | Ab dem 17.08. echte Personendaten. ADR-0004, AGE-496 |
| 05.08. | `open_contact = true` gesetzt | Sommerfest-Erbe. **Hebelt bis heute jedes Stufen-Gate für Kontaktanfragen aus.** AGE-598 |
| 10.08. | Rechtsseiten ans Ende der Go-Live-Woche verschoben | Hängen an Detlevs Texten. Erst am 26.08. fertig, als vorläufige Fassung. AGE-497 |
| **13.08.** | **Rundmail mit Standardpasswort verworfen.** Stattdessen: Adresse eingeben, Aktivierungslink erhalten, Passwort selbst setzen | „Kein geteiltes Passwort, kein Weiterleitungsrisiko". AGE-534 |
| 13.08. | Vollständige Anschrift kommt mit ins Profil | Donalds Entscheidung gegen den Vorschlag der Datensparsamkeit. AGE-534 |
| 13.08. | Academy ohne eigenes Datenmodell; Events weben sich verknüpft in den Feed | „Sonst steht im Feed morgen ein Titel, den es nicht mehr gibt". AGE-533 |
| 13.08. | **Onboarding neu erfunden:** drei Fragen plus fünf Tour-Stationen nach der Aktivierung | Bei **70 von 70** importierten Mitgliedern fehlten die Kompass-Kategorien — der Filter hätte ins Leere gefiltert. AGE-538 |
| **17.08.** | **Go-Live.** 70 Mitglieder importiert | Linear-Projekt „eff.bee.zee — Go-Live August 2026" |
| 17.08. | **Kein Admin-gesetztes Passwort.** Der Knopf heißt „Zugangslink schicken" | Ein Admin könnte sich sonst als Mitglied anmelden und dessen Nachrichten lesen, „ohne dass das irgendwo steht". AGE-566 |
| 20.08. | Entwicklungsumgebung trägt einen Spiegel der Produktion | Echte Mitglieder statt Demo-Personas. AGE-576 |
| **25.08.** | **Rechte-Matrix korrigiert:** Verzeichnis ab `connect`, Listung ohne Untergrenze, Kontaktanfragen gestaffelt | Frage „wieso sind basic-Mitglieder nicht im Verzeichnis?". **Entschieden, nicht gebaut.** AGE-598 |
| 26.08. | Video-Einbettung nur nach Einwilligung, merkbar und widerrufbar | DSGVO. AGE-611, AGE-621 |
| 26.08. | Erfundene Kennzahlen und Testimonials von der Startseite entfernt | Siehe E.3. AGE-541 |
| **27.08.** | **Mobile App: Capacitor, iOS und Android gleichzeitig.** Kein eigenes Repository | Begründung in Teil G.2. Projekt „eff.bee.zee — Mobile App" |
| 27.08. | Push nutzt denselben Abschalter wie die Glocke; Nachrichteninhalt nicht auf den Sperrbildschirm | „Zwei getrennte Schalter für dasselbe Ereignis wären eine Falle"; Sperrbildschirme liegen in Besprechungen offen. AGE-641 |
| 28.08. | Push-Serverseite (Phase A) fertig — der Vorgang als Ganzes läuft weiter | AGE-641 steht am 31.08. auf *In Progress* |
| 31.08. | **OTA-Dienst auf Supabase statt Cloudflare R2** | Die ursprüngliche Festlegung stand auf einer ungeprüften Behauptung: R2 war nie eingerichtet. ADR-0005 |

---

# Teil G — Verworfene Optionen

Was geprüft und abgelehnt wurde — damit die Fragen nicht erneut aufkommen.

## G.1 Produkt und Konzept

| Verworfen | Begründung |
|---|---|
| **Odoo als CRM und Abrechnung** | Der Gestaltungsanspruch passt nicht zum Baukasten; das Matching ist eigene Anwendungslogik, kein CMS-Feature. Nachgeprüft: kein Lock-in, kaum Nutzung |
| **Vollständiges soziales Netzwerk („LinkedIn + Facebook")** | Eines der teuersten Softwareprodukte überhaupt. Ersetzt durch: ein Vertrauens-Marktplatz mit Profil und Feed drumherum |
| **Altes Stufenmodell mit `circle` (2.400 €) und `legacy` (4.800 €)** | Ersatzlos gestrichen. Auch `prime` → `impact` ist **kein** bloßes Umbenennen — die Schwellen wurden neu abgeleitet |
| **Kompass mit Fragebogen, Erfolgsradar und Sein/Tun/Haben/Wirken-Skalen** | Für den Go-Live gestrichen. Das Onboarding hält ausdrücklich fest: nicht wiederbeleben |
| **Kompass als eigener Menüpunkt** | Inhaltlich identisch mit „Ich biete / Ich suche", als eigene Seite dünn |
| **Gestufte Beitrags-Sichtbarkeit im MVP** | Nach Streichung von `legacy` wäre jeder solche Beitrag für niemanden sichtbar gewesen |
| **WordPress-Videos automatisch als Beiträge übernehmen** | Nur 5 von 70 Mitgliedern hatten ein Video, mindestens eines war Fließtext. Und: „Beiträge im Namen von Menschen, die nicht gefragt wurden" |
| **Branchenbuch-Kaltanschreiben** | DSGVO und UWG in DACH. Ausdrücklich: nicht bauen |
| **„Autonomes KI-QM ohne Personal" als Versprechen** | Haftung. Ausdrücklich: nicht bauen |
| **Eigener Merchandise-Shop** | Lohnt sich am Anfang nicht — Druckdaten zum Download genügen |

## G.2 Technik

| Verworfen | Begründung |
|---|---|
| **PWA statt App** | Auf iOS funktioniert Push nur, wenn der Nutzer die Seite selbst zum Homescreen hinzufügt. Bei rund 70 Mitgliedern jenseits der 40 ist das ein Support-Fall pro Person. Dazu: keine Präsenz in den Stores |
| **React Native** | Teilt die Geschäftslogik, aber nicht die (damals gezählten) 107 Komponenten — Tailwind und DOM übertragen sich nicht, dazu 27 Dateien mit direktem Browserzugriff. Monate Arbeit und danach zwei Codebasen für einen Entwickler |
| **Eigenes Repository für die App** | „Das ist der Sinn von Capacitor: Der Web-Build *ist* die App" |
| **Supabase-Bestätigungsmails** | Zwei Mails pro Stunde; Absender und Vorlage nicht steuerbar |
| **Rundmail mit gemeinsamem Standardpasswort in BCC** | „Solche Mails werden weitergeleitet" |
| **Umschalter zwischen Produktion und Demo** | „Zeigt sie irgendwann versehentlich falsch" |
| **Migrationen automatisch auf die Produktion anwenden** | Der Testlauf belegt nur, dass eine Änderung auf eine *leere* Datenbank passt. Eine Pflichtspalte auf einer gefüllten Tabelle scheitert erst an echten Daten |
| **Admin setzt fremde Passwörter** | Siehe B.2 |
| **Aktivierungspflicht für Admins lockern** | Die Bedingung steht in mehreren Regeln und Funktionen gleichzeitig — „an einer Stelle lockern gibt es nicht" |
| **Cloudflare R2 für den App-Update-Weg** | Nachgemessen: R2 war nie eingerichtet. Supabase Storage steht bereits, spart einen Schlüssel in einer zweiten Umgebung |
| **Axiom als Protokollziel** | Sentry genügt und läuft auf der EU-Instanz |
| **Fremde Bibliothek für die Produkt-Tour** | Bringt eigene Gestaltung mit, die gegen das Design-System arbeitet |
| **Google Fonts per Einbindung** | Abmahnrisiko in Deutschland |

---

# Teil H — Offene Punkte

## H.1 Entschieden, aber nicht umgesetzt

| Punkt | Beleg |
|---|---|
| Korrigierte Rechte-Matrix (Verzeichnis ab `connect`, gestaffelte Kontaktanfragen) | AGE-598 |
| `open_contact` abschalten — Voraussetzung für das Vorige | AGE-598 |
| Endgültige Volumenschwelle für das DKRI-Routing (mit Detlev zu klären) | ADR-0002 |

## H.2 Voraussetzungen für den öffentlichen Start

| Punkt | Beleg |
|---|---|
| Offene Registrierung, sichtbare Stufen, Stripe im Echtbetrieb inklusive Rechnungen | AGE-299 |
| AGB, Widerruf, SEPA-Texte in endgültiger Fassung | AGE-497, AGE-610 |
| Lifecycle-Mails | AGE-299 |
| DSGVO-Restpaket: AV-Verträge, Betroffenenrechte, Einwilligungsverwaltung, Audit-Protokoll | AGE-260 |
| Vollständige Content-Security-Policy | AGE-515 |
| Schutz gegen Mailmissbrauch bei offener Selbstregistrierung | AGE-517 |
| Klärung: Darf ein unbestätigtes Konto sich zu öffentlichen Events anmelden? | AGE-514 |
| Klärung: Rückstufung bei geplatzter Zahlung | AGE-516 |

## H.3 Voraussetzungen für die App

| Punkt | Beleg |
|---|---|
| Eigene Domain `fbc.de` anbinden — blockiert die Deep Links | AGE-256 |
| **Kontolöschung im Produkt** — harte Bedingung des App Store, existiert heute nicht | AGE-644 |
| Signaturmaterial: Zertifikat, Provisioning Profile, Keystore | AGE-642 |
| Entscheidung Detlev: Store-Konto auf Einzelperson oder Firma. Im App Store steht der Name der Privatperson als Anbieter | AGE-644 |
| Store-Kosten: Apple 99 € jährlich, Google Play 25 $ einmalig | AGE-644 |

## H.4 Bekannte Altlasten

| Punkt | Beleg |
|---|---|
| Zwei Testkonten in der Produktivdatenbank | AGE-522 |
| `event_registrations` umgeht die abgesicherten Serverfunktionen | AGE-605 |
| Anonyme Lesepfade sind nicht repositoriumsweit geprüft | AGE-542 |
| Formatprüfung schlägt fehl (291 Dateien, davon 211 unter `openspec/`) | AGE-606 |
| `README.md` beschreibt noch den Prototypstand und ist irreführend | — |

---

# Anhang A — Technische Umsetzung im Überblick

Details und Diagramme stehen im **technischen Handbuch**
(`docs/technisches-handbuch.md`).

## A.1 Bausteine

| Schicht | Technologie |
|---|---|
| Oberfläche | React 19, Vite 8, Tailwind CSS 4, TypeScript |
| Datenhaltung, Anmeldung, Dateien, Echtzeit | Supabase (PostgreSQL), Region Frankfurt |
| Serverfunktionen | 12 Supabase Edge Functions (Deno) |
| Auslieferung | Cloudflare Pages |
| Mobile Hülle | Capacitor 8 (iOS und Android) |
| Fehlerprotokoll | Sentry, EU-Instanz |
| Zugangsdaten | Infisical |
| Zahlungen | Stripe (derzeit Testmodus) |
| E-Mail-Versand | Resend |

## A.2 Umfang

| Kennzahl | Stand 31.08.2026 |
|---|---|
| Seiten | 32 |
| Komponenten | 71 |
| Datenbank-Migrationen | 111 |
| Tabellen | 42 |
| Serverfunktionen (Edge) | 12 |
| Capability-Spezifikationen | 23 |
| Architekturentscheidungen (ADR) | 5 |
| Testdateien | 222 |
| Automatische Tests | 2.323 (Frontend) + 133 (Server) |

## A.3 Die tragende Sicherheitsregel

Fünf Prüffunktionen in der Datenbank sind die einzige Autorität für Rechte:

| Funktion | Prüft |
|---|---|
| `is_activated()` | Konto bestätigt, nicht gesperrt, nicht gelöscht |
| `current_tier_rank()` | Rang der Mitgliedsstufe (1–6) |
| `has_level(n)` | Rang mindestens n |
| `is_admin()` | Administratorrolle |
| `is_matching_manager()` | Matching-Manager-Rolle |

Diese Funktionen sind für nicht angemeldete Zugriffe gesperrt.
Auslöserfunktionen sind vollständig von der Programmierschnittstelle
genommen.

## A.4 Der Weg einer Änderung in die Produktion

```
Zusammenführung auf main
   │
   ├─ Entwicklungsumgebung   automatisch — die Generalprobe
   │
   ├─ Abgleich-Wächter       automatisch — Historie beidseitig vergleichen
   │                         Abweichung? → Auslieferung blockiert
   │
   └─ Auslieferung           nur wenn beides grün

Von Hand, wenn die Entwicklungsumgebung es getragen hat:
   └─ Produktions-Migration  zeigt Ziel und Probelauf VOR dem Anwenden
```

Der Abgleich-Wächter wird auch rot, **wenn er nicht messen kann** — fehlende
Zugangsdaten, Datenbank nicht erreichbar, geändertes Ausgabeformat. Ein
Wächter, der bei Nichtwissen grün wird, baut die Juni-Havarie eine Ebene
höher nach. Das ist kein theoretischer Fall: Am 05.08.2026 stellte die
Supabase-CLI ihr Ausgabeformat um, und der damalige Auswerter fand keine
einzige Zeile.

---

# Anhang B — Datenmodell im Überblick

42 Tabellen, gruppiert nach Gegenstandsbereich. Verbindliche Quelle für das
Schema sind die Migrationen unter `supabase/migrations/`.

| Bereich | Tabellen |
|---|---|
| **Mitglieder** | `profiles`, `profile_contacts`, `profile_interests`, `profile_legacy`, `profile_badges`, `profile_theme_scores`, `member_settings`, `membership_tiers`, `badges`, `goals` |
| **Zugang** | `activation_tokens`, `activation_attempts`, `staff_roles`, `platform_settings` |
| **Kompass und Matching** | `compass_responses`, `offers`, `needs`, `matches`, `routing_queue` |
| **Kontakt und Chat** | `contact_requests`, `message_threads`, `messages`, `thread_read_positions` |
| **Aktivität** | `posts`, `comments`, `post_likes`, `post_saves`, `post_media`, `tags` |
| **Events** | `events`, `event_registrations` |
| **Benachrichtigungen** | `notifications`, `push_tokens`, `push_routing`, `push_zustellungen` |
| **Verwaltung** | `admin_audit`, `feedback`, `release_notes`, `release_entry_skips` |
| **Partner** | `partners`, `partner_categories` |
| **App-Aktualisierung** | `ota_buendel` |

Dateiablage in fünf Sammlungen: `avatars`, `covers`, `post-media`,
`event-covers`, `ota-buendel`.

---

# Anhang C — Glossar

| Begriff | Bedeutung |
|---|---|
| **eff.bee.zee** | Die Marke der Plattform seit dem Pivot vom 29.07.2026. Offene Chancen-Plattform |
| **Fair Business Club (FBC)** | Die Premium-Community innerhalb von eff.bee.zee. Entspricht der Stufe `impact` |
| **Kompass** | Die Selbstauskunft „Ich biete / Ich suche" über elf Kategorien. Im Quelltext `compass` |
| **Chancen-Profil** | Konzeptbegriff für das vollständige Profil, aus dem der Kompass entstehen soll |
| **ActivePoints** | Konzipiertes Punktesystem für Aktivität. Nicht gebaut |
| **DKRI** | Kürzel für großvolumige Vermittlungsfälle, die statt direkter Freigabe in eine Manager-Warteschlange laufen |
| **Matching** | Die serverseitig errechnete Übereinstimmung zwischen Suche und Angebot zweier Mitglieder |
| **Aktivierung** | Die Bestätigung der E-Mail-Adresse. Voraussetzung für jeden Datenzugriff |
| **RLS** | Row-Level Security. Die Rechteprüfung in der Datenbank selbst |
| **Stufe / Tier** | Eine der sechs Mitgliedsstufen. `level_rank` ist ihr numerischer Rang |
| **Migration** | Eine versionierte, unveränderliche Änderung am Datenbankschema |
| **OpenSpec** | Das Verfahren, mit dem Anforderungen im Repository als verbindliche Spezifikationen leben |
| **OTA** | Over-the-air. Aktualisierung der App ohne erneute Store-Einreichung |
| **Capacitor** | Die Technik, mit der der Web-Build zur nativen App wird |
| **Welpenschutz** | Regel, nach der neue Mitglieder 30 Tage nicht kalt kontaktierbar sind |

---

# Anhang D — Quellen

**Linear** — Workspace AgenticApps, Präfix `AGE-`. Fünf Projekte tragen die
FBC-Historie: „FBC Plattform – Prototyp (abgeschlossen)", „FBC Plattform –
Roadmap Phasen 1–4 (abgelöst 08/2026)", „eff.bee.zee — Go-Live August 2026",
„eff.bee.zee — Backlog (nach Go-Live)", „eff.bee.zee — Mobile App".
*Achtung: Ein erheblicher Teil der Arbeit ab dem 23.08.2026 liegt ohne
Projektzuordnung.*

**Repository** `agenticapps-eu/fbc-platform`:
`openspec/specs/` (23 Spezifikationen) · `supabase/migrations/` (111) ·
`docs/decisions/` (ADR-0001 bis ADR-0005) · `docs/supabase-environments.md` ·
`docs/ci-cd.md` · `docs/design-system.md` · Abnahmeprotokolle
`docs/w2-`, `w3-`, `w4-acceptance.md`

**Konzeptunterlagen** (Stichtag 31.07.2026):
Dropbox `FBC Konzept 260520` — `Ausarbeitungen 2026-07/260714
Plattform-Product-Bible v4.0.docx` · `Ausarbeitungen 2026-07-15/260718
Plattform-Product-Bible v4.0-Boost-Connect.docx` · `.../260719 Plattform 03
Organisationskonzept EFF.BEE.ZEE.docx` · weitere Ausarbeitungen 02, 04, 05.
Projektordner `Fair Business Club` — `FBC_Analyse_Briefing.md` ·
`FBC_Technologie_und_Zeitplan.md` · `FBC_P4_Datenmodell_Spec.md` ·
`FBC_Roadmap_nach_Review_260629.md` · `FBC_Odoo_Recherche.md`

**Nicht berücksichtigt** auf Wunsch des Auftraggebers: alle
Konzeptunterlagen ab dem 01.08.2026, darunter die REAL-TRUST-Ausarbeitungen
vom 09.08.2026.

---

*Fassung 1.0 · 31.08.2026 · Erstellt von Donald Vlahović.
Änderungen an diesem Dokument gehören in eine neue Fassung mit Datum, nicht
in eine stille Korrektur.*
