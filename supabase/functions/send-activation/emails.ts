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
  return linkAuf(appUrl, "/aktivierung", token);
}

/**
 * Baut den Link zum Zurücksetzen des Passworts (AGE-505).
 *
 * Eigene Zieladresse, und das ist keine Kosmetik: Das Token ist bewusst
 * undurchsichtig und trägt seinen Zweck nicht mit sich. Die Zieladresse ist
 * damit der **einzige** Träger, an dem die Oberfläche entscheiden kann, ob sie
 * vom Bestätigen eines Zugangs oder vom Setzen eines neuen Passworts spricht.
 * Der Einlöse-Endpunkt dahinter bleibt derselbe.
 */
export function passwordResetUrl(appUrl: string, token: string): string {
  return linkAuf(appUrl, "/passwort-neu", token);
}

function linkAuf(appUrl: string, pfad: string, token: string): string {
  const basis = appUrl.replace(/\/+$/, "");
  return `${basis}${pfad}#token=${encodeURIComponent(token)}`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const GOLD = "#c8a24b";
const INK = "#0d0d0d";
const PAPER = "#111111";

/** Anrede in beiden Fassungen — im HTML escaped, im Text roh. */
function anreden(name: string | undefined): { html: string; text: string } {
  const n = name?.trim();
  return n
    ? { html: `Liebe/r ${escapeHtml(n)},`, text: `Liebe/r ${n},` }
    : { html: "Hallo,", text: "Hallo," };
}

/**
 * Der gemeinsame Rahmen beider Mails: Kopf, Karte, Knopf, Fußzeile.
 *
 * Herausgezogen, als die Reset-Mail dazukam (AGE-505) — zwei Kopien desselben
 * Tabellen-Layouts hätten bedeutet, dass jede künftige Markenänderung an zwei
 * Stellen gemacht werden muss und beim ersten Mal an einer vergessen wird. Was
 * die Mails unterscheidet, ist ihr Text; was sie teilen, ist die Hülle.
 */
function rahmen(opts: {
  titel: string;
  koerper: string;
  knopf: string;
  nachsatz: string;
  url: string;
}): string {
  return `<!doctype html>
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
            <tr><td style="color:#f5f0e1;font-size:22px;font-weight:700;padding-bottom:14px;">${opts.titel}</td></tr>
            <tr><td style="color:#cfcabd;font-size:15px;line-height:1.6;">
${opts.koerper}
            </td></tr>
            <tr><td style="padding:8px 0 4px;">
              <a href="${escapeHtml(opts.url)}"
                 style="display:inline-block;background:${GOLD};color:${INK};text-decoration:none;
                        font-weight:600;padding:12px 22px;border-radius:6px;font-size:15px;">
                ${opts.knopf}
              </a></td></tr>
            <tr><td style="color:#cfcabd;font-size:15px;line-height:1.6;padding-top:16px;">
${opts.nachsatz}
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
}

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
  const { html: anrede, text: anredeText } = anreden(opts.name);
  const subject = "Dein Zugang zu eff.bee.zee — nur noch ein Klick";

  const html = rahmen({
    titel: "Dein Zugang zu eff.bee.zee",
    url: opts.url,
    knopf: "Zugang freischalten",
    koerper: `              <p style="margin:0 0 16px;">${anrede}</p>
              <p style="margin:0 0 16px;">schön, dass du dabei bist. Der Fair Business Club hat ein neues Zuhause:
                <strong style="color:#f5f0e1;">eff.bee.zee</strong> ist die Plattform, auf der wir uns ab jetzt finden,
                austauschen und verabreden — der Fair Business Club ist die Premium-Community darin, mit allem,
                was du von uns kennst.</p>
              <p style="margin:0 0 16px;">Dein Profil ist schon angelegt. Damit niemand außer dir darauf zugreifen kann,
                fehlt noch ein Schritt: Bestätige diese Adresse und vergib dein eigenes Passwort.</p>`,
    nachsatz: `              <p style="margin:0 0 16px;">Der Link gilt 72 Stunden und lässt sich nur einmal verwenden.
                Forderst du einen neuen an, wird der alte ungültig. Bis du ihn geklickt hast, ist dein Profil
                für kein anderes Mitglied sichtbar.</p>
              <p style="margin:0;">Falls du diese Mail nicht erwartet hast, ignoriere sie einfach.
                Ohne den Klick passiert nichts.</p>`,
  });

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

/**
 * Die Mail zum Zurücksetzen des Passworts (AGE-505).
 *
 * Sie fährt auf demselben Token und demselben Einlöse-Endpunkt wie die
 * Aktivierung — unterschiedlich sind Sprache und Zieladresse. Drei Dinge sind
 * Pflicht und stehen unter Test:
 *
 *  1. **Die Abmeldung aller Geräte.** `revoke_sessions` läuft beim Einlösen
 *     mit. Steht das nicht in der Mail, ist es eine Überraschung — und wer auf
 *     dem Telefon angemeldet war, hält den Reset für kaputt.
 *  2. **Der Ignorieren-Hinweis.** Keine Höflichkeit, sondern die Folge einer
 *     benannten Eigenschaft: Ein Fremder, der die Login-Adresse kennt, kann
 *     diesen Versand auslösen. Die Mail ist der einzige Ort, an dem das
 *     Mitglied davon erfährt — und der einzige, an dem es erfahren kann, dass
 *     nichts passiert ist, solange es nicht klickt.
 *  3. **Kein Aktivierungs-Wortlaut.** Wer hier landet, hat seinen Zugang längst
 *     bestätigt. „Zugang freischalten" wäre schlicht falsch.
 */
export function renderPasswordReset(opts: { name: string; url: string }): RenderedEmail {
  const { html: anrede, text: anredeText } = anreden(opts.name);
  const subject = "Neues Passwort für deinen Zugang zu eff.bee.zee";

  const html = rahmen({
    titel: "Neues Passwort setzen",
    url: opts.url,
    knopf: "Neues Passwort setzen",
    koerper: `              <p style="margin:0 0 16px;">${anrede}</p>
              <p style="margin:0 0 16px;">für deinen Zugang zu <strong style="color:#f5f0e1;">eff.bee.zee</strong>
                wurde ein neues Passwort angefordert. Über den Knopf unten vergibst du es selbst — dein altes
                brauchst du dafür nicht.</p>`,
    nachsatz: `              <p style="margin:0 0 16px;">Der Link gilt 72 Stunden und lässt sich nur einmal verwenden.
                Sobald du das neue Passwort gesetzt hast, wirst du auf <strong style="color:#f5f0e1;">allen
                Geräten abgemeldet</strong> und meldest dich einmal neu an — auch dort, wo du eingeloggt warst.</p>
              <p style="margin:0;">Du hast das nicht angefordert? Dann ignoriere diese Mail. Dein bisheriges
                Passwort gilt unverändert weiter, und ohne den Klick passiert nichts.</p>`,
  });

  const text =
    `${anredeText}\n\n` +
    `für deinen Zugang zu eff.bee.zee wurde ein neues Passwort angefordert. ` +
    `Über den Link unten vergibst du es selbst — dein altes brauchst du dafür ` +
    `nicht.\n\n` +
    `${opts.url}\n\n` +
    `Der Link gilt 72 Stunden und lässt sich nur einmal verwenden. Sobald du ` +
    `das neue Passwort gesetzt hast, wirst du auf allen Geräten abgemeldet und ` +
    `meldest dich einmal neu an — auch dort, wo du eingeloggt warst.\n\n` +
    `Du hast das nicht angefordert? Dann ignoriere diese Mail. Dein bisheriges ` +
    `Passwort gilt unverändert weiter, und ohne den Klick passiert nichts.\n\n` +
    `Herzliche Grüße\nDetlev Kraft\nFair Business Club\n\n` +
    `Fragen? Schreib uns an info@fairbusinessclub.de`;

  return { subject, html, text };
}
