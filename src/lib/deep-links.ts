import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Die vier Pfade, die aus einem Link heraus in die App führen (AGE-643, M3).
 *
 * **Das ist die einzige Stelle, an der sie stehen.** Dieselbe Menge braucht
 * sonst drei Artefakte — `apple-app-site-association`, der `intent-filter` im
 * Android-Manifest und der Zuhörer auf `appUrlOpen`. Eine echte Einzelquelle
 * gäbe es nur über einen Generator, und der wäre für vier Zeilen mehr
 * Maschinerie als Nutzen (Entwurf, Entscheidung 9). Beide Dateien verweisen im
 * Kommentar hierher, und die Tests halten sie gegen diese Liste: laufen sie
 * auseinander, zeigt es sich sonst erst am Gerät.
 *
 * `/passwort-neu` fehlt **bewusst** (Entwurf, Entscheidung 10). Der Link hat
 * dieselbe Gestalt wie der Aktivierungslink, aber wer sein Passwort
 * zurücksetzt, kommt gerade nicht hinein — der Browser ist dafür der
 * verlässlichere Ort.
 */
export const DEEP_LINK_PRAEFIXE = ["/aktivierung", "/chat/", "/events/", "/p/"] as const;

/**
 * Dieselbe Menge als AASA-Muster.
 *
 * Ein Präfix mit `/` am Ende deckt alles darunter ab und wird zu `…/*`;
 * `/aktivierung` ist eine einzelne Route und bleibt, wie es ist. Ein
 * Doppelpunkt-Platzhalter aus der Routentabelle (`/chat/:threadId`) wäre in
 * AASA wirkungslos — Apple kennt dort nur `*` und `?`.
 */
export const AASA_MUSTER: string[] = DEEP_LINK_PRAEFIXE.map((pfad) =>
  pfad.endsWith("/") ? `${pfad}*` : pfad,
);

/** Die Domain, die beide Plattformen beanspruchen. Sie steht ausserdem in
 *  `App.entitlements` und im Android-Manifest — `deep-links.native.test.ts`
 *  hält alle drei zusammen. */
export const DEEP_LINK_HOST = "app.effbeezee.com";

function passt(pfad: string, praefix: string): boolean {
  return pfad === praefix || pfad.startsWith(praefix.endsWith("/") ? praefix : `${praefix}/`);
}

/**
 * Die Adresse, mit der die App geöffnet wurde, als anwendungsinterner Pfad —
 * oder `null`.
 *
 * **`hash` fährt mit, und das ist der teuerste Teil.** Der Aktivierungs-Token
 * steht im FRAGMENT (`/aktivierung#token=…`), nicht im Query. Wer nur
 * `pathname` und `search` nimmt, öffnet die App auf dem Aktivierungspfad ohne
 * Token — auf genau dem Weg, der für viele Mitglieder der erste Kontakt
 * überhaupt ist.
 *
 * **Eine unbekannte Adresse ergibt `null`, und dann bewegt sich nichts.** Ein
 * Sprung auf gut Glück wäre schlechter als keiner; dieselbe Regel trägt schon
 * `pushZiel`.
 */
export function deepLinkZiel(adresse: string): string | null {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return null;
  }
  // Der Host wird geprüft, obwohl das Betriebssystem nur Adressen dieser Domain
  // durchreicht: was hier herauskommt, geht ungeprüft in eine Navigation, und
  // die Prüfung kostet eine Zeile.
  if (url.protocol !== "https:" || url.host !== DEEP_LINK_HOST) return null;
  if (!DEEP_LINK_PRAEFIXE.some((praefix) => passt(url.pathname, praefix))) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Lässt einen geöffneten Link in der App am Ziel ankommen.
 *
 * **Der Zuhörer steht, sobald die Hülle steht** — nicht nach dem Anmelden.
 * Wörtlich die Begründung, die schon an `pushZielZuhoerer` steht: ein
 * Kaltstart AUS dem Link heraus trifft sonst ein, bevor jemand zuhört, und der
 * Sprung fällt genau dann aus, wenn er am meisten bedeutet.
 *
 * Gibt das Abräumen zurück, nach dem Muster des `backButton`-Zuhörers in
 * `AppShell.tsx`: löst es sich VOR dem Anmelden ein, bliebe der Zuhörer sonst
 * stehen, ohne dass ihn noch jemand entfernen könnte.
 */
export function deepLinkZuhoerer(navigiere: (ziel: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let abgeraeumt = false;
  let entfernen: (() => void) | undefined;

  void NativeApp.addListener("appUrlOpen", ({ url }) => {
    const ziel = deepLinkZiel(url);
    if (ziel !== null) navigiere(ziel);
  }).then((haltegriff) => {
    if (abgeraeumt) void haltegriff.remove();
    else entfernen = () => void haltegriff.remove();
  });

  return () => {
    abgeraeumt = true;
    entfernen?.();
  };
}

/**
 * Das nach der Anmeldung wiederherzustellende Ziel — oder die Startseite.
 *
 * **Das ist der Sicherheitsteil dieses Changes.** Ohne die Verengung auf einen
 * anwendungsinternen Pfad ist die Zielerhaltung eine offene Weiterleitung: wer
 * einen Link auf die Anmeldung baut und ein fremdes Ziel mitführt, lässt die
 * Anwendung nach erfolgreicher Anmeldung auf eine fremde Seite weiterleiten —
 * unter dem Vertrauen, das die Anwendung beim Mitglied geniesst, und direkt
 * nach der Eingabe der Zugangsdaten.
 *
 * Verworfen wird alles mit Schema oder Host-Angabe. Ausdrücklich auch `//host`
 * (sieht wie ein interner Pfad aus, ist protokollrelativ) und `/\host`, das
 * Browser wie `//` behandeln. Dieselbe Regel trägt schon `pushZiel`.
 */
export function zielNachAnmeldung(zustand: unknown): string {
  const ziel = (zustand as { ziel?: unknown } | null | undefined)?.ziel;
  if (typeof ziel !== "string") return "/";
  if (!ziel.startsWith("/")) return "/";
  if (ziel.startsWith("//") || ziel.startsWith("/\\")) return "/";
  return ziel;
}
