# Aufgaben — Admin-Mitgliederliste (AGE-566)

> **TDD, rot vor grün** — aber nur, wo es rot werden *kann*. Zwei Prüfungen hier
> beschreiben bestehendes Verhalten und starten grün; sie sind als
> **Regressionstest** gekennzeichnet, nicht als RED. Das eine als das andere
> auszugeben hiesse, eine Zusicherung zu behaupten, die nie gemessen wurde.
>
> Fallen, die dieses Projekt schon gestellt hat: in pgTAP heisst es `alike()`,
> nicht `like()`; `try_as()` meldet **jeden** Fehler als DENIED, ein Test muss
> also den Fehlercode prüfen; Rechte werden nicht vererbt.
>
> Überarbeitet nach dem Plan-Review (`REVIEWS.md`, zwei Prüfer, beide
> REQUEST-CHANGES). Die Aufgaben 1, 3, 4 und 5 sehen deshalb anders aus als in
> der ersten Fassung.

## 1. Doppelspurigkeit mit `add-admin-console` auflösen — zuerst, nicht zuletzt

- [x] 1.1 In `add-admin-console/specs/admin/spec.md` die Anforderung
      „Admin member list with filters (no contact PII)" entfernen — sie ist hier
      spezifiziert, und zwar mit `login_email`, was jener Anforderung
      widerspricht.
- [x] 1.2 Das `## REMOVED Requirements` auf „Admin member management is not
      implemented" dort **stehen lassen**. Dieser Change fasst die Anforderung
      mit `MODIFIED` neu; sie besteht danach unter demselben Titel weiter und
      verbietet Massen-Mail, CRM und Newsletter. Nähme man das `REMOVED` heraus,
      verböte die dauerhafte Wahrheit später genau das, was `add-admin-console`
      baut. (Befund codex HIGH-1 — die erste Fassung dieser Aufgabe hatte es
      löschen wollen.)
- [x] 1.3 In `add-admin-console` festschreiben, dass es **nach** AGE-566
      archiviert wird, und die Mitgliederlisten-Aufgaben aus dessen `tasks.md`
      entfernen. In umgekehrter Reihenfolge kollidieren die Delta-Operationen.
- [x] 1.4 `add-admin-console/proposal.md` kürzen, mit einem Satz, wohin die
      Mitgliederliste gegangen ist (AGE-566).
- [x] 1.5 `openspec validate --all` grün. **Beleg:** beide Changes einzeln in der
      Prüfliste, nicht nur die Gesamtzahl — die ist ein schlechter Zeuge, wenn
      auf verschiedenen Branches verschiedene Changes liegen.

## 2. `admin_list_members` — Test zuerst

- [x] 2.1 pgTAP: ein Nicht-Admin bekommt beim **argumentlosen** Aufruf `42501`.
      Fehlercode prüfen, nicht nur „schlägt fehl" — und dieser Test fängt
      zugleich fehlende Vorgabewerte ab, die als „function does not exist"
      erschienen (Befund codex MEDIUM-1). RED.
- [x] 2.2 pgTAP: ein Profil mit `activated_at is null` **ist** in der Rückgabe
      und trägt `bestaetigt = false`. RED.
- [x] 2.3 pgTAP: `p_status` — `offen` liefert genau die unbestätigten,
      `aktiviert` genau die bestätigten, `alle` und `null` alle, ein unbekannter
      Wert bricht mit `22023` ab. RED. (Ohne diese Prüfung erfüllte eine
      Umsetzung, die `p_status` ignoriert, jedes andere Szenario — Befund
      codex HIGH-3.)
- [x] 2.4 pgTAP: `p_query` findet über `name` **und** über `login_email`,
      unabhängig von Gross-/Kleinschreibung; leer und `null` filtern nicht. RED.
- [x] 2.5 pgTAP: keine Spalte aus `profile_contacts`. Gegen die **Spaltenliste**
      prüfen, nicht gegen einen Beispieldatensatz. RED.
- [x] 2.6 pgTAP: `p_limit = 2, p_offset = 2` über fünf Mitglieder — darunter zwei
      gleichnamige und eines ohne Namen — liefert die Nummern drei und vier, und
      zwei Aufrufe liefern dasselbe. Ohne den `id`-Stichentscheid ist das nicht
      erfüllbar. RED.
- [x] 2.7 pgTAP: Suchbegriff `%` liefert nicht die gesamte Mitgliedschaft. RED.
- [x] 2.8 Migration: `admin_list_members(p_query text default null, p_status text
      default null, p_limit int default 50, p_offset int default 0)`,
      `security definer`, `set search_path = ''`, `is_admin()` zuerst.
      Sortierung: **unbestätigte zuerst, dann `name`, dann `id`** — im
      Migrationskopf begründen, samt der Folge, dass eine Aktivierung eine Zeile
      zwischen den Seiten wandern lässt. GREEN für 2.1–2.7.
- [x] 2.9 Rechte aussprechen: `revoke execute … from public, anon`,
      `grant execute … to authenticated` (AGE-312), mit Test.

## 3. Parität — Spalten **und** Inhalt

- [x] 3.1 Test über die Spaltenliste beider Funktionen. Er muss die
      **abweichende Spalte benennen**, nicht nur „ungleich" melden. Die Zahl der
      Spalten wird dabei **nicht** festgeschrieben: `search_directory` hat heute
      vierzehn, und eine Zahl im Test ist beim nächsten Feld wieder falsch
      (Befund codex LOW-1).
- [x] 3.2 Test über den **Inhalt**: für ein bestätigtes Mitglied liefern beide
      Funktionen dieselben Werte in den Verzeichnisspalten. Das fasst eine
      Abweichung, die die Spaltennamen unberührt lässt (Befund gemini HIGH).
- [x] 3.3 Gegenprobe: je eine Spalte umbenennen und einen Wert verbiegen, und
      belegen, dass 3.1 und 3.2 rot werden. Ohne diese Probe ist unbelegt, dass
      sie überhaupt etwas prüfen.

## 4. `admin_activate_member` — mit Spur, in einer Transaktion

- [x] 4.1 pgTAP: ein Nicht-Admin bekommt `42501`, `activated_at` bleibt
      unverändert, und es entsteht **keine** `admin_audit`-Zeile. RED.
- [x] 4.2 pgTAP: ein Admin aktiviert, und es entsteht eine `admin_audit`-Zeile
      mit handelndem Konto, Zielkonto und Art der Änderung. RED. Das erfüllt die
      bestehende Anforderung „Privilegierte Änderungen hinterlassen eine Spur"
      (`openspec/specs/admin/spec.md:360`), die verlangt, dass die Spur **mit**
      der Fähigkeit entsteht (Befund codex HIGH-2 / gemini MEDIUM).
- [x] 4.3 pgTAP: schlägt das Schreiben nach `admin_audit` fehl, bleibt
      `activated_at` ungesetzt. RED — belegt die eine Transaktion.
- [x] 4.4 pgTAP: ein zweiter Aufruf auf ein bereits bestätigtes Profil bricht mit
      `22023` ab und erzeugt keine zweite Protokollzeile. RED.
- [x] 4.5 **Regressionstest** (startet grün, kein RED): `mark_activated` gelingt
      weiterhin ohne Admin-Rolle. Er sichert, dass 4.6 den Einlöseweg von
      `redeem-activation` nicht bricht.
- [x] 4.6 Migration: `admin_activate_member(target uuid)`. GREEN für 4.1–4.4,
      4.5 bleibt grün.
- [x] 4.7 Rechte aussprechen wie in 2.9.

## 5. Die Fläche

- [x] 5.1 Route `/admin/mitglieder` unter dem vorhandenen `RequireAdmin`;
      Sidebar-Eintrag für Admins.
- [x] 5.2 Datenzugriff in `src/lib/` neben den vorhandenen Admin-Aufrufen, mit
      Paging-Zustand. Kein Nachladen aller Seiten im Hintergrund. Erzeugte
      Datenbank-Typen mitziehen.
- [x] 5.3 **`MemberCard` aus `MemberDirectory.tsx:360` exportieren und ein Ziel
      als Prop annehmen.** Die Karte ist heute privat und verdrahtet
      `` to={`/p/${member.id}`} `` fest — „nichts Mitgliedersichtbares wird
      angefasst" war im ersten Entwurf falsch (Befund codex MEDIUM-4).
- [x] 5.4 **Regressionstest** (startet grün): das Mitgliederverzeichnis verweist
      weiter auf `/p/:id`. Er sichert 5.3 ab — ein unachtsamer Umbau lenkte sonst
      das öffentliche Verzeichnis in den Admin-Bereich.
- [x] 5.5 Umschalter Tabelle | Karten | Verzeichnis. Test: „nicht aktiviert" ist
      in **allen drei** sichtbar.
- [x] 5.6 Verzeichnis-Ansicht speist die exportierte Karte mit Ziel
      `/admin/mitglied/:id`. Test darauf.
- [x] 5.7 Blätterung sichtbar und benutzt. Test: Seite 2 zeigt andere Mitglieder
      als Seite 1. Statusfilter und Suchfeld angebunden.
- [x] 5.8 „Zugangslink schicken" ruft `send-activation`. Test: bei 202 spricht
      die Rückmeldung von **angefordert**, nicht von verschickt.
- [x] 5.9 Test: bei 500 und 502 zeigt die Fläche einen **Fehler** und keine
      Bestätigung. `send-activation` antwortet nicht immer 202 — auch 405, 400,
      500 und 502 (Befund codex MEDIUM-2; die erste Fassung behauptete das
      Gegenteil).
- [x] 5.10 „Direkt aktivieren" mit **namentlicher Rückfrage**, die die Folge
      benennt. Nur an unbestätigten Zeilen. Tests: Rückfrage erscheint, Abbrechen
      ändert nichts, an einer bestätigten Zeile wird der Knopf nicht angeboten.
      Die Handlung ist durch die Anwendung nicht umkehrbar (Befund codex HIGH-4).
- [x] 5.11 Nach erfolgreicher Aktivierung die Liste neu laden, damit der Zustand
      nicht veraltet stehenbleibt.
- [x] 5.12 **Regressionstest** (startet grün): es besteht keine Handlung, die ein
      Passwort für ein fremdes Konto setzt.

## 6. Prüfen

- [x] 6.1 `pnpm test`, `pnpm typecheck`, `pnpm lint` grün. `supabase test db`
      **mit Dateiliste** aufrufen — ohne sie meldet der Befehl FAIL, obwohl die
      pgTAP-Dateien grün sind.
- [x] 6.2 **Sichtprobe im Browser**, nicht nur jsdom: alle drei Sichten, ein
      unbestätigtes Mitglied, beide Handlungen samt Rückfrage, die Blätterung.
      In diesem Projekt sind mehrere Befunde ausschliesslich im echten Browser
      aufgefallen, während die Tests grün waren.
> **6.3 gemessen am 17.08. auf PROD** (Migration von Donald im Terminal
> angewendet, `db:push:prod` verlangt ein TTY). Beide Funktionen dort vorhanden,
> `authenticated` ja, `anon` nein, `SECURITY DEFINER` ja. Derselbe Admin, derselbe
> Moment, drei Lesepfade:
>
> | Lesepfad | sichtbare Mitglieder |
> |---|---|
> | `admin_list_members` | **71** — davon **69 unbestätigt**, 2 bestätigt |
> | `search_directory` | 2 |
> | `profiles_public` | 2 |
>
> `p_status = 'offen'` liefert genau 69, die erste Seite genau 25. Keine
> Personendaten in den Beleg übernommen.
>
> **Nebenbefund, der eine Annahme umdreht:** alle 71 Konten tragen einen
> bcrypt-Hash (60 Zeichen) — GoTrue schreibt beim Anlegen ohne Passwort trotzdem
> einen, und der Import hat `user_pass` bewusst nicht mitgenommen. **Angemeldet
> hat sich bisher 2×**, das sind die beiden Admins. Den Hash der 69 kennt
> niemand. Daraus folgt: „Direkt aktivieren" macht ein Profil nur SICHTBAR und
> verschafft keinen Zugang; der Zugangslink ist der einzige Weg hinein, weil das
> Mitglied sich beim Einlösen sein Passwort selbst setzt. Die beiden Handlungen
> sind keine Alternativen füreinander.

- [x] 6.3 Am echten Bestand messen: die Liste zeigt die importierten Mitglieder,
      die über jeden anderen Weg unsichtbar sind. Das ist der Anlass des Changes
      und die einzige Messung, die ihn belegt. **Keine Personendaten in die
      Belege übernehmen** — Zahlen und Zustände, keine Namen.
- [x] 6.4 Diff-Review durch einen Prüfer eines anderen Herstellers; Befunde
      beheben oder begründet ablehnen. **Zwei fremde Prüfer, beide Ausgang 0:
      gemini APPROVE ohne Befund, codex REQUEST-CHANGES mit vier.** Alle vier
      nachgeprüft und zutreffend, zwei davon gemessen (Wettlauf: zwei
      Auditzeilen für eine Aktivierung; `p_limit = null`: 74 statt 50 Zeilen).
      Dazu zwei Befunde aus der eigenen Durchsicht — die fehlende Entprellung
      und die in CI **nicht eingetragene** pgTAP-Datei. Alle sechs übernommen,
      keiner abgelehnt; Belege in REVIEWS.md.

## 7. Abschluss

- [ ] 7.1 `openspec validate --all` grün, Arbeitsbaum sauber, Feature-Branch.
- [ ] 7.2 `openspec archive` — erst wenn 6.3 gemessen ist, nicht wenn der Code
      existiert. **Vor** `add-admin-console`.
- [ ] 7.3 AGE-566 in Linear auf Done — vorher `get_issue` lesen; die Automation
      schaltet den Status bei PR-Merge womöglich schon selbst.
