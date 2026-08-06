// Reine Mail-Logik für send-activation (AGE-495 / C3).
//
// Alles hier ist nebenwirkungsfrei und mit `deno test` prüfbar (emails.test.ts):
// der Linkbau und die Vorlage. Jede I/O — Datenbank, Resend — liegt in index.ts.
// Dasselbe Muster wie notify-contact-request (AGE-247).
//
// Marke: schwarz & gold (docs/design-system.md). Tabellen-Layout mit
// Inline-Styles, damit es Mail-Programme überleben.

/** Minimales HTML-Escaping — der Name kommt aus dem Mitgliederbestand. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Baut den Aktivierungslink.
 *
 * Das Token steht im **Fragment**, nicht im Query-String. Ein Query-String
 * landet in der Browser-Historie, in Server- und CDN-Logs und potenziell im
 * `Referer`; ein Fragment wird nie an einen Server gesendet. Das Token beherrscht
 * das Konto — es gehört in keins dieser Protokolle.
 */
export function activationUrl(appUrl: string, token: string): string {
  const basis = appUrl.replace(/\/+$/, "");
  return `${basis}/aktivierung#token=${encodeURIComponent(token)}`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const GOLD = "#c8a24b";
const INK = "#0d0d0d";
const PAPER = "#111111";

/**
 * Die Aktivierungsmail.
 *
 * Der Text ist Produkt, nicht Technik — Ton wie ein Club, nicht wie eine
 * Systemmeldung. Drei Dinge sind Pflicht und stehen unter Test:
 *
 *  1. Zwei Sätze zur Einordnung: eff.bee.zee ist die Plattform, der Fair
 *     Business Club die Premium-Community darin. Ohne sie kommen 70 Rückfragen.
 *  2. Die Gültigkeit (72 h) und dass ein neuer Link den alten entwertet — beides
 *     sind technische Zusagen (`expires_at`, `invalidated_at`). Wer zweimal
 *     anfordert und den ersten Link klickt, muss vorgewarnt sein.
 *  3. KEINE Zusage, die nicht hält. Ein früherer Entwurf schrieb „für niemanden
 *     sichtbar — auch nicht für uns". Das ist unwahr: `service_role` und der
 *     Datenbankbetrieb sehen das Profil unabhängig vom Gate. Verengt auf
 *     „für kein anderes Mitglied", was stimmt.
 */
export function renderActivation(opts: { name: string; url: string }): RenderedEmail {
  const name = opts.name?.trim();
  const anrede = name ? `Liebe/r ${escapeHtml(name)},` : "Hallo,";
  const anredeText = name ? `Liebe/r ${name},` : "Hallo,";
  const subject = "Dein Zugang zu eff.bee.zee — nur noch ein Klick";

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${INK};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:${PAPER};border:1px solid #232323;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #232323;">
          <span style="color:${GOLD};font-size:18px;font-weight:700;letter-spacing:0.04em;">FAIR BUSINESS CLUB</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#f5f0e1;font-size:22px;font-weight:700;padding-bottom:14px;">Dein Zugang zu eff.bee.zee</td></tr>
            <tr><td style="color:#cfcabd;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;">${anrede}</p>
              <p style="margin:0 0 16px;">schön, dass du dabei bist. Der Fair Business Club hat ein neues Zuhause:
                <strong style="color:#f5f0e1;">eff.bee.zee</strong> ist die Plattform, auf der wir uns ab jetzt finden,
                austauschen und verabreden — der Fair Business Club ist die Premium-Community darin, mit allem,
                was du von uns kennst.</p>
              <p style="margin:0 0 16px;">Dein Profil ist schon angelegt. Damit niemand außer dir darauf zugreifen kann,
                fehlt noch ein Schritt: Bestätige diese Adresse und vergib dein eigenes Passwort.</p>
            </td></tr>
            <tr><td style="padding:8px 0 4px;">
              <a href="${escapeHtml(opts.url)}"
                 style="display:inline-block;background:${GOLD};color:${INK};text-decoration:none;
                        font-weight:600;padding:12px 22px;border-radius:6px;font-size:15px;">
                Zugang freischalten
              </a></td></tr>
            <tr><td style="color:#cfcabd;font-size:15px;line-height:1.6;padding-top:16px;">
              <p style="margin:0 0 16px;">Der Link gilt 72 Stunden und lässt sich nur einmal verwenden.
                Forderst du einen neuen an, wird der alte ungültig. Bis du ihn geklickt hast, ist dein Profil
                für kein anderes Mitglied sichtbar.</p>
              <p style="margin:0;">Falls du diese Mail nicht erwartet hast, ignoriere sie einfach.
                Ohne den Klick passiert nichts.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #232323;color:#6f6a5e;font-size:12px;line-height:1.5;">
          Der Link funktioniert nicht? Kopiere diese Adresse in deinen Browser:<br>
          <span style="color:#8b8578;word-break:break-all;">${escapeHtml(opts.url)}</span><br><br>
          Fragen? Schreib uns an info@fairbusinessclub.de
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text =
    `${anredeText}\n\n` +
    `schön, dass du dabei bist. Der Fair Business Club hat ein neues Zuhause: ` +
    `eff.bee.zee ist die Plattform, auf der wir uns ab jetzt finden, austauschen ` +
    `und verabreden — der Fair Business Club ist die Premium-Community darin, ` +
    `mit allem, was du von uns kennst.\n\n` +
    `Dein Profil ist schon angelegt. Damit niemand außer dir darauf zugreifen ` +
    `kann, fehlt noch ein Schritt: Bestätige diese Adresse und vergib dein ` +
    `eigenes Passwort.\n\n` +
    `${opts.url}\n\n` +
    `Der Link gilt 72 Stunden und lässt sich nur einmal verwenden. Forderst du ` +
    `einen neuen an, wird der alte ungültig. Bis du ihn geklickt hast, ist dein ` +
    `Profil für kein anderes Mitglied sichtbar.\n\n` +
    `Falls du diese Mail nicht erwartet hast, ignoriere sie einfach. Ohne den ` +
    `Klick passiert nichts.\n\n` +
    `Herzliche Grüße\nDetlev Kraft\nFair Business Club\n\n` +
    `Fragen? Schreib uns an info@fairbusinessclub.de`;

  return { subject, html, text };
}
