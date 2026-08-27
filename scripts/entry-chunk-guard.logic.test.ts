import { describe, expect, it } from "vitest";

import { verbotereSeitenImEintritt } from "./entry-chunk-guard.logic";

describe("verbotereSeitenImEintritt", () => {
  it("meldet eine Seite, die im Eintrittsbündel nichts zu suchen hat", () => {
    const quellen = ["../src/pages/AdminNeuigkeitenPage.tsx", "../src/lib/chat.ts"];

    expect(verbotereSeitenImEintritt(quellen)).toEqual(["src/pages/AdminNeuigkeitenPage.tsx"]);
  });

  // Positivkontrolle zur Verneinung: ohne sie wäre ein Wächter, der IMMER
  // nichts meldet, von einem, der prüft, nicht zu unterscheiden.
  it("meldet nichts, wenn nur Erlaubtes im Bündel liegt", () => {
    const quellen = [
      "../src/pages/HomePage.tsx",
      "../src/pages/LoginPage.tsx",
      "../src/components/AppShell.tsx",
      "../src/lib/supabase.ts",
    ];

    expect(verbotereSeitenImEintritt(quellen)).toEqual([]);
  });

  it("hält Bauteile und Bibliotheken heraus, auch wenn Page im Namen steht", () => {
    const quellen = [
      "../src/components/mein-bereich/profil-widgets.tsx",
      "../node_modules/some-page-lib/dist/Page.tsx",
      "../src/lib/public-profile.ts",
    ];

    expect(verbotereSeitenImEintritt(quellen)).toEqual([]);
  });

  it("nennt jede Seite genau einmal, auch wenn die Map sie mehrfach führt", () => {
    const quellen = [
      "../src/pages/ChatPage.tsx",
      "../src/pages/ChatPage.tsx",
      "../src/pages/EventsPage.tsx",
    ];

    expect(verbotereSeitenImEintritt(quellen)).toEqual([
      "src/pages/ChatPage.tsx",
      "src/pages/EventsPage.tsx",
    ]);
  });

  it("nimmt eine eigene Erlaubnisliste an", () => {
    const quellen = ["../src/pages/ChatPage.tsx"];

    expect(verbotereSeitenImEintritt(quellen, ["src/pages/ChatPage.tsx"])).toEqual([]);
  });
});
