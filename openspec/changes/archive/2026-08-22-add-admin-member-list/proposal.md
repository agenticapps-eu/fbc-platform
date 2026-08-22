## Why

Linear: **AGE-566**.

Der WordPress-Import (AGE-534) hat 70 Mitglieder nach PROD gebracht, die niemand
**listen** kann. `admin_find_profile` findet einzeln und verlangt drei Zeichen
Suchbegriff; seine Jokerzeichen-Entschärfung ist ausdrücklich dafür gebaut, „die
Mitgliederliste durch die Hintertuer" zu verhindern. Das war richtig, solange es
keine Liste geben sollte. Für die Frage, die jetzt täglich ansteht — **wer wartet
noch auf Aktivierung?** — ist es das falsche Werkzeug: man muss den Namen schon
kennen, um jemanden zu finden.

Dazu kommt eine Sperre, die den Import unsichtbar macht: `activated_at` ist der
Schalter für die Verzeichnis-Sichtbarkeit, und alle importierten Profile tragen
dort `null`. Sie sind damit für **niemanden** sichtbar, auch nicht für Admins —
die Stichprobe „sehen die 70 Profile brauchbar aus?", die AGE-534s Abnahme
verlangt, lässt sich ohne diese Fläche gar nicht durchführen.

## What Changes

- **Neue Funktion `admin_list_members(p_query, p_status, p_limit, p_offset)`** —
  `security definer`, `search_path = ''`, `is_admin()` als erste Anweisung, alle
  vier Parameter mit Vorgabewert. Liefert die Verzeichnisspalten von
  `search_directory` plus `login_email`, `bestaetigt` und `member_since`.
  Unbestätigte Profile **sind** enthalten.
- **Neue Funktion `admin_activate_member(target uuid)`** — admin-gesicherte Hülle
  **neben** `mark_activated`, die in **derselben Transaktion** nach
  `public.admin_audit` schreibt. Die vorhandene Funktion bleibt unangetastet: sie
  ist für die Edge Function mit `service_role` gebaut und prüft `is_admin()`
  bewusst nicht.
- **Neue Route `/admin/mitglieder`** mit drei oben umschaltbaren Sichten —
  Tabelle, Admin-Karten, Verzeichnis-Ansicht — und zwei Handlungen je Eintrag:
  „Zugangslink schicken" und „direkt aktivieren", letzteres hinter einer
  namentlichen Rückfrage, weil es durch die Anwendung nicht umkehrbar ist.
- **`MemberCard` wird exportiert und bekommt ihr Ziel als Prop.** Sie ist heute
  privat und verdrahtet `/p/:id` fest; ohne diesen Schritt ist die
  Verzeichnis-Ansicht ein Nachbau statt einer Wiederverwendung.
- **Kein admin-gesetztes Passwort.** „Zugangslink schicken" ruft die vorhandene
  Kette `send-activation` → `issue_activation_token`; das Mitglied setzt selbst.
- **Keine Kontaktdaten in der Liste.** `login_email` ja, `profile_contacts` nein.
- **`add-admin-console` wird entflochten** (siehe Impact): es entfernt heute
  dieselbe Anforderung und spezifiziert dieselbe Liste ein zweites Mal.

## Capabilities

### New Capabilities
<!-- keine — die Fähigkeit `admin` besteht bereits -->

### Modified Capabilities
- `admin`: Die Anforderung „Admin member management is not implemented" gilt so
  nicht mehr — eine Mitgliederliste entsteht. Massen-Mail, CRM und
  Themen-Newsletter bleiben weiterhin ausgeschlossen und wandern in die
  neugefasste Anforderung. Dazu vier neue Anforderungen: die Listenfunktion, die
  admin-gesicherte Aktivierung **samt Protokolleintrag**, der Zugangslink für ein
  fremdes Konto, und die Fläche mit ihren drei Sichten.

Die bestehende Anforderung „Privilegierte Änderungen hinterlassen eine Spur"
wird **nicht** geändert — sie gilt unverändert, und dieser Change erfüllt sie für
eine neue Handlung. Dass sie auch für das Aktivieren gilt, hat erst der
Plan-Review gezeigt; die erste Fassung dieses Changes hätte gegen sie verstossen.

## Impact

- **Betroffene Fähigkeit:** `admin`.
- **Datenbank:** eine Migration mit zwei neuen Funktionen. Kein Schema-Eingriff,
  keine Policy-Änderung, keine bestehende Funktion angefasst.
- **Frontend:** neue Route unter dem vorhandenen `RequireAdmin`; die
  Verzeichniskarte wird wiederverwendet, nicht nachgebaut.
- **Kollision mit `add-admin-console` (0/16 umgesetzt):** jener Change führt ein
  eigenes „Admin member list with filters (no contact PII)", das dieser hier
  zweitspezifizierte — und das ihm zudem widerspricht, weil `login_email`
  mitkommt. Diese Anforderung gibt `add-admin-console` ab; sein `REMOVED` auf
  „Admin member management is not implemented" **bleibt** dagegen stehen, weil
  dieser Change die Anforderung mit `MODIFIED` neu fasst und sie danach unter
  demselben Titel weiterbesteht. Archiviert wird AGE-566 **zuerst**.
- **Mitgliedersichtbarer Code:** `MemberCard` in
  `src/components/community/MemberDirectory.tsx` wird exportiert und
  parametrisiert. Das ist der einzige Eingriff dort, und er ist zuzusichern statt
  anzunehmen — ein Regressionstest belegt, dass das Verzeichnis weiter auf
  `/p/:id` verweist.
- **Nicht betroffen:** `search_directory`, `profiles_public`, die
  `profiles`-Policy, `mark_activated`. Der neue Lesepfad liegt daneben, statt
  einen mitgliedersichtbaren Weg zu lockern.
