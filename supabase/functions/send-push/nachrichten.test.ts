// deno test --allow-none  (aus supabase/functions/send-push/)
//
// Was hier NICHT geprueft wird, weil es woanders zugesagt ist: dass ein
// unverzeichneter Typ, ein abgeschalteter Schalter oder ein gesperrtes Konto
// nichts zustellt. Das entscheidet `push_auftraege_holen`, und
// `supabase/tests/push_zustellung_test.sql` misst es. Hier steht nur, was der
// Transport selbst falsch machen koennte.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { baueBenachrichtigung, type Auftrag } from "./nachrichten.ts";

const auftrag = (over: Partial<Auftrag> = {}): Auftrag => ({
  notification_id: "hinweis-1",
  token_id: "token-1",
  token: "geraetetoken",
  plattform: "ios",
  typ: "message",
  wer: "Bodo Bauer",
  ziel_id: "faden-7",
  ...over,
});

Deno.test("message: Wer, nicht was — und ein Ziel im Gespraech", () => {
  const n = baueBenachrichtigung(auftrag());
  assertEquals(n.titel, "Neue Nachricht");
  assertEquals(n.text, "Bodo Bauer hat Ihnen geschrieben.");
  assertEquals(n.ziel, "/chat/faden-7");
});

Deno.test("message ohne Kennung fuehrt in die Uebersicht, nicht nach /chat/undefined", () => {
  assertEquals(baueBenachrichtigung(auftrag({ ziel_id: null })).ziel, "/chat");
  assertEquals(baueBenachrichtigung(auftrag({ ziel_id: "   " })).ziel, "/chat");
});

Deno.test("eine Kennung mit Sonderzeichen wird kodiert", () => {
  assertEquals(baueBenachrichtigung(auftrag({ ziel_id: "a/b?c" })).ziel, "/chat/a%2Fb%3Fc");
});

Deno.test("die drei Kontaktanfrage-Typen sagen ihren eigenen Satz", () => {
  assertEquals(
    baueBenachrichtigung(auftrag({ typ: "contact_request" })).text,
    "Bodo Bauer möchte Sie kennenlernen.",
  );
  assertEquals(
    baueBenachrichtigung(auftrag({ typ: "contact_request_accepted" })).text,
    "Bodo Bauer hat Ihre Kontaktanfrage angenommen.",
  );
  assertEquals(
    baueBenachrichtigung(auftrag({ typ: "contact_request_declined" })).text,
    "Bodo Bauer hat Ihre Kontaktanfrage abgelehnt.",
  );
});

Deno.test("ein Typ ohne Satz nennt keinen Bezeichner aus unserer Datenbank", () => {
  const n = baueBenachrichtigung(auftrag({ typ: "post_created_v2" }));
  assertEquals(n.text.includes("post_created_v2"), false);
  assertEquals(n.titel.includes("post_created_v2"), false);
  assertEquals(n.text, "Es gibt etwas Neues.");
});

Deno.test("ein leerer Name faellt auf den allgemeinen Wortlaut zurueck", () => {
  assertEquals(baueBenachrichtigung(auftrag({ wer: "   " })).text, "Ein Mitglied hat Ihnen geschrieben.");
});

// Die Zusage aus `tasks.md`: keine Nutzlast im Text. Sie haelt hier auf zwei
// Ebenen — die Funktion nimmt drei Felder entgegen, und selbst ein Aufrufer,
// der ihr Freitext UNTERSCHIEBT, bekommt ihn nirgends wieder heraus.
Deno.test("untergeschobener Freitext erreicht keinen der drei Ausgaenge", () => {
  const geheim = "Streng vertraulicher Altbestand";
  const n = baueBenachrichtigung({
    ...auftrag(),
    // So kaeme er an, wenn jemand die feste Feldliste der RPC aufweichte.
    message: geheim,
    payload: { message: geheim },
  } as unknown as Auftrag);

  assertStringIncludes(n.text, "hat Ihnen geschrieben.");
  assertEquals(`${n.titel}|${n.text}|${n.ziel}`.includes(geheim), false);
});

Deno.test("auch Token und Hinweis-Kennung stehen nie im Text", () => {
  const n = baueBenachrichtigung(auftrag({ typ: "contact_request" }));
  const sichtbar = `${n.titel}|${n.text}|${n.ziel}`;
  assertEquals(sichtbar.includes("geraetetoken"), false);
  assertEquals(sichtbar.includes("hinweis-1"), false);
});
