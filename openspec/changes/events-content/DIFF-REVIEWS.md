---
reviewers: [codex]
models: [gpt-5.6-sol]
verdicts: [REQUEST-CHANGES]
stage: diff
---

# Diff review — events-content (AGE-531, C8)

Schritt 4 des Workflows: ein unabhängiger Leser auf den **Diff**, nicht auf den
Plan. Anderer Anbieter als der Verfasser. Gelesen wurde
`git diff main...HEAD -- supabase/ src/ scripts/` nach den Commits `f3ec42b`
und `dce905f`.

Vier Befunde, **alle vier übernommen**. Der erste ist ein echter Fehler im
Verhalten, nicht eine Stilfrage.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- **[MEDIUM] `EventDetailPage.tsx` — der Host sieht Abmeldungen als
  Teilnehmer.** `event_attendees` gibt dem Host jeden Status heraus; die
  Avatarreihe filterte nicht. pgTAP prüft die RPC, die React-Tests fuhren nur
  mit `registered`-Fixtures — der Fehler saß genau dazwischen.
- **[MEDIUM] `EventCoverPicker.tsx` — „Speichern" blieb während des Uploads
  klickbar.** Ein Klick genau dann speichert das Event ohne das gewählte Bild
  und lässt ein Objekt zurück, auf das nie ein Event zeigt.
- **[MEDIUM] `EventDetailPage.tsx` — zwei Signierstapel statt einem.** Header
  und „Ähnliche Events" riefen den Haken je für sich auf; das Spec-Delta sagt
  „one batched signing call per view".
- **[MEDIUM] `probe-event-cover-signatur.ts` — die Sonde misst den falschen
  Endpunkt.** Sie prüfte `createSignedUrl` (Einzahl); die App ruft
  `createSignedUrls` (Mehrzahl), dessen Teilerfolg-Verhalten die Oberfläche
  trägt.

## Resolution

**1 · Statusfilter.** `AttendeeRow` filtert jetzt auf `status === "registered"`.
RED zuerst: ein Fall mit einer Abmeldung und einem Wartelistenplatz in der
RPC-Antwort war rot (`expected document not to contain element, found <a`),
danach grün. Für einen Nicht-Host ist der Filter wirkungslos — ihm liefert die
RPC ohnehin nur Angemeldete —, aber der Host sieht seine Seite genauso oft wie
alle anderen zusammen.

**2 · Upload sperrt das Speichern.** `EventCoverPicker` meldet den Zustand über
`onBusy` nach oben; `canSubmit` nimmt ihn auf, der Knopf beschriftet sich
„Bild lädt…".

**3 · Ein Stapel je Ansicht.** Auswahl der ähnlichen Events und Signaturen
wandern in eine neue Komponente `EventBody`; `EventHeader` und `SimilarEvents`
bekommen beides als Prop.

Dabei kam ein zweiter Aufruf zum Vorschein, den codex nicht genannt hat: die
Pfadmenge **wächst**, sobald die Eventliste eintrifft, also signierte react-query
erst das Header-Cover und gleich darauf alle drei. `useEventCovers` nimmt jetzt
ein `bereit`-Flag, und die Detailseite signiert erst, wenn die Liste steht. Ein
Test hält die Zahl fest — er war mit `2 statt 1` rot, bevor er grün wurde.

**4 · Der Stapel-Endpunkt.** Drei neue Fälle in der Sonde (6b–6d), gemessen:

```
OK  6b. anon · gemischter Stapel (public + members + verwaist):
        öffentlich=URL members=keine verwaist=keine
OK  6c. Ein nicht signierbarer Pfad reißt den Stapel nicht mit: Einträge=3/3
OK  6d. Die URL aus dem Stapel liefert das Bild: Abruf=200
```

6c ist der Fall, auf dem die Oberfläche steht: ein Pfad ohne URL heißt
„Platzhalter zeigen", nicht „Ansicht kaputt". Das war vorher eine Annahme über
fremden Code.

## Danach

```
pnpm lint       0 Fehler
pnpm typecheck  sauber
pnpm test       645 Tests / 93 Dateien   grün   (vor dem Review: 643)
pnpm build      erfolgreich
supabase test db --local   347   grün
Sonde           11 Fälle, alle erfüllt   (vorher: 8)
```
