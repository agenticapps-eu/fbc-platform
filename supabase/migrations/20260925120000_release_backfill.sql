-- Die 23 kuratierten Release-Geschichten stehen in der Aktivitaet (AGE-905).
-- Donald, 2026-09-25. Change: openspec/changes/release-backfill/.
--
-- ══ BEFUND ══════════════════════════════════════════════════════════════════
-- Mit dem Wegfall von www.effbeezee.com verlieren die 23 kuratierten
-- Geschichten ihre einzige OEFFENTLICHE Flaeche. In der Aktivitaet steht keine
-- einzige: gemessen am 25.09. lesend gegen PROD traegt `release_notes` 0
-- Zeilen — weder zugestellt noch als Entwurf — und `posts` traegt 17 Zeilen,
-- 10 `member` und 7 `event`, aber 0 `release`. Der Mechanismus aus AGE-631 und
-- AGE-718 ist gebaut und nie benutzt worden.
--
-- Was hier entsteht, ist AUSDRUECKLICH keine Wiederherstellung oeffentlicher
-- Verfuegbarkeit: die Karten tragen `visibility = 'members'` und erscheinen
-- nur aktivierten Mitgliedern.
--
-- ══ WARUM EINE MIGRATION UND KEIN EINMALIGES SKRIPT ════════════════════════
-- Der tragende Grund ist kein Geschmack, sondern ein Recht: KEIN CLIENT kann
-- `status = 'sent'` schreiben. `release_notes_admin_edit` traegt
-- `with check (… and status = 'draft')`, und `service_role` haelt auf `public`
-- keine Tabellenrechte (AGE-312). Ein Skript braeuchte also zuerst eine neue
-- `security definer`-Funktion — eine dauerhafte API-Flaeche, angelegt, um
-- genau einmal gerufen zu werden, und danach fuer immer im Schema und im
-- Golden-Snapshot von `grants_test.sql`.
--
-- Damit kostet der Skript-Weg TROTZDEM eine Migration und fuegt einen Handlauf
-- gegen PROD hinzu, der in keinem Diff steht.
--
-- ══ WARUM DER ZUSTANDSWECHSEL UND KEIN ZWEITER INSERT IN `posts` ═══════════
-- Diese Datei legt die Notes als `draft` an und setzt sie in einer zweiten
-- Anweisung auf `sent`. Den Feed-Beitrag erzeugt daraufhin der BESTEHENDE
-- Ausloeser `trg_release_feed_post`.
--
-- *Verworfen — die `posts`-Zeilen direkt einfuegen* (wie §7 von
-- 20260912100000): das schriebe die Insert-Gestalt ein zweites Mal ab —
-- `visibility`, beide Zeitspalten, `body = ''`, die `on conflict`-Klausel.
-- Zwei Orte fuer dieselbe Aussage driften, und `community-feed` sagt
-- „ausschliesslich beim Uebergang" ausdruecklich zu.
--
-- Der Preis ist ein kurzlebiger Entwurf, der `sent_at` bereits traegt. Das ist
-- kein Zustand, den jemand sehen kann: `supabase db push` faehrt eine
-- Migrationsdatei in EINER Transaktion, und diese Datei enthaelt bewusst kein
-- `create index concurrently`, das die Zusage braeche. Entweder stehen am Ende
-- 23 zugestellte Notes mit 23 Karten, oder gar nichts.
--
-- ══ WARUM `send_release_note()` NICHT GERUFEN WIRD ═════════════════════════
-- Die Funktion ist der EINZIGE Schreiber des Fan-outs: sie ruft
-- `hinweis_rundruf('release_note', …)` und erzeugt damit je aktiviertem Profil
-- eine `notifications`-Zeile. Push zieht seine Auftraege aus genau dieser
-- Tabelle. Sie zu umgehen IST die Zusage dieses Changes, nicht ein
-- Nebeneffekt der Umgehung.
--
-- Die Stille haengt NICHT daran, dass `push_routing` fuer `release_note` heute
-- `push = false` traegt — diese Zeile ist umschaltbar. Sie haengt an der
-- fehlenden `notifications`-Zeile.
--
-- ══ DIE ZWEI ZEITSPALTEN — UEBERNOMMEN AUS AGE-718 ═════════════════════════
-- Der Ausloeser speist `created_at` UND `veroeffentlicht_ab` aus
-- `coalesce(new.sent_at, now())`. Ein zurueckdatiertes `sent_at` ist damit der
-- einzige Hebel, den dieser Nachtrag braucht. Wer nur `created_at`
-- zurueckdatiert, bekommt 23 Karten als Block „heute" am Kopf der Aktivitaet —
-- der Feed ordnet ueber `veroeffentlicht_ab`.
--
-- ══ WELCHES DATUM — REDAKTIONELLE AUSGABEDATEN ════════════════════════════
-- Die sechs Daten stammen aus `src/content/release-ausgaben.ts` und sind
-- REDAKTIONELLE AUSGABEDATEN, keine Zustellzeitpunkte: zugestellt wurde nie
-- etwas. `release-ausgaben.ts` sagt das ueber sich selbst („gesetzt und nicht
-- gemessen"). Donald hat am 25.09. entschieden, dass das Ausgabe-Datum als
-- Veroeffentlichungsdatum gilt — und zwar an BEIDEN Flaechen, auf denen es
-- erscheint: im Feed als Zeitpunkt der Karte, auf `/neues` als Datum der
-- Mitteilung (`formatDatum(n.sent_at)`).
--
-- Das Archiv-Datum der Geschichte taugt dafuer nicht: es sagt, wann wir etwas
-- gebaut haben. Beide widersprechen sich hart — die Ausgabe vom 01.08.
-- enthaelt Geschichten mit den Archiv-Daten 25.08. bis 02.09.
--
-- ══ WARUM DIE MINUTEN GESTAFFELT SIND ══════════════════════════════════════
-- Der Feed ordnet ueber `(veroeffentlicht_ab desc, id desc)`. Bei gleichem
-- Zeitstempel entscheidet die zufaellige `id`, und dieselbe Ausgabe stuende
-- auf jedem Bestand in einer anderen Reihenfolge. Der Index in
-- `ausgabe.geschichten[]` ist laut Typkommentar die Leseordnung, also:
--
--   sent_at = <ausgabe.datum> 09:00+02 − (Index) Minuten
--
-- Index 0 bekommt den juengsten Zeitstempel und steht innerhalb seiner Ausgabe
-- oben — wer den Feed von neu nach alt liest, liest die Ausgabe in ihrer
-- Reihenfolge. Die laengste Ausgabe hat fuenf Geschichten (09:00 bis 08:56)
-- und kollidiert mit keiner Nachbarausgabe; dazwischen liegen sieben Tage.
-- `+02` steht AUSGESCHRIEBEN, damit die Zeitzone des Servers nichts
-- entscheidet (CEST gilt fuer alle sechs Daten).
--
-- ══ WARUM DIE TEXTE HIER ABGESCHRIEBEN STEHEN ══════════════════════════════
-- Ein zweites Mal neben `src/content/release-geschichten.ts`, und das ist
-- richtig so. `release-blog` sagt bereits zu: „Eine spaetere Textaenderung
-- aendert nichts Zugestelltes." Eine erschienene Karte ist ein historischer
-- Stand; wer morgen einen Tutorialtext redigiert, soll damit nicht rueckwirkend
-- umschreiben, was die Mitglieder vor Wochen gelesen haben. Ein Waechter, der
-- beide Fassungen gleich haelt, braeche genau diese Zusage — deshalb gibt es
-- ihn nicht.
--
-- Die Literale sind ERZEUGT und nicht getippt (Wegwerf-Schnipsel, nicht
-- eingecheckt). Damit die Herkunft pruefbar bleibt, steht sie hier:
--
--   Quelle:  src/content/release-geschichten.ts + release-ausgaben.ts
--   Stand:   2026-09-25, nach der Streichung des Halbsatzes „und wo du zur
--            Mitgliedschaft kommst" (AGE-907 hat den Weg mit 935b987 entfernt)
--   Digest:  sha256:4671a59d0121065712e0dc2dca789d866293243791b3992193aee45999417f76
--            ueber slug‖zeitstempel‖titel‖text aller 23 Zeilen, in dieser
--            Reihenfolge.
--
-- ══ WARUM DER AUTOR VORHER AUFGELOEST WIRD UND LAUT SCHEITERT ══════════════
-- `posts.author_id` ist `not null`. Der Ausloeser verlaesst sich OHNE INSERT,
-- wenn `coalesce(new.created_by, auth.uid())` leer ist — in einer Migration
-- gibt es kein `auth.uid()`, also entscheidet allein `created_by`. Eine
-- Migration, die ihn nicht setzt, erzeugte 23 Notes und NULL Karten, ohne
-- einen Fehler: der Ausfall waere von Erfolg nicht zu unterscheiden.
--
-- Der Kreuzprodukt-Weg allein genuegt nicht: faende die Unterabfrage keinen
-- Admin, ergaebe der Join 0 Zeilen und der Insert liefe still ins Leere. Genau
-- deshalb steht Schritt 1 als eigener, lauter Block DAVOR.
--
-- Wer die Zeile ist, hat keine Wirkung auf die Oberflaeche — gemessen, nicht
-- angenommen: `feed.ts` ersetzt den Absender einer Release-Karte durch
-- `absenderDerAnwendung()` mit dem festen Namen `eff.bee.zee`, und
-- `ReleaseCard` zeichnet bewusst keinen `Link` auf ein Profil.
--
-- ══ WARUM EIN FREMDER ENTWURF DIE MIGRATION ABBRICHT ═══════════════════════
-- Befund des Fremd-Plan-Reviews (codex, HOCH), und der schwerste des Laufs.
--
-- Der Waechter vor dem Insert ueberspringt einen vorhandenen Entwurf. Setzte
-- die naechste Anweisung danach „alle Entwuerfe mit passendem Slug" auf
-- `sent`, stellte sie SEINEN unfertigen Text als Karte an alle zu. Der
-- partielle Index auf `posts.release_note_id` haelt das nicht auf: er
-- verhindert zwei Karten zu EINER Note, nicht zwei Notes zu einem Slug.
--
-- Deshalb zwei Dinge: Schritt 2 bricht laut ab, wenn ein Slug einem fremden
-- ENTWURF gehoert, und Schritt 4 aktualisiert nur die IDs, die Schritt 3
-- selbst zurueckgegeben hat. Eine bereits ZUGESTELLTE Note zum selben Slug ist
-- dagegen der Wiederholungsfall und wird schweigend uebersprungen — das ist
-- die Idempotenz.
--
-- ══ WARUM `angekuendigt_am` GESTEMPELT WIRD ════════════════════════════════
-- Befund des Fremd-Plan-Reviews (gemini, HOCH), teilweise uebernommen.
--
-- `hinweis_neuer_beitrag()` verlaesst sich bei `kind <> 'member'` sofort —
-- stempelt dabei aber `angekuendigt_am` NICHT, denn das `update` steht im
-- Mitglieds-Zweig darunter. Die 23 Release-Zeilen blieben also dauerhaft
-- `angekuendigt_am IS NULL` und saehen fuer einen Nachlauf ohne Art-Filter wie
-- 23 unangekuendigte Beitraege aus. Dass daraus nichts wird, haelt heute
-- ALLEIN `where p.kind = 'member'` in `beitrag_ankuendigen()`. Dahinter stuenden
-- 23 Karten × 26 aktivierte Profile = 598 Hinweise.
--
-- *Nicht uebernommen — den Stempel in `release_feed_post_sync()` setzen:* der
-- Ausloeser gehoert jeder kuenftigen echten Zustellung, nicht nur diesem
-- Nachtrag. Ihn hier umzubauen aenderte das Verhalten von AGE-718 und
-- braeuchte ein Delta auf eine Anforderung, die dieser Change sonst nicht
-- anfasst.
--
-- Schritt 5 stempelt deshalb genau die 23 erzeugten Zeilen. Das zweite,
-- unabhaengige Bein — ohne fremdes Verhalten zu verschieben.
--
-- ══ DER RUECKWEG ═══════════════════════════════════════════════════════════
-- Forward-only, wie alles hier. Ein Rueckweg ist kein `down`-Skript, sondern:
--
--   delete from public.release_notes
--    where cardinality(entry_slugs) = 1
--      and entry_slugs[1] = any (array[ … die 23 Slugs … ]);
--
-- `posts_release_note_id_fkey` traegt `on delete cascade` und nimmt die Karten
-- mit. Das steht als Rezept hier und nicht als Datei: eine ungefahrene
-- Rueckwaerts-Migration ist eine Behauptung.

-- ── Schritt 0: die Nachtragsliste ─────────────────────────────────────────
-- Eine temporaere Tabelle statt einer CTE-Kette, und der Grund ist eine Falle:
-- ein daten-aenderndes CTE sieht seine eigenen Zeilen in einer zweiten
-- Anweisung desselben Statements NICHT (gleicher Snapshot). Ein
-- `with neu as (insert … returning id) update … where id in (select id from neu)`
-- traefe null Zeilen — und zwar still.
create temp table age905_nachtrag (
  slug       text primary key,
  erschienen timestamptz not null,
  titel      text not null,
  text       text not null
) on commit drop;

insert into age905_nachtrag (slug, erschienen, titel, text) values
  ($geschichte$2026-08-26-password-reset-flow$geschichte$,
   timestamptz $geschichte$2026-08-01 09:00:00+02$geschichte$,
   $geschichte$Passwort vergessen$geschichte$,
   $geschichte$Auf der Anmeldeseite steht unter dem Passwortfeld „Passwort vergessen?“. Genau dort sucht man ihn: in dem Moment, in dem man an diesem Feld scheitert.

Du gibst deine Adresse an und bekommst eine Nachricht mit einem Link. Über diesen Link setzt du ein neues Passwort. Der Link gilt 72 Stunden und lässt sich nur einmal verwenden; forderst du einen neuen an, wird der alte ungültig.

Mit dem neuen Passwort wirst du auf allen Geräten abgemeldet. Das ist Absicht: wenn jemand anderes an dein Konto gekommen ist, endet sein Zugang genau hier.

Hast du den Vorgang nicht angestoßen, kannst du die Nachricht ignorieren. Ohne den Link geschieht nichts, und dein bisheriges Passwort gilt weiter.

Wie oft ein solcher Link angefordert werden kann, ist begrenzt: nicht öfter als einmal pro Minute, und innerhalb von 24 Stunden nur eine begrenzte Zahl je Adresse. Das schützt dein Postfach davor, als Werkzeug benutzt zu werden.$geschichte$),
  ($geschichte$2026-08-26-fix-mobile-overflow$geschichte$,
   timestamptz $geschichte$2026-08-01 08:59:00+02$geschichte$,
   $geschichte$Die App auf dem Telefon$geschichte$,
   $geschichte$Die Anwendung ist bis herunter zu einer Fensterbreite von 320 Punkten ausgelegt — schmaler als die meisten Telefone im Hochformat. Bis dorthin lässt sich keine Seite seitlich verschieben: du blätterst nach unten, nicht nach rechts.

Dafür sorgen die Bausteine, aus denen die Seiten bestehen. Eine Karte und eine Listenzeile geben ihren Inhalt von sich aus nach, statt ihn über den Rand zu drücken. Damit gilt die Zusage auch für Seiten, die es heute noch nicht gibt.

Wo eine Tabelle sich beim besten Willen nicht schmaler machen lässt — etwa in der Verwaltung —, bekommt sie einen eigenen scrollbaren Rahmen. Dann schiebt sich die Tabelle, nicht die ganze Seite.

Ein Prüfschritt im Testlauf achtet darauf, dass keine feste Spaltenbreite ohne Rückfall für schmale Geräte hinzukommt. Die Zusage wird also bewacht, nicht nur einmal hergestellt.$geschichte$),
  ($geschichte$2026-08-25-profil-biete-suche-und-radar$geschichte$,
   timestamptz $geschichte$2026-08-01 08:58:00+02$geschichte$,
   $geschichte$Dein Profil, ohne erfundene Zahlen$geschichte$,
   $geschichte$Dein Profil erreichst du über „Mein Profil“. Oben stehen Bild, Name, Branche und Region, darunter deine Mitgliedschaft und ein Weg zum Bearbeiten.

Darunter stehen deine Interessen und Kompass-Einträge als Reihe kurzer Marken, und deine Such- und Bieteangaben als lesbarer Text. Kategorisierte Einträge tragen dabei keinen technischen Schlüssel mehr und keinen Titel, der nur den Anfang der Beschreibung wiederholt.

Stammen deine Angaben aus einer Übernahme älterer Daten, werden Reste der alten Formatierung beim Anzeigen weggelassen. In deinen Daten selbst wird dafür nichts verändert — du kannst sie jederzeit so bearbeiten, wie du sie eingegeben hast.

Was frühere Entwürfe als „Erfolgsradar“ zeigten, gibt es nicht. Dasselbe gilt für Statistiken, Projekte und Investments: erfundene Zahlen über ein Mitglied sind ein schlechterer erster Eindruck als eine ehrliche Leere.

Ist dein Profil noch leer, steht das auch so da, zusammen mit dem Weg zum Ausfüllen. Wie viel andere davon sehen, hängt von deren Stufe ab.$geschichte$),
  ($geschichte$2026-08-25-verzeichnis-reiter-und-kartencover$geschichte$,
   timestamptz $geschichte$2026-08-01 08:57:00+02$geschichte$,
   $geschichte$Alle Mitglieder, und deine Kontakte$geschichte$,
   $geschichte$Über dem Verzeichnis stehen zwei Reiter: „Alle Mitglieder“ und „Meine Kontakte“, jeweils mit der Anzahl daneben. Beide stehen immer da, auch wenn du noch keinen Kontakt hast.

Der Reiter sitzt neben Suche und Filter, nicht darüber, und ein Wechsel zwischen den Reitern verwirft deine Suche nicht.

Auf den Karten steht das Titelbild des Profils, dazu Name und Branche. Wer kein Titelbild hinterlegt hat, bekommt eine ruhige Fläche statt eines zufälligen Ersatzbildes.

Wie ausführlich eine Karte ausfällt, hängt von deiner Stufe ab.$geschichte$),
  ($geschichte$2026-09-02-rechte-matrix-stufen$geschichte$,
   timestamptz $geschichte$2026-08-08 09:00:00+02$geschichte$,
   $geschichte$Das Verzeichnis beginnt bei Connect$geschichte$,
   $geschichte$Das Mitgliederverzeichnis ist ab der Stufe Connect zu sehen. Du siehst die Liste aller Mitglieder, kannst darin suchen und nach Branche und Region eingrenzen.

Die ausführlichen Angaben eines Profils beginnen eine Stufe höher, ab Discover: Kompetenzen, Interessen, Kompass-Themen und das Such- und Bieteprofil. Auf den Karten im Verzeichnis bleiben diese Felder darunter leer, und auch die Suche findet unterhalb von Discover nichts, was in ihnen steht.

Passend dazu erscheinen die Filter für Kompetenz, Thema und Angebote erst ab Discover. Unterhalb dieser Stufe stehen sie nicht da; an ihrer Stelle steht, ab wann es sie gibt.

Diese Grenzen sitzen im Server, nicht in der Oberfläche. Was du nicht sehen darfst, wird gar nicht erst ausgeliefert.$geschichte$),
  ($geschichte$2026-08-31-suchspalte-rechts$geschichte$,
   timestamptz $geschichte$2026-08-08 08:59:00+02$geschichte$,
   $geschichte$Filter, die beim Blättern nicht weglaufen$geschichte$,
   $geschichte$Vier Flächen haben ihre Suche und ihre Filter an derselben Stelle, rechts neben der Liste: das Mitgliederverzeichnis, die Events, die Academy und die Aktivität. Auf einem breiten Bildschirm bleibt diese Spalte beim Blättern stehen.

Wer weit unten in einer langen Liste steht und den Filter ändern will, muss also nicht erst wieder nach oben.

Bei den Events suchst du über Titel, Beschreibung und Ort und grenzt nach Art und Thema ein. In der Academy suchst du im Text der Beiträge, grenzt über Schlagworte ein und wählst die Sortierung. Im Verzeichnis stehen Suche und Filter dauerhaft offen, statt zugeklappt.

Was du in diesen Spalten findest, hängt von deiner Stufe ab. Im Verzeichnis erscheinen die Filter für Kompetenz, Thema und Angebote erst ab Discover.

Eine Filterkarte, zu der es gerade keine Werte gibt, erscheint gar nicht. Suche und Sortierung stehen dagegen immer.

Auf einem schmalen Fenster oder auf dem Telefon rückt die Spalte in den normalen Fluss der Seite. Die Kartenraster richten sich nach dem Platz, den ihre Spalte tatsächlich hat, und brechen um, statt sich zu quetschen.$geschichte$),
  ($geschichte$2026-08-25-stille-fehlschlaege-und-anfragen-weg$geschichte$,
   timestamptz $geschichte$2026-08-08 08:58:00+02$geschichte$,
   $geschichte$Wo eine Kontaktanfrage landet$geschichte$,
   $geschichte$Schickt dir jemand eine Kontaktanfrage, findest du sie an zwei Stellen: als Hinweis in der Glocke und als Eintrag „Meine Anfragen“ im Menü unter „Mein Bereich“, mit der Anzahl daneben.

Dieser Menüeintrag steht da, solange offene Anfragen vorliegen, und verschwindet, wenn keine mehr offen sind. Anders als die Sprechblase für Nachrichten ist er ein Vorgang und kein Ort; er darf mit dem Vorgang gehen.

Lässt sich die Liste der Anfragen gerade nicht laden, steht das auch so da. Ein gescheiterter Abruf sähe sonst genauso aus wie ein leerer Posteingang. Schlägt nur ein Nachladen fehl, während bereits Anfragen angezeigt werden, bleiben diese stehen.

Versuchst du dich mit einer Adresse zu registrieren, zu der es schon ein Konto gibt, bekommst du einen neutralen Hinweis mit dem Weg zum Zugangslink. Eine Meldung, die ausspricht, dass es dieses Konto gibt, bekämst du nicht.$geschichte$),
  ($geschichte$2026-08-26-nachrichten-ungelesen-zaehler$geschichte$,
   timestamptz $geschichte$2026-08-15 09:00:00+02$geschichte$,
   $geschichte$Hat jemand geantwortet?$geschichte$,
   $geschichte$Montagmorgen, Seite auf — meistens ist das die erste Frage.

Die Antwort steht oben in der Kopfzeile. Die Sprechblase trägt die Anzahl deiner ungelesenen Nachrichten, und ein Klick bringt dich direkt in die Gespräche.

Ist alles gelesen, bleibt sie trotzdem stehen. So liegt der Weg zu deinen Nachrichten immer an derselben Stelle, auch wenn du ihn zum ersten Mal suchst.

Steht statt einer Zahl ein Ausrufezeichen, ließ sich die Anzahl gerade nicht abrufen. Eine Null stünde dort nur, wenn wirklich nichts wartet.

Ein bestätigtes Konto genügt.$geschichte$),
  ($geschichte$2026-08-27-chat-rechte-sidebar$geschichte$,
   timestamptz $geschichte$2026-08-15 08:59:00+02$geschichte$,
   $geschichte$Ein Gespräch mitnehmen, während du woanders liest$geschichte$,
   $geschichte$Du bist im Verzeichnis unterwegs und mittendrin schreibt dir jemand. Bisher hieße das: Seite verlassen, antworten, zurückfinden.

Dafür gibt es die Leiste am rechten Rand. Auf einem breiten Bildschirm bleibt sie neben jeder Seite stehen, mit deinen Gesprächen darin.

Beim ersten Besuch ist sie eingeklappt. Klapp sie auf, und die Anwendung merkt sich das für dieses Gerät. Auf einem schmaleren Fenster wird aus der Leiste eine Schublade, die du über einen eigenen Schalter in der Kopfzeile öffnest.

Auf der Nachrichtenseite selbst blendet sie sich aus — dort steht die Gesprächsliste ja schon.

Zu jedem Gespräch siehst du die letzte Nachricht. Das ist eine Vorschau, keine Lesebestätigung: dass sie dort steht, heißt nicht, dass die andere Seite sie gelesen hat.

Schreiben kannst du jemandem, sobald zwischen euch eine Kontaktanfrage angenommen ist.$geschichte$),
  ($geschichte$2026-08-27-chatfenster-angedockt$geschichte$,
   timestamptz $geschichte$2026-08-15 08:58:00+02$geschichte$,
   $geschichte$Drei Gespräche gleichzeitig$geschichte$,
   $geschichte$Ein Klick in der Gesprächsliste öffnet auf einem breiten Bildschirm kein neues Seitenziel, sondern ein kleines Fenster am unteren Rand. Du liest weiter, wo du bist, und antwortest nebenbei.

Drei Fenster stehen gleichzeitig offen. Öffnest du ein viertes, schließt sich das, das am längsten unberührt war. Verloren ist nichts, es steht weiter in der Liste daneben. Wird der Platz eng, teilen sich die Fenster die Breite, statt dass eines angeschnitten wird.

Jedes lässt sich einzeln klein machen und einzeln schließen. Klein bleibt die Titelzeile stehen, mit Bild, Name und der Anzahl ungelesener Nachrichten.

Die Fenster überleben einen Seitenwechsel und auch das Neuladen. Sie liegen auf deinem Gerät, nicht auf dem Server. An einem anderen Rechner fängst du wieder mit einer leeren Reihe an.

Ein aufgezogenes Fenster setzt deinen Lesestand vor, genau wie die vollständige Ansicht. Ein kleingemachtes tut das nicht: dort ist nichts gelesen worden.

Auf schmaleren Fenstern und auf dem Telefon gibt es die Reihe nicht. Dort ist die Nachrichtenseite der Weg.$geschichte$),
  ($geschichte$2026-08-28-emoji-und-zeitstempel-im-chat$geschichte$,
   timestamptz $geschichte$2026-08-15 08:57:00+02$geschichte$,
   $geschichte$Emoji, Uhrzeit und der Tag darüber$geschichte$,
   $geschichte$In der Zeile, in der du schreibst, sitzt ein Schalter für Emoji. Er öffnet ein Feld mit rund 1900 Zeichen in neun Gruppen, und du kannst darin auf Deutsch suchen: „Herz“, „grün“, auch „gruen“ ohne Umlaut.

Das Feld lässt sich vollständig mit der Tastatur bedienen. Die Zeichen laden erst beim ersten Öffnen und bremsen den Seitenaufbau daher nicht.

Jede Nachricht trägt ihre Uhrzeit, umgerechnet auf die Zeitzone, in der du gerade bist. Fährst du mit der Maus darüber, siehst du den vollständigen Zeitpunkt.

Zwischen den Tagen steht ein Marker: „Heute“, „Gestern“, sonst der Wochentag oder das Datum. So steht der Tag einmal über der Gruppe statt an jeder einzelnen Nachricht.

Getippte Emoticons werden beim Absenden zu Emoji: aus einem Doppelpunkt mit Bindestrich und Klammer wird ein lächelndes Gesicht. Die Liste ist bewusst kurz und greift nur an Wortgrenzen, damit Hausnummern und Beträge unangetastet bleiben. Was schon geschrieben ist, ändert sich nicht mehr.$geschichte$),
  ($geschichte$2026-08-28-chat-verlauf-paging$geschichte$,
   timestamptz $geschichte$2026-08-15 08:56:00+02$geschichte$,
   $geschichte$Weiter zurück im Gespräch$geschichte$,
   $geschichte$Ein langes Gespräch öffnet sich sofort. Sichtbar sind die letzten 50 Nachrichten — also genau die Stelle, an der du weiterliest.

Willst du weiter zurück, steht am oberen Rand „Ältere laden“. Der Knopf holt die nächsten 50 und verschwindet, sobald der Verlauf vollständig ist.

Die Ansicht bleibt dabei stehen, wo sie war. Nachgeladene Nachrichten treten oben hinzu, ohne dass es ans Ende des Gesprächs springt. Sonst müsstest du nach jedem Klick den Faden neu suchen.

Die Tagesmarker rücken mit: lädst du ältere Nachrichten desselben Tages nach, steht der Marker danach über der ersten davon.

Das gilt in der vollständigen Ansicht und in den kleinen Fenstern gleichermaßen.$geschichte$),
  ($geschichte$2026-08-25-activity-concept-level$geschichte$,
   timestamptz $geschichte$2026-08-22 09:00:00+02$geschichte$,
   $geschichte$Wo der Club spricht$geschichte$,
   $geschichte$Die Aktivität ist der gemeinsame Strom aus Beiträgen. Oben stehen drei Reiter: „Alle Beiträge“, „Beiträge von mir“ und „Gespeichert“.

Daneben wählst du die Sortierung: „Neueste zuerst“, „Älteste zuerst“ oder „Beliebteste“. Beliebtheit zählt dabei nur, was du auch sehen darfst; eine Zahl über verborgene Beiträge würde genau diese verraten.

Rechts steht eine Spalte mit Filtern nach Themen und Beitragsarten. Eine Filterkarte, zu der es gerade keine Werte gibt, erscheint gar nicht erst. Auf einem breiten Bildschirm bleibt die Spalte beim Blättern stehen, auf einem schmalen rückt sie in den Fluss der Seite.

Darunter siehst du die aktivsten Mitglieder, gezählt nach der Anzahl ihrer Beiträge. Wer sein Profil zurückgezogen hat oder noch nicht bestätigt ist, erscheint dort nicht.

Ohne Anmeldung siehst du „Alle Beiträge“. Die beiden anderen Reiter beziehen sich auf dich und setzen ein Konto voraus.$geschichte$),
  ($geschichte$2026-08-25-feed-beitragstyp-mehrfachauswahl$geschichte$,
   timestamptz $geschichte$2026-08-22 08:59:00+02$geschichte$,
   $geschichte$Nur die Beitragsarten, die dich interessieren$geschichte$,
   $geschichte$In der Seitenspalte stehen vier Auswahlkästchen: Bild, Video, Event und Text. Hakst du mehrere an, siehst du Beiträge, die einer der gewählten Arten entsprechen.

Kein Haken heißt „alle Arten“. Einen eigenen Eintrag „Alle Typen“ gibt es deshalb nicht: keiner angehakt und alle vier angehakt müssten dasselbe bedeuten.

Über dem Feed steht dann „Gefiltert nach“ mit den gewählten Arten. Jede lässt sich dort einzeln wieder abwählen, und daneben liegt ein Weg, alle Filter auf einmal zu entfernen. So siehst du auch bei weggeklappter Spalte, wonach gerade gefiltert wird.

Für die Themen gilt dasselbe: mehrere zusammen zeigen alles, was zu einem davon passt, nicht nur das, was zu allen passt.$geschichte$),
  ($geschichte$2026-08-30-geplante-beitraege$geschichte$,
   timestamptz $geschichte$2026-08-22 08:58:00+02$geschichte$,
   $geschichte$Heute schreiben, Dienstag zeigen$geschichte$,
   $geschichte$Manches schreibt man dann, wenn man Zeit hat, und zeigen möchte man es zu einem anderen Zeitpunkt. Im Eingabefeld für einen neuen Beitrag gibst du deshalb ein Datum und eine Uhrzeit an, statt sofort zu veröffentlichen.

Bis dahin sieht den Beitrag nur du selbst, gekennzeichnet mit „Geplant für“ und dem Zeitpunkt. Sonst niemand — auch keine Administration, und es gibt keine Freigabe durch andere.

Bis der Zeitpunkt erreicht ist, kannst du den Beitrag ändern, den Zeitpunkt verschieben, ihn auf „sofort“ stellen oder den Beitrag löschen.

Ist der Zeitpunkt da, erscheint der Beitrag im Feed, als wäre er in diesem Moment geschrieben worden: oben, nicht an der Stelle, an der du ihn verfasst hast.

Wer nichts plant, merkt davon nichts.$geschichte$),
  ($geschichte$2026-08-31-composer-abbruch$geschichte$,
   timestamptz $geschichte$2026-08-22 08:57:00+02$geschichte$,
   $geschichte$Einen angefangenen Beitrag verwerfen$geschichte$,
   $geschichte$Neben „Posten“ steht „Abbrechen“. Der Weg zurück gehört zu jedem Formular, in das man etwas hineinschreiben kann.

Verworfen wird alles auf einmal: der Text, ein eingefügter Video-Link samt dem aufgeklappten Feld dafür, die gewählten Bilder, die gewählten Themen, die Sichtbarkeit zurück auf „Mitglieder“ und ein geplanter Zeitpunkt zurück auf „sofort“. Auch eine stehen gebliebene Fehlermeldung zu einem Bild verschwindet.

Klappst du das Feld danach wieder auf, beginnt es leer.$geschichte$),
  ($geschichte$2026-08-26-add-video-consent-gate$geschichte$,
   timestamptz $geschichte$2026-08-29 09:00:00+02$geschichte$,
   $geschichte$Warum ein Video erst auf Klick lädt$geschichte$,
   $geschichte$Ein eingebettetes Video lädt nicht von selbst. An seiner Stelle steht zunächst eine Fläche mit dem Hinweis, von welchem Anbieter das Video kommt, und ein Knopf, um es zu laden.

Der Grund steht daneben: sobald das Video geladen wird, entsteht eine Verbindung zu diesem Anbieter, und dabei geht deine IP-Adresse an ihn. Diese Entscheidung soll bei dir liegen und nicht dadurch fallen, dass du eine Seite geöffnet hast, auf der zufällig ein Video steht.

Ein Verweis auf die Datenschutzerklärung steht direkt an dieser Fläche, dort, wo die Frage gestellt wird.

Bis du klickst, wird nichts vom Anbieter nachgeladen: kein Player, kein Vorschaubild von dort, keine Zählpixel.

Das gilt überall, wo Videos vorkommen, auch ohne Konto.$geschichte$),
  ($geschichte$2026-08-27-video-freigabe-merken$geschichte$,
   timestamptz $geschichte$2026-08-29 08:59:00+02$geschichte$,
   $geschichte$Einmal freigeben statt jedes Mal$geschichte$,
   $geschichte$Gibst du ein Video frei, gilt das ab dann für den jeweiligen Anbieter, dauerhaft und auf diesem Gerät. Auf einer Seite mit fünf Videos musst du nicht fünfmal dasselbe bestätigen.

Die Freigabe gilt je Anbieter, nicht allgemein: gibst du den einen frei, hast du über den anderen nichts gesagt.

Sie greift sofort auf allen weiteren Videos derselben Seite, ohne dass du neu laden musst. Ein Video, das du gerade angeklickt hast, läuft dabei sofort los und bekommt den Tastaturfokus. Eines, das nur wegen der gemerkten Freigabe mitgeladen wurde, tut beides nicht: es fängt nicht von selbst an zu spielen, und es reißt dir den Fokus nicht weg.

Zurücknehmen kannst du die Freigabe auf der Datenschutzseite, je Anbieter einzeln. Diese Seite ist auch ohne Konto erreichbar; wer nie angemeldet war, kommt trotzdem an den Widerruf.

Die Freigabe liegt auf deinem Gerät, nicht in deinem Konto. An einem anderen Rechner wirst du wieder gefragt.$geschichte$),
  ($geschichte$2026-08-27-glocke-und-hinweistypen$geschichte$,
   timestamptz $geschichte$2026-08-29 08:58:00+02$geschichte$,
   $geschichte$Was die Glocke meldet$geschichte$,
   $geschichte$Oben in der Kopfzeile steht eine Glocke. Sie zeigt, was seit deinem letzten Blick dazugekommen ist, und bei null zeigt sie keine Zahl.

Gemeldet werden acht Anlässe: ein neuer Beitrag, ein neues Event, ein Kommentar zu deinem Beitrag, ein Gefällt-mir zu deinem Beitrag, eine neue Nachricht, eine eingegangene Kontaktanfrage sowie die Annahme und die Ablehnung einer Anfrage. Dazu kommt ein Hinweis, wenn es Neues in der App gibt.

Einen Hinweis markierst du einzeln als gelesen, oder alle auf einmal.

Was dir davon zu viel ist, schaltest du in den Einstellungen ab — ein Schalter je Ereignis, und er gilt für die Glocke wie für eine Push-Nachricht aufs Telefon. Voreingestellt ist alles eingeschaltet. Die drei Anlässe rund um Kontaktanfragen hängen an einem gemeinsamen Schalter.

Die Glocke zeigt ausschließlich deine eigenen Hinweise.$geschichte$),
  ($geschichte$2026-09-07-events-vorlagen-und-serientermine$geschichte$,
   timestamptz $geschichte$2026-09-05 09:00:00+02$geschichte$,
   $geschichte$Eine Terminreihe, einmal eingerichtet$geschichte$,
   $geschichte$Wer regelmäßig zu etwas einlädt — ein Stammtisch, eine Sprechstunde, ein monatlicher Austausch —, füllt den Termin nicht jedes Mal neu aus. Eine Vorlage hält alles fest, was gleich bleibt: Titel, Uhrzeit, Dauer, Typ, Ort, Kapazität, Sichtbarkeit, Themen und Titelbild.

Die Vorlagen liegen unter Events im Reiter „Vorlagen“. Dort legst du eine an und gibst ihr eine Wiederholung: wöchentlich an einem Wochentag, monatlich an einem festen Tag im Monat, oder monatlich am n-ten Wochentag — etwa jeder erste Dienstag im Monat. Eine Vorlage ohne Regel ist ebenfalls möglich; aus ihr entsteht ein einzelner Termin zu einem Datum, das du angibst.

Aus der Vorlage erzeugst du dann die Termine: ein Startdatum, dazu entweder eine Anzahl oder ein Enddatum, höchstens 52 Termine je Erzeugung. Bevor du bestätigst, siehst du die Liste der Daten, die entstehen würden.

Jeder erzeugte Termin ist danach ein gewöhnliches Event. Anmeldung, Kapazität, Warteliste und Check-in gelten für jeden Termin einzeln, nicht für die Reihe. Fällt ein Termin aus oder verschiebt er sich, bearbeitest oder löschst du genau diesen einen — die übrigen bleiben unberührt.

Wer ein Event anlegen darf, darf auch eine Vorlage anlegen und daraus Termine erzeugen. Der Reiter erscheint, sobald du angemeldet bist.$geschichte$),
  ($geschichte$2026-08-25-event-anmeldeknopf-teilnahmeschwelle$geschichte$,
   timestamptz $geschichte$2026-09-05 08:59:00+02$geschichte$,
   $geschichte$Warum manchmal ein grauer Knopf dasteht$geschichte$,
   $geschichte$Events gibt es in zwei Sichtbarkeiten. Öffentliche Events stehen jedem bestätigten Konto offen. Events für Mitglieder verlangen zum Anmelden die Stufe Discover.

Reicht deine Stufe für ein Event nicht, bleibt der Anmeldeknopf gesperrt. Daneben steht, warum: welche Stufe nötig ist.

Wer ein Event ausrichtet, darf sich zum eigenen Event immer anmelden, unabhängig von seiner Stufe.

Solange deine Stufe noch geladen wird, ist der Knopf nicht gesperrt.

Sehen kannst du beide Arten von Events. Die Stufe entscheidet über die Anmeldung, nicht darüber, ob ein Termin im Kalender auftaucht.$geschichte$),
  ($geschichte$2026-08-28-sidebar-pill$geschichte$,
   timestamptz $geschichte$2026-09-05 08:58:00+02$geschichte$,
   $geschichte$Platz schaffen, wenn du ihn brauchst$geschichte$,
   $geschichte$Links steht das Menü, rechts die Leiste mit den Gesprächen. Beide klappst du über dasselbe Bauteil weg: einen halben Knopf am inneren Rand der Leiste, der ein Stück über die Kante hinausragt. Links und rechts sitzt er auf derselben Höhe, nur gespiegelt.

Er ist immer sichtbar, nicht erst, wenn du mit der Maus in die Nähe kommst. Auf einem Touchgerät gäbe es ihn sonst gar nicht.

Ist die rechte Leiste eingeklappt, bleibt die Sprechblase darin anklickbar. Sie zeigt weiterhin, ob etwas Ungelesenes da ist, und führt zu den Nachrichten.

Was du einklappst, bleibt eingeklappt, auch nach einem Neuladen. Der Zustand liegt auf deinem Gerät.$geschichte$),
  ($geschichte$2026-09-02-feedback-ausbauen$geschichte$,
   timestamptz $geschichte$2026-09-05 08:57:00+02$geschichte$,
   $geschichte$Rückmeldung geben — und was damit passiert$geschichte$,
   $geschichte$Im Menü steht ein Weg, Rückmeldung zu geben. Du wählst ein Thema, gibst eine Bewertung ab und schreibst dazu, was dir aufgefallen ist.

Zur Auswahl stehen fünf Themen: Generell, Fehler oder etwas geht nicht, Bedienung und Verständlichkeit, Inhalte und Texte, sowie Idee oder Wunsch. Ohne Auswahl zählt eine Rückmeldung als Generell.

Du kannst ein Bild mitschicken. Bei einer Sache, die anders aussieht als erwartet, ist ein Bildschirmfoto oft schneller erklärt als drei Sätze.

Deine Rückmeldung geht an die Administration, die sie nach Thema und Bewertung durchsehen kann. Sie kann daraus ein Gespräch mit dir eröffnen, ohne dass vorher eine Kontaktanfrage nötig wäre. Sonst ließe sich eine Rückfrage zu einem gemeldeten Problem gar nicht stellen. In diesem Gespräch dürfen beide Seiten schreiben.

Anonym ist Feedback damit nicht: es hängt an deinem Konto, weil sonst niemand zurückfragen könnte.$geschichte$);

-- ── Schritt 1: der Autor — und ZWEI sehr verschiedene Lagen ohne ihn ──────
-- Muss VOR dem Insert stehen und ein eigener Block sein: im Kreuzprodukt
-- unten ergaebe ein fehlender Admin 0 Zeilen und einen stillen Nulllauf.
--
-- ══ WARUM HIER NICHT EINFACH `raise exception` STEHT ═══════════════════════
-- Die erste Fassung brach bei jedem fehlenden Admin ab. Das haette `main` rot
-- gemacht, und zwar sofort: der CI-Job `migrations` faehrt `supabase db reset`
-- gegen eine FRISCHE Datenbank, `supabase/seed.sql` existiert nicht, und Seeds
-- liefen ohnehin NACH den Migrationen. Dort gibt es 0 Profile und 0
-- `staff_roles` — die Migration waere bei jedem Lauf gescheitert.
--
-- Die Lage „kein Admin" ist deshalb keine Lage, sondern zwei:
--
--   * KEINE PROFILE. Eine frische Datenbank: CI, ein neuer Entwicklerstack.
--     Es gibt niemanden, dem etwas zuzuschreiben waere, und niemanden, der die
--     Karten sehen koennte. Hier ist Ueberspringen die richtige Antwort und
--     KEIN stiller Ausfall — es ist schlicht nichts zu tun.
--   * PROFILE, ABER KEIN ADMIN. Eine bestueckte Flaeche, die niemanden zum
--     Zuschreiben hat. Genau hier entstuenden 23 Notes ohne eine einzige Karte,
--     und genau hier gehoert laut abgebrochen.
--
-- Der Unterschied ist der zwischen einem roten CI und einem stillen
-- Datenverlust — und beide Antworten waeren an der jeweils anderen Stelle
-- falsch.
create temp table age905_lauf (autor uuid not null) on commit drop;

do $$
declare
  v_autor uuid;
begin
  select s.profile_id into v_autor
    from public.staff_roles s
    join public.profiles p on p.id = s.profile_id
   where s.role = 'admin'
   order by s.profile_id
   limit 1;

  if v_autor is not null then
    insert into age905_lauf (autor) values (v_autor);
    return;
  end if;

  if exists (select 1 from public.profiles) then
    raise exception
      'AGE-905: Profile vorhanden, aber kein Admin in staff_roles — der '
      'Nachtrag erzeugte Notes ohne Feed-Karte, weil release_feed_post_sync() '
      'ohne created_by nicht einfuegt. Abbruch statt stillem Nulllauf.';
  end if;

  raise notice
    'AGE-905: leere Datenbank (0 Profile) — Nachtrag uebersprungen. Das ist '
    'der CI-Fall; es gibt niemanden, dem die Mitteilungen zuzuschreiben '
    'waeren, und niemanden, der sie saehe.';
end $$;

-- ── Schritt 2: ein fremder Entwurf bricht ab ──────────────────────────────
-- Ein Slug, der einer ZUGESTELLTEN Note gehoert, ist der Wiederholungsfall und
-- bleibt hier ausdruecklich unbehelligt.
do $$
declare
  v_fremd text;
begin
  select string_agg(distinct n.slug, ', ' order by n.slug) into v_fremd
    from age905_nachtrag n
    join public.release_notes rn on rn.entry_slugs @> array[n.slug]
   where rn.status = 'draft';

  if v_fremd is not null then
    raise exception
      'AGE-905: auf diese Slugs liegt bereits ein ENTWURF: %. Der Nachtrag '
      'wuerde ihn beim Zustandswechsel mit zustellen. Erst von Hand klaeren.',
      v_fremd;
  end if;
end $$;

-- ── Schritt 3: die fehlenden Notes, als Entwurf ───────────────────────────
-- `recipient_count = 0` und nicht NULL: der Nachtrag erzeugt keine Hinweise,
-- also ist 0 die MESSUNG und nicht die fehlende Messung. `/neues` und die
-- Admin-Flaeche lesen die Spalte.
--
-- `entry_slugs @> array[n.slug]` und nicht `= array[n.slug]`: eine Note darf
-- mehrere Eintraege abdecken (so benutzt die Admin-Flaeche sie), und ein
-- Waechter, der das uebersaehe, legte eine zweite Note zum selben Slug an.
create temp table age905_neu (id uuid primary key) on commit drop;

with eingefuegt as (
  insert into public.release_notes
    (title, body, entry_slugs, status, created_by, sent_at, recipient_count)
  select n.titel,
         n.text,
         array[n.slug],
         'draft',
         a.autor,
         n.erschienen,
         0
    from age905_nachtrag n
   cross join age905_lauf a
   where not exists (
     select 1 from public.release_notes rn
      where rn.entry_slugs @> array[n.slug]
   )
  returning id
)
insert into age905_neu (id) select id from eingefuegt;

-- ── Schritt 4: der Zustandswechsel — hier feuert der Ausloeser ────────────
-- NUR auf den eigenen IDs. Eine Slug-Menge hier waere der Weg, auf dem ein
-- fremder Entwurf doch noch zugestellt wuerde (Befund codex, HOCH).
update public.release_notes rn
   set status = 'sent'
  from age905_neu n
 where rn.id = n.id
   and rn.status = 'draft';

-- ── Schritt 5: `angekuendigt_am` stempeln ─────────────────────────────────
-- Das zweite, unabhaengige Bein gegen `beitrag_ankuendigen()`. Der Grund steht
-- im Kopf. `trg_posts_video_url` feuert hier erneut und ist folgenlos: die
-- Funktion rechnet `video_url` aus `body`, und `body` ist bei einer
-- Release-Karte leer.
update public.posts p
   set angekuendigt_am = now()
  from age905_neu n
 where p.release_note_id = n.id
   and p.kind = 'release'
   and p.angekuendigt_am is null;

-- ── Schritt 6: die Zusage nachrechnen, statt sie zu unterstellen ──────────
-- Der teuerste Ausfall dieses Nachtrags waere der STILLE: Notes ohne Karten.
-- Diese Pruefung gilt unabhaengig davon, ob der Lauf der erste oder der zehnte
-- ist — sie misst den Zustand, nicht die Veraenderung.
do $$
declare
  v_ohne_note    text;
  v_ohne_karte   text;
  v_ohne_stempel int;
begin
  -- Uebersprungener Lauf (leere Datenbank): es gibt nichts nachzurechnen, und
  -- die Pruefungen unten wuerden reihum anschlagen.
  if not exists (select 1 from age905_lauf) then
    return;
  end if;

  select string_agg(n.slug, ', ' order by n.slug) into v_ohne_note
    from age905_nachtrag n
   where not exists (
     select 1 from public.release_notes rn
      where rn.entry_slugs @> array[n.slug] and rn.status = 'sent'
   );
  if v_ohne_note is not null then
    raise exception 'AGE-905: keine zugestellte Note fuer: %', v_ohne_note;
  end if;

  select string_agg(n.slug, ', ' order by n.slug) into v_ohne_karte
    from age905_nachtrag n
    join public.release_notes rn on rn.entry_slugs @> array[n.slug]
   where rn.status = 'sent'
     and not exists (
       select 1 from public.posts p
        where p.release_note_id = rn.id and p.kind = 'release'
     );
  if v_ohne_karte is not null then
    raise exception 'AGE-905: Note ohne Feed-Karte fuer: %', v_ohne_karte;
  end if;

  -- Die Karte muss das Datum ihrer Ausgabe tragen, in BEIDEN Zeitspalten.
  -- Eine Karte mit `veroeffentlicht_ab = now()` waere der Fehler, den der
  -- Kopf beschreibt, und er faellt sonst erst in der Sichtprobe auf.
  if exists (
    select 1
      from age905_nachtrag n
      join public.release_notes rn on rn.entry_slugs @> array[n.slug]
      join public.posts p on p.release_note_id = rn.id and p.kind = 'release'
     where p.veroeffentlicht_ab is distinct from n.erschienen
        or p.created_at is distinct from n.erschienen
  ) then
    raise exception
      'AGE-905: eine Karte traegt nicht das Datum ihrer Ausgabe in beiden '
      'Zeitspalten.';
  end if;

  select count(*)::int into v_ohne_stempel
    from age905_nachtrag n
    join public.release_notes rn on rn.entry_slugs @> array[n.slug]
    join public.posts p on p.release_note_id = rn.id and p.kind = 'release'
   where p.angekuendigt_am is null;
  if v_ohne_stempel > 0 then
    raise exception
      'AGE-905: % Karte(n) ohne angekuendigt_am — beitrag_ankuendigen() haelt '
      'sie dann allein am Art-Filter zurueck.', v_ohne_stempel;
  end if;
end $$;
