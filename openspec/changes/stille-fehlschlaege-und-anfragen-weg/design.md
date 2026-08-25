# Design — Stille Fehlschläge und der Weg zu Anfragen (AGE-591/592/593)

## Context

Drei Stellen, ein Muster: die Oberfläche hat einen Zustand, für den **kein Zweig
etwas sagt**, und dieser Zustand sieht aus wie Erfolg oder wie Leere.

- `LoginPage.onSubmit` kennt zwei Ausgänge: Fehler → Meldung, Erfolg → die neue
  Sitzung löst die Seite ab. Es gibt einen dritten — **kein Fehler, keine
  Sitzung** —, und der ist stumm.
- `MeineAnfragenWidget` fasst `isError` mit `data.length === 0` in **eine**
  Bedingung, die `null` liefert.
- `/kontakte` trägt `section: "sub"`, und `SIDEBAR_SECTIONS` rendert nur
  `entdecken` und `mein-bereich` — die Fläche existiert, hat aber keinen Weg.

## Goals / Non-Goals

**Goals:** Jeder der drei Zustände wird sichtbar. Der Zähler benutzt dieselbe
Abfrage wie das Widget.

**Non-Goals:**

- Keine Benachrichtigungsfläche, kein Glocken-Menü. Das wäre ein neues Konzept
  für ein Problem, das ein Menüeintrag löst.
- Kein Zähler an anderen Einträgen. Nur dort, wo etwas auf eine Entscheidung
  wartet.
- Keine Änderung an GoTrues Aufzählungsschutz. Der 200er ohne Sitzung ist
  richtig; nur die Oberfläche schweigt zu Unrecht.
- Kein Widerruf, keine Änderung an der Freigabelogik.

## Decisions

### 1. Der Zähler liest den Cache des Widgets, nicht eine zweite Abfrage

`AppShell` ruft `fetchIncomingRequests` unter **demselben** `queryKey` auf wie
`MeineAnfragenWidget` (`incomingRequestsQueryKey(uid)`). React Query teilt den
Eintrag, es entsteht **eine** Anfrage, und beide Flächen können nicht
auseinanderlaufen.

**Verworfen: eine schlanke `count`-RPC.** Sie wäre die zweite Wahrheit über
denselben Bestand — genau das Muster, das in diesem Repo schon einmal dazu
führte, dass eine Zahl und eine Liste verschiedene Dinge behaupteten. Die Liste
ist kurz (offene Anfragen an EIN Mitglied); ihre Länge ist der Zähler.

`enabled: !!uid` — ohne Kennung wird gar nicht erst gefragt.

### 2. Der Zähler sitzt am Eintrag, nicht an der Seite

`SidebarNavItem` bekommt ein optionales `zaehler?: number`. Fehlt es oder ist es
`0`, erscheint **nichts** — eine Null ist keine Aufforderung, und ein Zähler, der
dauernd Null zeigt, wird nicht mehr gelesen (so schon bei den Reiter-Zählern in
AGE-587 entschieden).

**Auch in der eingeklappten Leiste sichtbar.** Dort trägt das Icon allein; der
Zähler sitzt als kleines Abzeichen darüber. Ihn eingeklappt wegzulassen wäre
bequem und falsch: wer die Leiste einklappt, verliert sonst genau das Signal, für
das dieser Change existiert.

### 3. `signUp` reicht die Sitzung durch, statt sie zu verschweigen

`AuthProvider.signUp` gibt heute nur `{ error }` zurück. Es bekommt
`{ error, hatSession: boolean }` — abgeleitet aus `data.session`.

**Kein `data.session` nach außen.** Der Aufrufer braucht die Antwort auf „gibt es
eine Sitzung?", nicht das Sitzungsobjekt; ein Sitzungsobjekt in der Seite wäre
eine zweite Quelle neben dem Auth-Zuhörer.

Die Meldung ist **für beide Fälle dieselbe** — vergebene wie unbekannte Adresse.
Andernfalls baut die Oberfläche den Aufzählungsschutz wieder ab, den der
Anmeldedienst gerade aufgebaut hat.

### 4. `isError` bekommt einen eigenen Zweig, leer bleibt still

Das Widget rendert im Fehlerfall eine Karte mit Hinweis; `data.length === 0`
liefert weiter `null`. Vorbild ist die Tag-Zähler-Spalte im Feed, die genau
dafür schon einen eigenen Fehlerzustand trägt.

## Risks / Trade-offs

- **Der Zähler lädt die Liste, auch wenn niemand `/kontakte` öffnet.** → Eine
  kurze Abfrage je Sitzung, geteilt über den Cache. Der Preis ist eine Anfrage;
  der Gegenwert ist das einzige Signal, das es gibt.
- **Der Menüeintrag widerspricht scheinbar AGE-494.** → Er kommt für den Fall
  zurück, den jene Entscheidung nicht traf (offene eingehende Anfrage, ohne
  Chat). Steht so im Proposal und gehört in den Migrationskopf des Commits.
- **Ein neutraler Hinweis nach der Registrierung ist weniger hilfreich als die
  Wahrheit.** → Bewusst: der Aufzählungsschutz ist die wichtigere Zusage. Der
  Hinweis führt zu beiden Wegen, damit er trotzdem trägt.

## Migration Plan

Keine Migration, kein Deploy-Sonderweg. Rücknahme: der Commit zurück.

## Open Questions

Keine.
