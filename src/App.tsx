import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ActivationGate from "./components/ActivationGate";
import AppShell from "./components/AppShell";
import EnvironmentBanner from "./components/EnvironmentBanner";
import { DesignVariantProvider } from "./providers/DesignVariantProvider";
import { ThemeServerSync } from "./providers/ThemeServerSync";
import MembershipGate from "./components/MembershipGate";
import RequireAdmin from "./components/RequireAdmin";
import RequireAuth from "./components/RequireAuth";
import RequireStaff from "./components/RequireStaff";
import { navItems, type NavItem } from "./config/nav";
import AdminFeedbackPage from "./pages/AdminFeedbackPage";
import AdminNeuigkeitenPage from "./pages/AdminNeuigkeitenPage";
import AdminMitgliedPage from "./pages/AdminMitgliedPage";
import AdminMitgliederPage from "./pages/AdminMitgliederPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import ChatPage from "./pages/ChatPage";
import EventDetailPage from "./pages/EventDetailPage";
import InternRoutingPage from "./pages/InternRoutingPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import WillkommenPage from "./pages/WillkommenPage";
import ActivationRedeemPage from "./pages/ActivationRedeemPage";
import PublicProfilePage from "./pages/PublicProfilePage";
import LegalRoute from "./pages/LegalRoute";
import { rechtsseiten } from "./content/legal/meta";

// Dev-only: aus dem Prod-Build heraustree-shaken (DEV ist statisch false).
const StyleguidePage = import.meta.env.DEV ? lazy(() => import("./pages/StyleguidePage")) : null;

function gatedElement(item: NavItem) {
  const element = <item.Component />;
  // minTier ⇒ Wand statt Wegleiten: das Format bleibt im Schaufenster sichtbar, der
  // Inhalt gesperrt (Spec §1). Bewusst VOR der Section-Prüfung: /meine-chancen liegt
  // seit AGE-314 unter „mein-bereich", soll aber weiter mauern statt wegzuleiten.
  if (item.minTier) return <MembershipGate min={item.minTier}>{element}</MembershipGate>;
  // requiresAuth: ENTDECKEN mauert (Schaufenster bleibt sichtbar), persönliche
  // Bereiche leiten zum Login — dort gibt es ohne Konto nichts zu zeigen.
  if (item.requiresAuth) {
    return item.section === "entdecken" ? (
      <MembershipGate>{element}</MembershipGate>
    ) : (
      <RequireAuth>{element}</RequireAuth>
    );
  }
  return element;
}

/** Der DesignSwitcher wird seit AGE-492 nicht mehr gemountet: das Theme ist eine
 *  Nutzer-Einstellung (EinstellungenPage), kein Review-Werkzeug. Die Komponente
 *  bleibt im Baum, nur ohne Montagepunkt. */
export default function App() {
  return (
    <DesignVariantProvider>
      {/* Rendert nichts — gleicht das Theme mit member_settings.theme ab. */}
      <ThemeServerSync />
      {/* Hier statt in AppShell: die Kennzeichnung muss auch auf den Seiten
          stehen, die ohne Rahmen laufen (Anmeldung, Passwort zurücksetzen) —
          gerade dort entscheidet sich, gegen welches Projekt jemand arbeitet. */}
      <EnvironmentBanner />
      <AppInner />
    </DesignVariantProvider>
  );
}

function AppInner() {
  return (
    <Routes>
      {/* Aktivierungs-Wand um ALLES, was in der Shell liegt (AGE-495). Ein
          eingeloggtes, noch unbestätigtes Konto sieht ausschließlich den
          Aktivierungsbildschirm — egal welche Route. Bequemlichkeit, nicht die
          Sicherheitsgrenze: die ist die RLS. */}
      <Route
        element={
          <ActivationGate>
            <AppShell />
          </ActivationGate>
        }
      >
        {/* Startseite (`/`) kommt aus navItems (Eintrag „Start" → HomeRedirect, das die
            öffentliche HomePage rendert und nur den Onboarding-Gate-Fall abfängt). */}
        {navItems.map((item) => (
          <Route key={item.path} path={item.path} element={gatedElement(item)} />
        ))}
        <Route path="/mein-bereich" element={<Navigate to="/profil" replace />} />
        {/* AGE-450: Chancen + Matching sind fürs Sommerfest raus (Detlev, 22.07.).
            /meine-chancen ist keine navItem-Route mehr; beide Pfade leiten auf /
            um, damit direkte Links/Lesezeichen nicht ins Leere laufen. Reversibel:
            navItem zurück + diese Redirects entfernen. */}
        <Route path="/meine-chancen" element={<Navigate to="/" replace />} />
        {/* AGE-533: „Meine Kurse" ist gelöscht — „Meine Academy" ist als
            Reiter an ihre Stelle getreten. Anders als bei /meine-chancen
            führt der Redirect NICHT auf die Startseite, sondern dorthin,
            wo der Inhalt jetzt steht. */}
        <Route path="/meine-kurse" element={<Navigate to="/academy" replace />} />
        <Route path="/matching" element={<Navigate to="/" replace />} />
        <Route path="/community" element={<Navigate to="/aktivitaet" replace />} />
        <Route path="/verzeichnis" element={<Navigate to="/mitglieder" replace />} />
        {/* AGE-494: Die Route heißt sichtbar „Kompass". Der Redirect hält alte
            Links und Lesezeichen am Leben — die DB heißt weiter `compass`, das ist
            Absicht (siehe Kopf von src/config/compass.ts). */}
        <Route path="/compass" element={<Navigate to="/kompass" replace />} />
        {/* Der Such-/Biete-Editor ist seit AGE-314 ein Tab in /kompass (Spec §3).
            Der Redirect landet auf dem Mini-Kompass-Tab, nicht auf „Suche & Biete" —
            Tab-Deeplinks hat heute keine Seite, das wäre ein eigener Mechanismus.
            Direkt auf /kompass, nicht über /compass: zwei Sprünge für nichts. */}
        <Route path="/angebote-gesuche" element={<Navigate to="/kompass" replace />} />
        {/* Chat-Deeplink auf einen Thread (AGE-248 §9). /chat selbst kommt aus navItems;
            die param-Variante öffnet direkt eine Konversation (z. B. aus einer Anfrage). */}
        <Route
          path="/chat/:threadId"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        {/* Öffentliche Profilseite (AGE-239) — param-basiert, daher kein Sidebar-Eintrag.
            /profil ist der eigene Editor; fremde Profile liegen unter /p/:id. Sichtbarkeit
            erzwingt die RLS (profiles_public ist nur für authenticated lesbar). */}
        <Route
          path="/p/:id"
          element={
            <RequireAuth>
              <PublicProfilePage />
            </RequireAuth>
          }
        />
        {/* Event-Detail (AGE-251) — param-basiert, daher kein Sidebar-Eintrag. Ohne
            RequireAuth: anon darf öffentliche Events sehen; die RLS gated den Rest. */}
        <Route path="/events/:id" element={<EventDetailPage />} />
        {/* Interne Manager-Ansicht: FBC/DKRI-Routing-Queue (AGE-249 §8). Nur Staff
            (matching_manager/admin), daher kein Sidebar-Eintrag; per URL erreichbar.
            DB-seitig erzwingt list_routing_queue/RLS is_matching_manager(). */}
        <Route
          path="/intern/routing"
          element={
            <RequireStaff>
              <InternRoutingPage />
            </RequireStaff>
          }
        />
        {/* Admin-Einstellungen (AGE-455). Nur `admin` (RequireAdmin), daher kein
            navItem — der Sidebar-Eintrag wird in AppShell separat für Admins gesetzt.
            DB-seitig erzwingt platform_settings_update_admin is_admin(). */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminSettingsPage />
            </RequireAdmin>
          }
        />
        {/* QM-Feedback (AGE-358, eigene Fläche seit AGE-587). Stand bis dahin als
            Karte auf /admin und holte dabei JEDE Zeile auf einmal — die letzte
            listende Fläche ohne Blätterung. Eager importiert wie die anderen
            Admin-Seiten: sie sind selten besucht, aber klein, und ein
            Ladezustand mitten in der Verwaltung wäre teurer als das Bündel.
            Die echte Grenze ist is_admin() im Rumpf von admin_list_feedback;
            RequireAdmin ist Komfort. */}
        <Route
          path="/admin/feedback"
          element={
            <RequireAdmin>
              <AdminFeedbackPage />
            </RequireAdmin>
          }
        />
        {/* Neuigkeiten (AGE-631). Dieselbe Begruendung wie beim QM-Feedback
            darueber: eager importiert, RequireAdmin ist Komfort, die echte
            Grenze ist `is_admin()` im Rumpf von `send_release_note` und in den
            Policies auf `release_notes`. */}
        <Route
          path="/admin/neuigkeiten"
          element={
            <RequireAdmin>
              <AdminNeuigkeitenPage />
            </RequireAdmin>
          }
        />
        {/* Admin-Mitgliederliste (AGE-566). Derselbe Grund wie bei der Route
            darunter, nur eine Ebene höher: über Verzeichnis, /p/:id und Suche
            ist ein unbestätigtes Profil für NIEMANDEN sichtbar, auch nicht für
            einen Admin. Diese Liste ist der einzige Ort, an dem die
            importierten Mitglieder vorkommen. Die Grenze ist is_admin() im
            Rumpf von admin_list_members; RequireAdmin ist Komfort. */}
        <Route
          path="/admin/mitglieder"
          element={
            <RequireAdmin>
              <AdminMitgliederPage />
            </RequireAdmin>
          }
        />
        {/* Admin bearbeitet ein fremdes Profil (AGE-498). BEWUSST hier und nicht
            unter /p/:id/bearbeiten: /p/:id liest profiles_public, und die Sicht
            verlangt ein bestätigtes ZIELPROFIL — für ein importiertes,
            unbestätigtes Mitglied, also den Anlassfall, meldet sie „nicht
            gefunden". Die Grenze ist ohnehin is_admin() in den RPCs; RequireAdmin
            ist Komfort. */}
        <Route
          path="/admin/mitglied/:id"
          element={
            <RequireAdmin>
              <AdminMitgliedPage />
            </RequireAdmin>
          }
        />
      </Route>
      {/* Rechtsseiten (AGE-497) — BEWUSST ausserhalb des AppShell-Blocks, wie
          /login. Die Shell liegt hinter <ActivationGate>; ein eingeloggtes,
          noch unbestaetigtes Konto saehe dort ausschliesslich den
          Aktivierungsbildschirm. Das Impressum waere damit genau fuer die
          Gruppe unerreichbar, die es am dringendsten braucht: Menschen, die
          gerade ein Konto bestaetigen und vor dem Passwortsetzen sehen wollen,
          worauf sie sich einlassen. § 5 DDG und Art. 13 DSGVO kennen keine
          Aktivierungswand. */}
      {rechtsseiten.map((seite) => (
        <Route key={seite.slug} path={`/${seite.slug}`} element={<LegalRoute seite={seite} />} />
      ))}
      <Route path="/login" element={<LoginPage />} />
      {/* Einlösung — außerhalb der Shell (wie /login) und bewusst OHNE
          RequireAuth und ohne ActivationGate: Das Token trägt die Identität,
          nicht die Sitzung. Nur so funktioniert der Link in einem anderen
          Browser (AGE-495 §6). */}
      <Route path="/aktivierung" element={<ActivationRedeemPage />} />
      {/* AGE-505: dasselbe Bauteil, derselbe Einlöse-Endpunkt, andere Sprache.
          Das Token trägt seinen Zweck bewusst nicht mit sich — die Route ist
          der einzige Träger, an dem sich entscheiden lässt, ob hier ein Zugang
          bestätigt oder ein vergessenes Passwort ersetzt wird. */}
      <Route path="/passwort-vergessen" element={<ActivationRedeemPage zweck="reset" />} />
      <Route path="/passwort-neu" element={<ActivationRedeemPage zweck="reset" />} />
      {/* Mini-Compass-Onboarding (AGE-243) — eigene, fokussierte Vollbild-Strecke
          außerhalb der AppShell (wie /login). AGE-495 Befund F1: liegt trotzdem
          hinter der Aktivierungswand — ActivationGate verspricht „egal welche
          Route", und ohne das Gate sah ein unbestätigtes Konto hier den vollen
          Kompass-Assistenten statt der Wand. */}
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <ActivationGate>
              <OnboardingPage />
            </ActivationGate>
          </RequireAuth>
        }
      />
      {/* Willkommensstrecke (AGE-538, C11) — außerhalb der AppShell wie
          /onboarding, hinter denselben beiden Wachen. KEIN Eintrag in
          NARROW_ROUTES: die Liste wird in AppShell.tsx:268 INNERHALB der Shell
          gelesen und wäre für eine Route außerhalb wirkungslos.
          Die Strecke ist erreichbar, ohne dass jemand hierher geleitet wird —
          umgeleitet wird nur von `/` und nur ohne gesetzten Merker
          (HomeRedirect). */}
      <Route
        path="/willkommen"
        element={
          <RequireAuth>
            <ActivationGate>
              <WillkommenPage />
            </ActivationGate>
          </RequireAuth>
        }
      />
      {StyleguidePage && (
        <Route
          path="/styleguide"
          element={
            <Suspense fallback={null}>
              <StyleguidePage />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}
