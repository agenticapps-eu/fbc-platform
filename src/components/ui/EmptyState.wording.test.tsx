import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Leere Bereiche laden ein, statt einen Mangel zu melden (AGE-494).
 *
 * Am 17.08. loggen sich ~70 Menschen zum ersten Mal ein und sehen fast überall
 * leere Bereiche — das ist der erste Eindruck der gesamten Plattform. Der Test
 * hält die Formulierungsregel fest, damit sie nicht beim nächsten neuen Bereich
 * still wieder verloren geht.
 *
 * Bewusst eine Textprüfung über den Quelltext: die Regel ist eine über den
 * Wortlaut, und die ließe sich am gerenderten Baum nur Seite für Seite prüfen —
 * genau das würde man beim nächsten neuen Leerzustand vergessen.
 */

/**
 * Formulierungen, die einen Mangel melden statt einen Weg zu zeigen.
 *
 * Bewusst die Wortlaute, die in diesem Change TATSÄCHLICH ersetzt wurden — eine
 * Liste erfundener Muster („Keine Daten", „Nichts vorhanden") wäre grün per
 * Konstruktion gewesen und hätte nie etwas gehalten.
 */
const VERBOTEN = [
  /title=["']Noch keine Events/i,
  /title=["']Noch keine Konversationen/i,
  /title=["']Noch keine Mitglieder/i,
  /["']Keine Treffer["']/i,
];

function quelldateien(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      // src/vision/ ist eingefrorener Entwurf und rendert nie (siehe App.test.tsx).
      if (name === "vision" || name === "test") continue;
      quelldateien(pfad, acc);
    } else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) {
      acc.push(pfad);
    }
  }
  return acc;
}

describe("Wortlaut leerer Zustände (AGE-494)", () => {
  const dateien = quelldateien("src").map((f) => [f, readFileSync(f, "utf8")] as const);

  it.each(VERBOTEN)("keine EmptyState-Überschrift matcht %s", (muster) => {
    const treffer = dateien.filter(([, inhalt]) => muster.test(inhalt)).map(([f]) => f);
    expect(treffer).toEqual([]);
  });

  /* Der Kern der Regel: ein leerer Bereich, in dem das Mitglied selbst etwas tun
     kann, bietet die Handlung auch an. Geprüft an den Stellen, die am 17.08. beim
     Erstlogin garantiert leer sind. */
  it.each([
    ["src/components/community/CommunityFeed.tsx", "Aktivität"],
    ["src/components/community/MemberDirectory.tsx", "Mitglieder"],
    ["src/pages/ChatPage.tsx", "Chat"],
    ["src/components/mein-bereich/events-widget.tsx", "Meine Events"],
    ["src/pages/ProfilAnsichtPage.tsx", "Mein Profil"],
    // Die Academy ist seit AGE-533 hier statt in der Gegenprobe unten: sie
    // rendert nicht mehr IMMER Inhalt. Der kuratierte Block steht zwar fest,
    // aber die beiden Reiter speisen sich aus `posts` mit Video — und die sind
    // am 17.08. garantiert leer.
    ["src/pages/AcademyPage.tsx", "Academy"],
  ])("%s (%s) bietet im Leerzustand eine Handlung an", (datei) => {
    const inhalt = readFileSync(datei, "utf8");
    expect(inhalt).toMatch(/<EmptyState/);
    // Eine Handlung ist entweder ein `action`-Prop am EmptyState oder — beim Feed —
    // ein daneben stehendes Eingabefeld.
    expect(inhalt).toMatch(/action=\{|<PostComposer/);
  });

  /* Gegenprobe zur Regel: Seiten, die IMMER Inhalt rendern, bekommen bewusst
     keinen Leerzustand. Ohne diesen Test liest sich ihr Fehlen wie ein Versäumnis
     und jemand baut einen ein, der nie erscheinen kann. */
  it.each(["src/pages/MitgliedschaftPage.tsx"])(
    "%s trägt bewusst KEINEN Leerzustand",
    (datei) => {
      expect(readFileSync(datei, "utf8")).not.toMatch(/<EmptyState/);
    },
  );
});
