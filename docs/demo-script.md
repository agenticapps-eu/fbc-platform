# FBC Plattform — Demo-Drehbuch (Phase 1)

> **Für:** Detlev · **Dauer:** ~8–10 Min · **Live-URL:** <https://fbc-platform.pages.dev>
> **Kernbotschaft:** „Qualität vor Reichweite." Rechte und Sichtbarkeit richten sich nach der
> **Mitgliedsstufe** (Discover → Prime → Legacy) und werden **in der Datenbank** erzwungen —
> Kontaktdaten werden **nie automatisch** geteilt.

## Vorbereitung (vor der Demo)

- Drei Tabs/Logins bereitlegen. **Alle Passwörter: `Test1234!`**
  - **Discover:** `discover@fbcdemo.com` → *Jonas Keller* (Gründer, frühe Phase)
  - **Prime:** `prime@fbcdemo.com` → *Carla Reinhardt* (Strategieberaterin, Connectorin)
  - **Legacy:** `legacy@fbcdemo.com` → *Eleonora Voss* (Beteiligungskapital, Deal Keeperin)
- Alle Inhalte sind klar als **DEMO** markiert (fiktive Personas, Mails `…@demo.fbc.invalid`).
- Roter Faden: **derselbe Club aus drei Stufen-Perspektiven** — die Plattform „öffnet" sich
  mit jeder Stufe.

---

## Szene 1 — Discover: „Reinschnuppern, aber Türen sind zu" (≈2 Min)

**Login:** `discover@fbcdemo.com` (Jonas).

1. **Community-Feed** zeigen: öffentliche und Mitglieder-Beiträge, ruhiger LinkedIn-artiger Look,
   Hashtags, ein eingebettetes **Video** (YouTube). Jonas kann lesen und selbst posten.
2. Auf den Tab **Verzeichnis** wechseln → statt der Mitgliederliste erscheint der Hinweis:
   **„Das durchsuchbare Verzeichnis aller Mitglieder ist ab der Stufe Prime verfügbar."**
3. In der URL `/meine-chancen` aufrufen → Discover wird **weggeleitet** (kein Zugriff).
   *Aussage:* „Discover sieht die Bühne, aber nicht das Adressbuch — und das ist keine
   Frontend-Höflichkeit, sondern in der Datenbank gesperrt."

**Übergang:** „Jetzt schalten wir auf **Prime** — und dieselbe App öffnet sich."

---

## Szene 2 — Prime: „Verzeichnis, Matching, der Kontakt-Moment" (≈4 Min)

**Login:** `prime@fbcdemo.com` (Carla).

1. **Verzeichnis** (`/verzeichnis`): 18 Mitglieder, **Filter** nach Thema, Branche, Region,
   Kompetenz und Sucht/Bietet. Kurz einen Filter setzen (z. B. Branche „Immobilien").
2. **Meine Chancen** (`/meine-chancen`): Top-Matches mit **Prozent-Score** (z. B. 93 %), Spalten
   **BIETET ⇄ SUCHT**, und „Warum dieses Match?" mit nachvollziehbarer Begründung. Betonen:
   **die Bedürfnisse stehen im Vordergrund, nicht der Name.**
3. **Der Kontakt-Moment** (Herzstück):
   - Ein Profil öffnen, mit dem Carla **noch nicht** verbunden ist (z. B. **Hans-Peter Stadler**).
     Unter „Kontakt": **keine** Mail/Telefon, nur „Erst nach Annahme werden Kontaktdaten geteilt"
     und der Button **Kontaktanfrage senden**.
   - Dann das Profil von **Eleonora Voss** öffnen — mit ihr ist Carla **bereits verbunden**
     (Anfrage angenommen): jetzt steht da **„Kontakt freigegeben · Angenommen"** mit **E-Mail und
     Telefon** als klickbare Links.
   - *Aussage:* „Genau hier passiert das Versprechen der Plattform: **Kontaktdaten erscheinen erst
     nach beidseitiger Bestätigung** — vorher gibt es nichts, auch nicht über Umwege."
4. Kurz **Events** (`/events`) zeigen: kommende Veranstaltungen (Webinar, Workshop, Mastermind,
   Dinner) mit Typ, Restplätzen und **Anmelden**; Carla ist Host eines Webinars.
5. **Mein Bereich** (`/mein-bereich`): Dashboard mit **Matches, bestätigten Kontakten, gebuchten/
   eigenen Events** und **Impact-Score** (rule-based, mit Aufschlüsselung).

**Übergang:** „Und die oberste Stufe **Legacy** sieht noch eine Ebene mehr."

---

## Szene 3 — Legacy: „Die strategische Ebene" (≈2 Min)

**Login:** `legacy@fbcdemo.com` (Eleonora).

1. **Community-Feed** zeigen: hier erscheint zusätzlich der **„Legacy"-Beitrag**, den Discover
   und Prime **nicht** sehen. (Optional: kurz erwähnen, dass es auch ein **Legacy-Event** gibt,
   das nur dieser Stufe angezeigt wird.)
2. *Aussage:* „Die obersten Inhalte sind ausschließlich Legacy vorbehalten — wieder
   **datenbankseitig** erzwungen. Dieselbe Plattform, drei Sichtbarkeitshorizonte."

---

## Abschluss (≈1 Min)

- **Drei Stufen, eine Plattform:** Discover schnuppert, Prime vernetzt & matcht, Legacy sieht die
  strategische Ebene.
- **Vertrauensversprechen:** Sichtbarkeit & Kontaktfreigabe sind **in der DB (RLS)** verankert —
  nicht im Frontend „nett gemacht".
- **Ausblick Phase 2:** Stripe/Bezahlung, voller Onboarding-Ausbau, Academy/Library mit echten
  Inhalten, DSGVO-Paket, Odoo-Migration. (Details: `docs/w4-acceptance.md` → Phase-2-Notizen.)

> **Reset bei Bedarf:** Die Demo-Welt ist idempotent neu aufsetzbar mit
> `DEMO_SEED_CONFIRM=fbc-demo DEMO_SEED_TLS_INSECURE=1 pnpm demo:reset` bzw. `pnpm demo:seed`.
