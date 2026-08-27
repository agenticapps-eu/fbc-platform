# Angedockte Chatfenster unten: mehrere Gespräche gleichzeitig, minimierbar

Linear: **AGE-639**

## Why

Ein Klick auf ein Gespräch in der stehenden Nachrichten-Leiste **verlässt die
Seite**. Gemessen am 27.08. in `src/components/AppShell.tsx:543`:

```ts
function chatOeffnen(threadId: string) {
  setChatDrawerOpen(false);
  navigate(`/chat/${threadId}`);
}
```

Und die Leiste kann konstruktiv nie ein aktives Gespräch zeigen: beide
Montagepunkte von `ChatPanel` übergeben fest `activeId={null}`
(`AppShell.tsx:713` und `:910`).

Damit ist die Leiste ein **Wegweiser, kein Arbeitsplatz**. Wer aus dem
Verzeichnis heraus jemandem antworten will, verliert dabei das Verzeichnis. Wer
zwei Gespräche parallel führt — der Normalfall in jedem Messenger —, wechselt
zwischen zwei Adressen hin und her, und jeder Wechsel wirft den Zustand der
Seite weg, auf der er gerade war.

Donald am 27.08.:

> Messenger-Stil: mehrere Gespräche gleichzeitig unten offen, jedes einzeln
> minimierbar und schliessbar. Ein Klick in der rechten Nachrichten-Leiste
> öffnet ein Fenster, statt wegzunavigieren; das Fenster überlebt den
> Seitenwechsel.

## Zwei bestehende Zusagen stehen dagegen — beide werden ausdrücklich geändert

Sie stillschweigend zu brechen wäre der Fehler. Beide werden in diesem Change
umformuliert, nicht umgangen:

1. **`messaging/spec.md:268`** — „Selecting a thread on the standing surface
   SHALL open that conversation at its existing deep link, so that one address
   names one conversation however it was reached."
   → wird zu: **ein Gespräch hat genau eine Adresse**, aber nicht jede Öffnung
   geht über sie. Die Adresse benennt einen **Ort** (`/chat/:threadId`, die
   Vollansicht); das Fenster ist ein **Werkzeug** auf der Seite, auf der man
   ohnehin steht. Der Weg aus Hinweisen, E-Mails und geteilten Links bleibt
   unverändert die Adresse.

2. **`design-system/spec.md:243` und `:262`** — die angedockten Leisten sind
   „an application, not a card floating on it" und „never rounded or floating".
   → Diese Doktrin gilt weiterhin **für die Leisten**, und die Abgrenzung wird
   ausgesprochen: sie ist eine Aussage über die **Kanten des Rahmens**, nicht
   über jedes Element darin. Der Rahmen ist der Rahmen; ein Chatfenster ist
   Werkzeug **im** Rahmen, so wie es Overlays, Toasts und das Profilmenü schon
   heute sind. Was die Doktrin ausschliesst, ist eine **Leiste**, die als Karte
   schwebt — nicht jedes Element, das über dem Inhalt liegt.

## What Changes

- **Ein Klick in der stehenden Leiste öffnet ein Fenster** statt zu
  navigieren — ab `xl`, also genau dort, wo die Leiste angedockt steht.
  Darunter (Schublade, Telefon) bleibt es beim heutigen Weg: die Adresse.
- **Höchstens drei Fenster**, unten rechts aufgereiht, **zwischen beiden
  Leisten**. Jedes bis zu 18 rem breit; wird es eng, teilen sich alle drei den
  Platz, statt dass eines angeschnitten wird. Ein viertes Gespräch schliesst das
  am längsten unberührte — es ist damit nicht verloren, sondern steht
  unverändert in der Leiste daneben.
- **Jedes Fenster minimiert und schliesst einzeln.** Minimiert bleibt seine
  Titelzeile stehen: Avatar, Name, Ungelesen-Zähler, beide Schalter.
- **Die Fenster überleben den Seitenwechsel und das Neuladen.** Offene Threads
  und ihr Minimiert-Zustand liegen gerätelokal, wie `fbc.sidebarCollapsed` und
  `fbc.chatCollapsed` es schon tun.
- **Ein aufgezogenes Fenster rückt den Lesestand vor**, genau wie die
  Vollansicht. Ein minimiertes nicht — es ist nicht gelesen worden.
- **Ein Realtime-Kanal, nicht N.** Das bestehende `subscribeToAllMessages`-Abo
  in der Hülle bedient die Fenster mit; kein Fenster öffnet einen eigenen Kanal.
- **`/chat` und `/chat/:threadId` bleiben unverändert** — Vollansicht,
  Deep-Link, und der einzige Weg unterhalb von `xl`. Auf diesen Routen steht
  die Fensterreihe nicht, aus demselben Grund, aus dem die Leiste dort nicht
  steht.
- **Die Toasts weichen der Fensterreihe nach oben aus**, über dieselbe geteilte
  CSS-Variable, mit der der Rahmen schon heute seine Leistenbreite verteilt.

## Was ausdrücklich NICHT dazugehört

- **Kein Ziehen, kein Verschieben, keine freie Grösse.** Die Fenster sitzen in
  einer Reihe. Ein zweiter Freiheitsgrad wäre ein eigener Vorgang.
- **Kein Fenster unterhalb von `xl`.** Der Umbruchpunkt ist derselbe wie der
  der Leiste, und der ist gemessen (AGE-627): bei 1024 px brachen im
  Verzeichnis Namen auf ein Zeichen.
- **Kein Öffnen aus dem Profil oder aus einem Hinweis heraus.** Der einzige
  Einstieg in dieser Runde ist die stehende Leiste. Jeder weitere Einstieg ist
  eine eigene Entscheidung über den Ort, an dem er steht.
- **Keine Änderung an der Ungelesen-Zählung, an der RLS, am Schema.** Dieser
  Change ist reine Oberfläche und Zustand im Browser; er fasst keine Migration
  an und keine Policy.
- **Keine Markierung offener Gespräche in der Threadliste.** `ThreadList` trägt
  genau ein `activeId`; drei offene Fenster brauchten eine Menge. Das ist ein
  Folgevorgang, kein Nebeneffekt dieser Zeile.

## Berichtigung am Issue

Der Kollisionstisch in AGE-639 nennt `FeedbackButton.tsx:141` als schwebenden
Nachbarn unten rechts. Gemessen: das ist das **modale** Feedback-Panel, mit
Scrim, Portal und `z-50` — der Auslöser sitzt seit AGE-566 im Fuss der
Seitenleiste und schwebt gar nicht. Dauerhafte Nachbarn in dieser Ecke sind nur
**Toast** (`ui/Toast.tsx:37`, `bottom-6 right-6 z-50`) und der
**DesignSwitcher** (`bottom-4 right-4 z-[60]`, temporäres Prüfwerkzeug aus
AGE-237/440). Das Umgebungs-Banner steht mittig (`left-1/2`) und trifft die
Reihe nicht.
