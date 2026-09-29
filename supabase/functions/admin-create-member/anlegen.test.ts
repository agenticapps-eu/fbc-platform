import { assertEquals } from "jsr:@std/assert@1";
import {
  CLUB_PLAENE,
  gleicheAdresse,
  parseCreateRequest,
  zusammenfassen,
} from "./anlegen.ts";

Deno.test("parseCreateRequest nimmt die vier Pflichtfelder", () => {
  assertEquals(
    parseCreateRequest({
      vorname: "Anna",
      nachname: "Berg",
      email: "anna@example.test",
      plan: "focus",
      mailSenden: true,
    }),
    {
      name: "Anna Berg",
      email: "anna@example.test",
      plan: "focus",
      mailSenden: true,
      firma: null,
      telefon: null,
    },
  );
});

Deno.test("parseCreateRequest normalisiert die Adresse", () => {
  // Tragend, nicht bequem: der Unique-Index auf `auth.users(email)` ist
  // partiell UND schreibungsempfindlich. Ohne diese Zeile entstünde `A@X.de`
  // neben `a@x.de` als zweites Konto.
  const r = parseCreateRequest({
    vorname: " Anna ",
    nachname: " Berg ",
    email: "  Anna@Example.TEST  ",
    plan: "discover",
    mailSenden: false,
  });
  assertEquals(r?.email, "anna@example.test");
  assertEquals(r?.name, "Anna Berg");
});

Deno.test("parseCreateRequest lässt nur die drei Clubstufen zu", () => {
  assertEquals(CLUB_PLAENE, ["discover", "focus", "impact"]);
  for (const plan of CLUB_PLAENE) {
    assertEquals(
      parseCreateRequest({
        vorname: "A", nachname: "B", email: "a@b.test", plan, mailSenden: true,
      })?.plan,
      plan,
    );
  }
  // Die drei Stufen ausserhalb des Clubs sind keine Wahl: ein Mitglied, das
  // bezahlt hat, dort anzulegen wäre genau der Fehler, den die Stufenauswahl
  // in AGE-903 schon einmal ausgeschlossen hat.
  for (const plan of ["active", "boost", "connect", "basic", "exchange"]) {
    assertEquals(
      parseCreateRequest({
        vorname: "A", nachname: "B", email: "a@b.test", plan, mailSenden: true,
      }),
      null,
    );
  }
});

Deno.test("parseCreateRequest weist Unbrauchbares ab", () => {
  const gut = {
    vorname: "A", nachname: "B", email: "a@b.test", plan: "focus", mailSenden: true,
  };
  assertEquals(parseCreateRequest(null), null);
  assertEquals(parseCreateRequest({ ...gut, vorname: "  " }), null);
  assertEquals(parseCreateRequest({ ...gut, nachname: "" }), null);
  assertEquals(parseCreateRequest({ ...gut, email: "keine-adresse" }), null);
  assertEquals(parseCreateRequest({ ...gut, mailSenden: "ja" }), null);
});

Deno.test("parseCreateRequest nimmt Firma und Telefon, wenn sie da sind", () => {
  const r = parseCreateRequest({
    vorname: "A", nachname: "B", email: "a@b.test", plan: "impact",
    mailSenden: true, firma: " Berg GmbH ", telefon: " +49 89 1 ",
  });
  assertEquals(r?.firma, "Berg GmbH");
  assertEquals(r?.telefon, "+49 89 1");
  // Leer heisst null und nicht "" — ein leerer String in der Spalte sähe aus
  // wie eine erfasste, aber leere Angabe.
  assertEquals(
    parseCreateRequest({ ...{ vorname: "A", nachname: "B", email: "a@b.test", plan: "impact", mailSenden: true }, firma: "   " })?.firma,
    null,
  );
});

Deno.test("gleicheAdresse vergleicht ohne Rücksicht auf Schreibung", () => {
  assertEquals(gleicheAdresse("Anna@Example.TEST", "anna@example.test"), true);
  assertEquals(gleicheAdresse(" anna@example.test ", "anna@example.test"), true);
  assertEquals(gleicheAdresse("anna@example.test", "anne@example.test"), false);
});

Deno.test("zusammenfassen: der Normalfall", () => {
  assertEquals(
    zusammenfassen({ kontoAngelegt: true, profilGesetzt: true, mailSenden: true, versandOk: true }),
    { status: "ok", schritt: "bestaetigungsmail_verschickt" },
  );
  assertEquals(
    zusammenfassen({ kontoAngelegt: true, profilGesetzt: true, mailSenden: false, versandOk: false }),
    { status: "ok", schritt: "ohne_mail_angelegt" },
  );
});

Deno.test("zusammenfassen: das Konto bleibt, auch wenn der Rest scheitert", () => {
  // Der Fehlerfall INNERHALB der Anlage. Ein Rückbau wäre der schlechtere
  // Ausgang: er nähme dem Admin die einzige Spur. Das Konto steht dann in
  // Schritt „Angelegt" auf der Vorgabestufe und ist über „Stufe setzen"
  // zu berichtigen.
  assertEquals(
    zusammenfassen({ kontoAngelegt: true, profilGesetzt: false, mailSenden: true, versandOk: false }),
    { status: "teilweise", schritt: "stufe_nicht_gesetzt" },
  );
  // Und der Versand scheitert NACH dem Anlegen. Das Mitglied steht dann in
  // „Eingeladen", weil ein Link erzeugt wurde — die Antwort muss es sagen.
  assertEquals(
    zusammenfassen({ kontoAngelegt: true, profilGesetzt: true, mailSenden: true, versandOk: false }),
    { status: "teilweise", schritt: "mail_nicht_verschickt" },
  );
});

Deno.test("zusammenfassen: ohne Konto ist nichts entstanden", () => {
  assertEquals(
    zusammenfassen({ kontoAngelegt: false, profilGesetzt: false, mailSenden: true, versandOk: false }),
    { status: "fehlgeschlagen", schritt: "kein_konto" },
  );
});
