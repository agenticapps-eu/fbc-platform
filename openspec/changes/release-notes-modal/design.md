# Design

## Drei Entscheidungen, und je eine verworfene Alternative

### 1. Die Bilder hängen am Change, nicht an der Note

**Verworfen:** eine Spalte `image_urls` auf `release_notes`, gefüllt über einen
Upload in der Admin-Fläche.

Das kostete eine Migration, einen Bucket, zwei Policies und eine
Upload-Behandlung — für Bilder, die ohnehin zu einer *ausgelieferten* Änderung
gehören und sich nie wieder ändern. Es öffnete ausserdem einen zweiten
schreibenden Weg auf Storage, wo die Anwendung schon einen hat (`covers`), samt
der `upsert`-Falle, die dort gilt.

Vor allem aber bricht es die Konstruktion, die AGE-631 trägt: **was im Bündel
steht, ist ausgeliefert.** Ein Bild in der Datenbank kann eine Fläche zeigen,
die es im ausgelieferten Stand gar nicht gibt. Ein Bild im Bündel kann das
nicht.

Der Preis, offen benannt: neue Bilder brauchen einen Deploy. Für Screenshots
ausgelieferter Änderungen ist das keine Einschränkung — der Deploy ist ihre
Voraussetzung.

### 2. Modal, nicht Detailseite

**Verworfen:** eine Route `/neues/:id`.

Die Liste ist kurz und der Text ist kurz; ein Routenwechsel für zwei Absätze
verliert die Position in der Liste und braucht einen Rückweg, den das Modal
umsonst mitbringt. Ausserdem hat das Haus für zentrierte Overlays bereits ein
Muster (`useOverlay` aus AGE-529, vier Anschlüsse) — eine fünfte Fläche daran
kostet nichts, eine Detailroute wäre ein eigener Zustand.

**Die Falle steht in der Spec, weil sie hier schon zugeschlagen hat:** ein
`fixed`-Overlay innerhalb der Kartenliste hängt in dieser Anwendung *nicht* am
Viewport. `.fbc-card:hover` trägt ein `transform` und der Seitenkopf ein
`backdrop-filter`; beide erzeugen einen Bezugsrahmen. jsdom sieht davon nichts,
also gehört die Zusage in den Test als Prüfung auf den **Portal-Knoten**, nicht
auf die Optik.

### 3. Der offene Zustand steht in der Adresse

**Verworfen:** `useState` in `NeuesPage`.

Die Glocke muss eine bestimmte Note öffnen können — sie verlinkt heute nur die
Fläche, und genau das ist der Mangel. Ein Suchparameter `?note=<id>` löst beides
zugleich: die Glocke bekommt ihr Ziel, und die Zurück-Taste schliesst das Modal,
statt die Seite zu verlassen.
