// admin-set-member-ban — die zweite Hälfte der Sperre (AGE-581).
// Spec: openspec/changes/add-admin-member-lifecycle/.
//
// ══ WOFÜR ══════════════════════════════════════════════════════════════════
// „Kein Login zulassen" heisst kein Login. `profiles.disabled_at` allein hält
// eine BESTEHENDE Sitzung nicht auf — deren Zugriffe scheitern erst an den
// Policies — und es hindert niemanden daran, sich neu anzumelden. Ein Konto,
// das sich anmeldet und dann auf einen Sperrhinweis läuft, HAT sich angemeldet.
// Die Sperre ist deshalb zwei Sperren: die Datenbank und `banned_until`.
//
// ══ WARUM EINE EDGE FUNCTION ═══════════════════════════════════════════════
// `auth.users` gehört GoTrue und steht keiner API-Rolle zum Schreiben offen.
// Ein direktes UPDATE — auch aus einer DEFINER-Funktion — liefe an GoTrues
// eigenem Zustand vorbei. Der einzige unterstützte Weg ist die Admin-API, und
// die braucht `service_role`.
//
// ══ WARUM DIESE FUNCTION DER EINZIGE EINGANG IST ═══════════════════════════
// EXECUTE der vier Lebenszyklus-RPCs liegt bei `service_role`, NICHT bei
// `authenticated` — anders als beim Rest der `admin_*`-Funktionen. Läge es dort,
// könnte ein Admin die Datenbankfunktion unmittelbar rufen und einen Zustand
// erzeugen, in dem `disabled_at` steht und der Bann fehlt. Die zugesagte
// Doppelsperre wäre dann keine Zusage, sondern eine Gewohnheit der Oberfläche.
//
// Folge: `auth.uid()` ist in den RPCs leer, die handelnde Person kommt deshalb
// als `actor` mit — und wird hier serverseitig aus dem Token gelesen, nie aus
// dem Rumpf.
//
// ══ WARUM DIE KENNUNG AUS DEM TOKEN KOMMT ══════════════════════════════════
// verify_jwt=true: das Gateway verifiziert das (ES256-)Token vollständig, bevor
// dieser Handler läuft. Unter den asymmetrischen Signaturschlüsseln der
// Produktion sind `getUser()` (liefert null) und `getClaims()` (scheitert am
// JWKS-Fetch) unbrauchbar — gemessen in AGE-259.
//
// ══ WARUM DIE ADMIN-PRÜFUNG ÜBER EINE RPC LÄUFT ════════════════════════════
// `service_role` hält seit AGE-312 auf keiner Tabelle in `public` ein SELECT.
// Ein direktes `.from("staff_roles")` liefe in „permission denied" — und zwar
// erst zur Laufzeit, nicht im Test. `is_admin_uid` ist die DEFINER-Fassung und
// prüft seit AGE-581 auch, dass der Admin selbst nicht gesperrt ist.
//
// ══ DIE REIHENFOLGE IST JE RICHTUNG EINE ANDERE ════════════════════════════
// Schliessen: Datenbank, dann Bann. Öffnen: Bann, dann Datenbank. Die
// Begründung steht bei `istSchliessen` in ban.ts — sie gehört zur Logik, nicht
// zur Verdrahtung.
//
// ══ DER HALBE ZUSTAND ══════════════════════════════════════════════════════
// Scheitert der ZWEITE Schritt, antwortet die Function mit `207` und
// `{hidden: true, banned: false}`. Kein Erfolgston: das Mitglied ist unsichtbar
// und kann sich weiterhin anmelden. Heilbar ist der Zustand, weil
// `admin_disable_member` bei fehlendem Bann nachsetzt statt mit 22023
// abzubrechen — sonst müsste der Admin erst reaktivieren und liesse das Konto
// dabei kurz wieder sichtbar werden.
//
// Scheitert der ERSTE Schritt, hat sich nichts geändert; der Aufrufer bekommt
// den übersetzten Fehler und kann es schlicht erneut versuchen.
//
// ══ WARUM `ban_failed` EINE EIGENE ZEILE IST ═══════════════════════════════
// Die RPC schreibt ihre `admin_audit`-Zeile in DERSELBEN Transaktion wie die
// Änderung an `disabled_at` — bevor irgendjemand wissen kann, ob der Bann
// gelingt. Ihr Payload nachträglich zu ändern hiesse, eine Protokollzeile zu
// überschreiben; ein Protokoll, das sich ändern lässt, ist keins. Deshalb eine
// ZWEITE Zeile, und zwar NUR im Fehlerfall und unter eigenem Namen: sie
// behauptet keine zweite Änderung, sie hält fest, dass die erste halb blieb.
//
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (plattform-injiziert).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { jwtSub } from "../create-checkout-session/checkout.ts";
import {
  banDauerFuer,
  fasseAusgangZusammen,
  istSchliessen,
  parseBanRequest,
  rpcNameFuer,
  statusFuerPgFehler,
} from "./ban.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "content-type": "application/json" };

const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](
    JSON.stringify({ fn: "admin-set-member-ban", event, ...f }),
  );

const antwort = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: JSON_CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return antwort({ error: "unauthorized" }, 401);

  const actor = jwtSub(authHeader.replace(/^Bearer\s+/i, ""));
  if (!actor) return antwort({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return antwort({ error: "bad_request" }, 400);
  }
  const eingabe = parseBanRequest(body);
  if (!eingabe) return antwort({ error: "bad_request" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: istAdmin, error: rollenFehler } = await admin.rpc("is_admin_uid", {
    p_profile_id: actor,
  });
  if (rollenFehler) {
    log("error", "role_lookup_failed", { message: rollenFehler.message });
    return antwort({ error: "server_error" }, 500);
  }
  if (!istAdmin) {
    log("warn", "forbidden", { actor, action: eingabe.action });
    return antwort({ error: "forbidden" }, 403);
  }

  const rpc = rpcNameFuer(eingabe.action);
  const schliesst = istSchliessen(eingabe.action);

  // Die Argumente der vier RPCs sind nicht dieselben: nur die schliessenden
  // kennen einen Grund. `grund` bei `enable`/`restore` mitzuschicken wäre ein
  // Aufruf mit einem Argument, das die Funktion nicht hat — sie existierte für
  // Postgres dann schlicht nicht.
  const rpcArgs = schliesst
    ? { target: eingabe.target, actor, grund: eingabe.grund }
    : { target: eingabe.target, actor };

  const datenbankSchritt = () => admin.rpc(rpc, rpcArgs);
  const bannSchritt = () =>
    admin.auth.admin.updateUserById(eingabe.target, {
      ban_duration: banDauerFuer(eingabe.action),
    });

  // Erster Schritt. Scheitert er, hat sich nichts geändert.
  if (schliesst) {
    const { error } = await datenbankSchritt();
    if (error) {
      log("warn", "db_step_failed", {
        action: eingabe.action,
        target: eingabe.target,
        code: error.code,
      });
      return antwort({ error: "db_failed", detail: error.message }, statusFuerPgFehler(error.code));
    }
  } else {
    const { error } = await bannSchritt();
    if (error) {
      log("error", "unban_failed", { target: eingabe.target, message: error.message });
      // 502 und nicht 500: der Fehler liegt beim Anmeldedienst, und es hat sich
      // nichts geändert — ein erneuter Versuch ist der ganze Ausweg.
      return antwort({ error: "auth_failed", detail: error.message }, 502);
    }
  }

  // Zweiter Schritt. Scheitert er, bleibt der halbe Zustand — benannt, nicht
  // verschwiegen.
  const zweiter = schliesst ? await bannSchritt() : await datenbankSchritt();
  const zweiterFehler = zweiter.error?.message ?? null;

  if (zweiterFehler !== null) {
    log("error", "half_state", {
      actor,
      action: eingabe.action,
      target: eingabe.target,
      message: zweiterFehler,
    });
    const { error: auditFehler } = await admin.rpc("log_admin_action", {
      p_actor: actor,
      p_action: "ban_failed",
      p_target: eingabe.target,
      p_payload: { action: eingabe.action, detail: zweiterFehler },
    });
    if (auditFehler) log("error", "audit_failed", { message: auditFehler.message });
  }

  const ergebnis = fasseAusgangZusammen(eingabe.action, zweiterFehler);
  log(zweiterFehler === null ? "info" : "warn", "done", {
    actor,
    action: eingabe.action,
    target: eingabe.target,
    status: ergebnis.status,
  });
  return antwort(ergebnis.body, ergebnis.status);
});
