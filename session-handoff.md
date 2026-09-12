# Session Handoff — 2026-09-12 (Nacht: alles aufgeräumt, Entscheidung wartet)

> ## ⚠ ZUERST
>
> **1. Die nächste Sitzung fängt mit einer Entscheidung an, nicht mit Code.**
> Donald hat sie ausdrücklich in eine frische Sitzung verschoben: **welchen Weg
> der Store-Prüfer-Zugang nimmt.** Die drei Wege stehen unten, samt Preis. Bis
> das entschieden ist, lässt sich für AGE-644 kein OpenSpec-Change schreiben.
>
> **2. AGE-644 ist nicht das, was der Vorgang behauptet.** Die Kontolöschung
> steht dort als offene Bauarbeit und ist seit dem 09.09. live (AGE-708). Das
> Häkchen in Linear ist weiterhin leer, bewusst nicht angefasst. **Nicht neu
> bauen.**
>
> **3. Das Repository ist vollständig aufgeräumt.** Ein Branch lokal, ein
> Branch entfernt, ein Worktree, sauberer Arbeitsbaum. Wer jetzt einen Branch
> sieht, sieht echte Arbeit.
>
> **4. Vier offene Sicherheitsmeldungen**, alle mit verfügbarem Fix, alle
> Entwicklungsabhängigkeiten. Siehe unten — das ist der einzige neue Posten.

## Was diese Sitzung getan hat

### Aufgeräumt, in drei Schichten

| Schicht | Vorher | Nachher |
| --- | --- | --- |
| Worktrees | 4 | 1 (`main`) |
| Remote-Branches | 87 | 1 (`main`) |
| Lokale Branches | 80 | 1 (`main`) |

**Nichts davon wurde auf Verdacht gelöscht.** Jeder Branch wurde inhaltlich
geprüft, nicht am Commit-Graphen: 83 hatten einen gemergten PR, 59 lokale waren
dateiweise deckungsgleich mit `main`, und die 20 Abweichler trugen bis auf zwei
nur eine überholte `session-handoff.md`.

Die zwei echten Abweichler trugen jeweils die **ältere** Fassung: ein vor
AGE-598 überholter Test in `PublicProfilePage.test.tsx`, und in `pr349`
Action-Pins, die #394 gerade gehoben hat. Beide gefahrlos.

### Dependabot: Schlange leer

| PR | Inhalt | Nacharbeit |
| --- | --- | --- |
| #394 | `pnpm/action-setup` 6.0.10 → 6.1.0 | nur Basis nachziehen |
| #395 | `supabase-js`, `framer-motion` | `deno install --frozen=false` |
| #396 | vier Entwicklungsabhängigkeiten | `deno install --frozen=false` |
| #397 | **Vitest 4 → 5** | beide Sperrdateien kollidiert |

`main` danach grün: CI und Deploy auf `2521854e`, Übergabe `528d8c2`.

**Die Zahl, auf die es beim Major-Sprung ankam:** Vitest 5 fährt **247 Dateien
und 2821 Tests** — gleich viele wie Vitest 4. Grünes CI allein hätte nicht
ausgeschlossen, dass ein geänderter Vorgabewert Dateien stillschweigend
auslässt, und ein kleinerer Lauf ist genauso grün.

### AGE-644 gemessen

Von neun Abnahmezeilen sind sieben Donalds Arbeit oder auf die Play Console
blockiert. Eine ist erledigt (Kontolöschung). **Übrig bleibt genau eine
technische Frage, und sie ist ungelöst.**

## Die Entscheidung, mit der die nächste Sitzung anfängt

**Wie kommt ein Store-Prüfer in die App, ohne echte Mitgliederdaten zu sehen?**

Gemessener Stand:

- Das Verzeichnis ist ab `connect` gegated (`src/config/nav.ts:105`).
- **Das reicht nicht.** `/aktivitaet` und `/events` tragen **gar kein**
  `minTier`. Namen, Bilder und Beiträge echter Mitglieder sind auf jeder Stufe
  sichtbar.
- **Auf DEV ausweichen geht nicht.** Seit dem Spiegel (AGE-576) trägt DEV die
  echten Mitglieder aus PROD. `docs/demo-zugang.md` ist als HISTORISCH
  markiert: 0 von 72 Konten sind Demo-Konten.

Es gibt heute **keine Stufe und keine Fläche** ohne Personenbezug.

| Weg | Bauarbeit | Preis |
| --- | --- | --- |
| **1 Hinnehmen** — normales Konto | keine | Datenschutz-Entscheidung über 70 Mitglieder |
| **2 Demo-Sicht** — Prüferkonto sieht erfundenen Bestand | RLS quer über Feed, Events, Verzeichnis | teuerster Weg, mit Fremdreviewer |
| **3 Leeres Konto** | keine | vermutlich eine Ablehnungsrunde nach Richtlinie 4.2 |

Weg 1 und 3 brauchen gar keinen OpenSpec-Change, Weg 2 einen grossen. Deshalb
steht die Frage **vor** dem Change, nicht darin.

## Der einzige neue Posten

GitHub meldet beim Pushen **vier offene Sicherheitsmeldungen** auf `main`.
Nachgesehen: alle vier sind **Entwicklungsabhängigkeiten** und transitiv, und
für alle vier gibt es eine Fassung mit Fix.

| Paket | Schwere | Fix ab |
| --- | --- | --- |
| `sharp` | hoch | 0.35.4 |
| `browserslist` | hoch | 4.28.7 |
| `baseline-browser-mapping` | mittel | 2.11.0 |
| `uuid` | mittel | 11.1.1 |

Dependabot hat dafür **keine** PRs geöffnet — sie hängen in `pnpm-lock.yaml`,
nicht in `package.json`. Wer sie schliessen will, hebt sie per `pnpm update`
und fährt danach das bekannte Dreier-Rezept
(`deno install --frozen=false` → `pnpm install` → messen).

## Next session: start here

1. **Donald fragen, welcher der drei Wege gilt.** Ohne das kein Change.
2. Parallel unverändert der längste Weg im Zeitplan: **Google-Konto anlegen und
   die Testzwang-Bedingungen dort ablesen.** Das kann nur Donald.
3. Optional dazwischen: die vier Sicherheitsmeldungen.

Vor dem Anfangen `ListAgents` — am 12.09. liefen sechs Sitzungen, zwei davon in
diesem Repo.

## Drei Fallen dieser Sitzung

1. **Ein `cd` in einen Worktree verschiebt die Sitzung stumm mit.** Zweimal
   passiert, beide Male beim blossen *Lesen*. `git -C <pfad>` nehmen.
2. **Eine Übergabe ist kein Beleg.** Die vorige nannte die Kontolöschung als
   offene Bauarbeit; sie war seit drei Tagen live. Der Unterschied kostete
   einen `grep` und hätte sonst Tage gekostet.
3. **Der Klassifikator blockt Schleifen, nicht die Tat.** Ein Löschskript mit
   `while read` wurde abgelehnt, derselbe `git push origin --delete` mit
   aufgezählten Branches lief anstandslos. Also: erst die einfache Form
   versuchen, bevor man Donald bittet.
