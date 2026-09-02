// ════════════════════════════════════════════════════════════════════════════
// send-push — AGE-641, Phase A, Schritt 5
// ════════════════════════════════════════════════════════════════════════════
//
// Angestossen von einem Database Webhook auf `public.notifications` (INSERT),
// genau wie `notify-contact-request`. Zusaetzlich ruft der
// Wiederholungslauf dieselbe Function mit `{"modus":"faellig"}` auf; welche
// Auftraege dann drankommen, entscheidet `push_auftraege_faellig`.
//
// ══ WAS DIESE FUNCTION NICHT ENTSCHEIDET ═══════════════════════════════════
//
// Ob ein Hinweis ueberhaupt aufs Geraet gehoert, steht NICHT hier. Zuordnung
// (`push_routing`), Aktivierung und der Schalter des Mitglieds liegen in
// `push_auftraege_holen` — die RPC gibt schlicht nichts zurueck, wenn einer
// davon nein sagt. Dieselbe Datei kann den Freitext alter
// contact_request-Zeilen auch gar nicht sehen: die RPC liefert eine feste
// Feldliste und nie die Nutzlast.
//
// Das ist Absicht. Waeren diese Pruefungen hier, waeren sie ein `if`, das
// jemand aendern kann; in der Datenbank sind sie eine Eigenschaft der Daten.
//
// ══ AUTH ═══════════════════════════════════════════════════════════════════
//
// `verify_jwt=false` — ein DB-Webhook traegt kein Nutzer-JWT. Geschuetzt durch
// ein gemeinsames Geheimnis im `Authorization`-Kopf. Kein `getUser()` und kein
// `getClaims()`: beide scheitern unter ES256 (siehe AGE-259).
//
// Anders als bei `notify-contact-request` braucht es hier KEINEN Abgleich der
// Nutzlast mit der Datenbank: aus dem Aufruf wird ausschliesslich die
// Hinweis-Kennung gelesen, alles Uebrige holt die RPC selbst. Wer das Geheimnis
// hat, kann damit einen bestehenden Hinweis erneut anstossen — und dagegen
// steht der Primaerschluessel von `push_zustellungen`, nicht eine Pruefung.
//
// ══ QUITTIERT WIRD IMMER ═══════════════════════════════════════════════════
//
// `push_auftraege_holen` setzt die Zeile beim Holen auf `laeuft`, und nur die
// Quittung holt sie da wieder heraus — `push_auftraege_faellig` sucht nach
// `offen`. Ein Ausstieg zwischen Anspruch und Quittung liesse den Auftrag
// also fuer immer liegen. Darum quittiert diese Datei auf JEDEM Weg nach
// draussen, auch bei fehlender Anbieter-Konfiguration.
//
// Das deckt den Ausstieg ab, nicht den Absturz: bricht die Laufzeit selbst weg
// (Zeitlimit, Deploy mitten im Lauf), bleibt die Zeile stehen. Dafuer braucht
// es einen Aufraeumer in der Datenbank — siehe Migration 20260828100000.
//
// ══ SECRETS (Infisical → `supabase secrets set`, docs/secrets.md) ══════════
//   PUSH_WEBHOOK_SECRET   gemeinsames Geheimnis des Webhooks
//   FCM_SERVICE_ACCOUNT   Dienstkonto-JSON des Firebase-Projekts
//   APNS_KEY_P8           Inhalt des `.p8`-Schluessels
//   APNS_KEY_ID           Kennung ebendieses Schluessels
//   APNS_TEAM_ID          Apple-Team
//   APNS_BUNDLE_ID        Vertragsnummer der App
//   APNS_SANDBOX          "1" fuer Entwicklungsgeraete (Vorgabe: Produktion)
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzt die Plattform.
//
// Donald, 28.08.2026.
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { pruefeAufruf } from "./aufruf.ts";
import { baueBenachrichtigung, type Auftrag } from "./nachrichten.ts";
import {
  apnsEndpunkt,
  apnsJwt,
  apnsKoerper,
  apnsKopfzeilen,
  APNS_HOST_PROD,
  APNS_HOST_SANDBOX,
  apnsMitHostErkennung,
  bewerteApns,
  bewerteFcm,
  fcmEndpunkt,
  fcmKoerper,
  googleZugangstoken,
  type Bewertung,
  type Dienstkonto,
} from "./anbieter.ts";

function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify({ fn: "send-push", event, ...fields }),
  );
}

/**
 * Nur der Ausschnitt des Supabase-Klienten, den diese Datei benutzt.
 *
 * Die Edge Functions teilen `src/lib/database.types.ts` nicht — der Klient ist
 * hier also untypisiert, und `rpc()` traegt dann Signaturen, die `deno check`
 * zu Recht zurueckweist (Parameter `undefined`, Ergebnis weder Einzelzeile
 * noch Liste). Ein eigener kleiner Vertrag ist ehrlicher als ein `any`: er
 * nennt genau das, was gerufen wird, und `deno check` prueft die Aufrufe
 * weiterhin gegen ihn.
 */
interface RpcKlient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}

Deno.serve(async (req) => {
  // Verfahren, Geheimnis und Rumpf entscheidet `aufruf.ts` — und es baut die
  // Ablehnungsantwort gleich mit. Wuerde hier nur ein Statuscode ankommen und
  // die Antwort daneben gebaut, waere die Doppelung zurueck, an der `ota-stats`
  // scheiterte: der geprueften Haelfte gegenueber steht dann eine ungepruefte.
  const pruefung = await pruefeAufruf(req, Deno.env.get("PUSH_WEBHOOK_SECRET"));
  if (!pruefung.weiter) {
    if (pruefung.log) log(pruefung.log.level, pruefung.log.event);
    return pruefung.antwort;
  }
  const { hinweisId, faellig } = pruefung;

  const supabase: RpcKlient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = faellig
    ? await supabase.rpc("push_auftraege_faellig")
    : await supabase.rpc("push_auftraege_holen", { p_notification_id: hinweisId });

  if (error) {
    log("error", "auftraege_fehlgeschlagen", { faellig, error: error.code });
    return new Response("Lookup failed", { status: 502 });
  }

  // Die RPC gibt eine Liste zurueck; die Form steht in der Migration
  // `20260827240000` und wird von `push_zustellung_test.sql` gemessen.
  const auftraege = (data ?? []) as Auftrag[];
  if (auftraege.length === 0) {
    // Kein Fehler: die RPC sagt damit „dieser Typ wird nicht gepusst", „der
    // Schalter ist aus", „das Konto ist gesperrt" oder „schon zugestellt".
    log("info", "nichts_zu_tun", { faellig, hinweisId });
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const zustellung = new Zustellung(supabase);
  try {
    for (const auftrag of auftraege) await zustellung.stelleZu(auftrag);
  } finally {
    // Was hier noch offen ist, wurde beansprucht und nicht quittiert — die
    // Zeile stuende sonst fuer immer auf `laeuft`.
    await zustellung.quittiereRest(auftraege);
  }

  log("info", "lauf_beendet", { faellig, ...zustellung.bilanz });
  return new Response(JSON.stringify(zustellung.bilanz), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

class Zustellung {
  readonly bilanz = { zugestellt: 0, vorlaeufig: 0, dauerhaft: 0 };
  private readonly quittiert = new Set<string>();
  private googleToken?: string;
  private appleToken?: string;

  constructor(private readonly supabase: RpcKlient) {}

  async stelleZu(auftrag: Auftrag): Promise<void> {
    const n = baueBenachrichtigung(auftrag);
    let bewertung: Bewertung;
    try {
      bewertung =
        auftrag.plattform === "ios"
          ? await this.ueberApns(auftrag, n)
          : await this.ueberFcm(auftrag, n);
    } catch (e) {
      // Ein Netzfehler oder eine fehlende Konfiguration ist ein schlechter
      // Moment und keine Aussage ueber das Geraet — nie `dauerhaft`.
      const grund = e instanceof Error ? e.message : "unbekannt";
      log("error", "zustellung_warf", { plattform: auftrag.plattform, grund });
      bewertung = { ergebnis: "vorlaeufig", grund };
    }
    await this.quittiere(auftrag, bewertung);
  }

  private async ueberFcm(auftrag: Auftrag, n: ReturnType<typeof baueBenachrichtigung>) {
    const roh = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!roh) throw new Error("fcm_nicht_konfiguriert");
    const konto = JSON.parse(roh) as Dienstkonto & { project_id?: string };
    if (!konto.project_id) throw new Error("fcm_ohne_project_id");

    this.googleToken ??= await googleZugangstoken(konto);
    const res = await fetch(fcmEndpunkt(konto.project_id), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.googleToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(fcmKoerper(auftrag, n)),
    });
    return bewerteFcm(res.status, await res.json().catch(() => null));
  }

  private async ueberApns(auftrag: Auftrag, n: ReturnType<typeof baueBenachrichtigung>) {
    const p8 = Deno.env.get("APNS_KEY_P8");
    const keyId = Deno.env.get("APNS_KEY_ID");
    const teamId = Deno.env.get("APNS_TEAM_ID");
    const bundleId = Deno.env.get("APNS_BUNDLE_ID");
    if (!p8 || !keyId || !teamId || !bundleId) throw new Error("apns_nicht_konfiguriert");

    // In eine lokale Bindung, nicht `this.appleToken!` im Closure: die
    // Verengung aus `??=` gilt dort nicht mehr, und ein `!` waere hier eine
    // unterdrueckte Pruefung statt einer belegten Zusage.
    const jwt = (this.appleToken ??= await apnsJwt({ p8, keyId, teamId }));

    // `APNS_SANDBOX` waehlt nur noch, welcher Host ZUERST gefragt wird — die
    // Entscheidung faellt an der Antwort. Warum, steht bei
    // `apnsMitHostErkennung`.
    const ersterHost = Deno.env.get("APNS_SANDBOX") === "1" ? APNS_HOST_SANDBOX : APNS_HOST_PROD;

    return await apnsMitHostErkennung(ersterHost, async (host) => {
      const res = await fetch(apnsEndpunkt(host, auftrag.token), {
        method: "POST",
        headers: { ...apnsKopfzeilen(jwt, bundleId), "content-type": "application/json" },
        body: JSON.stringify(apnsKoerper(n)),
      });
      return bewerteApns(res.status, await res.json().catch(() => null));
    });
  }

  private async quittiere(auftrag: Auftrag, bewertung: Bewertung): Promise<void> {
    const schluessel = `${auftrag.notification_id}:${auftrag.token_id}`;
    if (this.quittiert.has(schluessel)) return;
    this.quittiert.add(schluessel);
    this.bilanz[bewertung.ergebnis] += 1;

    const { error } = await this.supabase.rpc("push_zustellung_quittieren", {
      p_notification_id: auftrag.notification_id,
      p_token_id: auftrag.token_id,
      p_ergebnis: bewertung.ergebnis,
      p_fehler: bewertung.grund,
    });
    if (error) {
      // Die Zeile bleibt jetzt auf `laeuft` liegen. Laut protokollieren: das
      // ist der Fall, den der Aufraeumer in der Datenbank einsammeln muss.
      log("error", "quittung_fehlgeschlagen", { schluessel, error: error.code });
    }
  }

  async quittiereRest(auftraege: Auftrag[]): Promise<void> {
    for (const auftrag of auftraege) {
      if (this.quittiert.has(`${auftrag.notification_id}:${auftrag.token_id}`)) continue;
      log("warn", "unquittiert_nachgeholt", { plattform: auftrag.plattform });
      await this.quittiere(auftrag, { ergebnis: "vorlaeufig", grund: "lauf_abgebrochen" });
    }
  }
}
