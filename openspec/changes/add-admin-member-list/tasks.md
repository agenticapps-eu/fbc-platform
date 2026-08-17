# Aufgaben — Admin-Mitgliederliste (AGE-566)

> **TDD, rot vor grün.** Jede Aufgabe mit einer Zusicherung beginnt mit dem Test,
> der ohne den Code fehlschlägt. Fallen, die dieses Projekt schon gestellt hat:
> in pgTAP heisst es `alike()`, nicht `like()`; `try_as()` meldet **jeden**
> Fehler als DENIED, ein Test muss also den Fehlercode prüfen; Rechte werden
> nicht vererbt.

## 1. Konflikt mit `add-admin-console` auflösen — zuerst, nicht zuletzt

- [ ] 1.1 In `openspec/changes/add-admin-console/specs/admin/spec.md` das
      `## REMOVED Requirements` auf „Admin member management is not implemented"
      entfernen. Dieser Change fasst die Anforderung neu, statt sie zu löschen;
      zwei Operationen auf derselben Anforderung sperren später das Archivieren.
- [ ] 1.2 Ebendort die Anforderung „Admin member list with filters (no contact
      PII)" entfernen — sie ist hier spezifiziert. Massen-Mail, CRM und
      Newsletter bleiben dort.
- [ ] 1.3 `add-admin-console/proposal.md` entsprechend kürzen und einen Satz
      aufnehmen, der sagt, wohin die Mitgliederliste gegangen ist (AGE-566).
- [ ] 1.4 `openspec validate --all` grün. **Beleg:** beide Changes einzeln in der
      Prüfliste, nicht nur die Gesamtzahl — die ist ein schlechter Zeuge, wenn
      auf verschiedenen Branches verschiedene Changes liegen.

## 2. `admin_list_members` — Test zuerst

- [ ] 2.1 pgTAP: ein Nicht-Admin bekommt `42501`. **Fehlercode prüfen**, nicht
      nur „schlägt fehl" — `try_as()` meldet jeden Fehler als DENIED, auch einen
      Tippfehler im Funktionsnamen. RED.
- [ ] 2.2 pgTAP: ein Profil mit `activated_at is null` **ist** in der Rückgabe
      und trägt `bestaetigt = false`. RED.
- [ ] 2.3 pgTAP: keine Spalte aus `profile_contacts` in der Rückgabe. Gegen die
      Spaltenliste der Funktion prüfen, nicht gegen einen Beispieldatensatz —
      ein leeres Feld sähe sonst aus wie ein fehlendes. RED.
- [ ] 2.4 pgTAP: `p_limit = 2, p_offset = 2` über fünf Mitglieder liefert genau
      die Nummern drei und vier, und zwei Aufrufe liefern dieselbe Reihenfolge.
      RED.
- [ ] 2.5 pgTAP: Suchbegriff `%` liefert nicht die gesamte Mitgliedschaft. RED.
- [ ] 2.6 Migration schreiben: `admin_list_members(p_query text, p_status text,
      p_limit int default 50, p_offset int default 0)`, `security definer`,
      `set search_path = ''`, `is_admin()` als erste Anweisung. Sortierung
      festlegen **und im Migrationskopf begründen** (offene Frage aus design.md).
      GREEN für 2.1–2.5.
- [ ] 2.7 Rechte aussprechen: `revoke execute … from public, anon`,
      `grant execute … to authenticated` (AGE-312). Test, der das belegt.

## 3. Der Paritätstest — die Auflage aus dem Entwurf

- [ ] 3.1 Test, der die Verzeichnisspalten von `admin_list_members` gegen die von
      `search_directory` hält. Er muss die **abweichende Spalte benennen**, nicht
      nur „ungleich" melden.
- [ ] 3.2 Gegenprobe: eine Spalte in einer der beiden versuchsweise umbenennen
      und belegen, dass der Test rot wird. Ohne diese Probe ist unbelegt, dass er
      überhaupt etwas prüft.

## 4. `admin_activate_member`

- [ ] 4.1 pgTAP: ein Nicht-Admin bekommt `42501` und `activated_at` bleibt
      unverändert. RED.
- [ ] 4.2 pgTAP: `mark_activated` gelingt weiterhin ohne Admin-Rolle — der
      Einlöseweg von `redeem-activation` darf nicht brechen. RED, und dieser Test
      muss auch nach 4.3 grün bleiben.
- [ ] 4.3 Migration: `admin_activate_member(target uuid)` als Hülle. GREEN.
- [ ] 4.4 Rechte aussprechen wie in 2.7.

## 5. Die Fläche

- [ ] 5.1 Route `/admin/mitglieder` unter dem vorhandenen `RequireAdmin`;
      Sidebar-Eintrag für Admins.
- [ ] 5.2 Datenzugriff in `src/lib/` neben den vorhandenen Admin-Aufrufen, mit
      Paging-Zustand. Kein Nachladen aller Seiten im Hintergrund.
- [ ] 5.3 Umschalter Tabelle | Karten | Verzeichnis. Test: der Zustand „nicht
      aktiviert" ist in **allen drei** sichtbar.
- [ ] 5.4 Verzeichnis-Ansicht speist die vorhandene Verzeichniskarte. Test: der
      Verweis geht auf `/admin/mitglied/:id` und **nicht** auf `/p/:id`.
- [ ] 5.5 Blätterung sichtbar und benutzt. Test: Seite 2 zeigt andere Mitglieder
      als Seite 1.
- [ ] 5.6 „Zugangslink schicken" ruft `send-activation`. Test: die Rückmeldung
      spricht von **angefordert**, nicht von verschickt oder zugestellt — der
      202 belegt keinen Versand.
- [ ] 5.7 „Direkt aktivieren" ruft `admin_activate_member`, optisch getrennt vom
      Zugangslink und anders beschriftet.
- [ ] 5.8 Test, der belegt, dass es **keine** Handlung zum Setzen eines fremden
      Passworts gibt.

## 6. Prüfen

- [ ] 6.1 `pnpm test`, `pnpm typecheck`, `pnpm lint` grün. `supabase test db`
      **mit Dateiliste** aufrufen — ohne sie meldet der Befehl FAIL, obwohl die
      pgTAP-Dateien grün sind.
- [ ] 6.2 **Sichtprobe im Browser**, nicht nur jsdom: alle drei Sichten, ein
      unbestätigtes Mitglied, beide Handlungen, die Blätterung. In diesem Projekt
      sind mehrere Befunde ausschliesslich im echten Browser aufgefallen, während
      die Tests grün waren.
- [ ] 6.3 Am echten Bestand messen: die Liste zeigt die importierten Mitglieder,
      die über jeden anderen Weg unsichtbar sind. Das ist der Anlass des Changes
      und die einzige Messung, die ihn belegt.
- [ ] 6.4 Diff-Review durch einen Prüfer eines anderen Herstellers; Befunde
      beheben oder begründet ablehnen.

## 7. Abschluss

- [ ] 7.1 `openspec validate --all` grün, Arbeitsbaum sauber, Feature-Branch.
- [ ] 7.2 `openspec archive` — erst wenn 6.3 gemessen ist, nicht wenn der Code
      existiert.
- [ ] 7.3 AGE-566 in Linear auf Done — vorher `get_issue` lesen; die Automation
      schaltet den Status bei PR-Merge womöglich schon selbst.
