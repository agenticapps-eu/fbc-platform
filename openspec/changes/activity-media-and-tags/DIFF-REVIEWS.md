---
reviewers: [codex, claude]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
scope: git diff main...HEAD
reviewed_at: 2026-08-12
---

# Diff review — activity-media-and-tags (AGE-528)

Schritt 4, auf dem **Diff** statt auf dem Plan. `REVIEWS.md` ist das
Plan-Review von Schritt 2b und bleibt unberührt.

## Ein Reviewer ist NICHT fremd, und das zählt

Angefordert waren zwei Anbieter, beide andere als der Verfasser des Diffs
(Claude). Bekommen haben wir **einen**: `codex`. Der zweite Lauf war als
CodeRabbit angesetzt, aber die CodeRabbit-CLI ist auf dieser Maschine nicht
installiert — der Agent hat das gesagt und das Review **selbst** durchgeführt,
also als Claude. Es ist damit kein Fremd-Review, sondern ein zweiter Blick
desselben Anbieters, der den Diff geschrieben hat.

Das steht hier, statt die Zeile `reviewers: [codex, coderabbit]` zu schreiben
und die Sache damit auf sich beruhen zu lassen. Es ändert nichts an der Güte
der einzelnen Befunde — der schwerste stammt von beiden unabhängig —, aber es
ändert, wie viel Deckung dieses Review gibt. Wer die zwei Anbieter braucht,
installiert die CLI und lässt den zweiten Lauf nachholen.

## Die beiden schweren Befunde

**1. Query-Key-Kollision** (claude, HIGH) — `useInfiniteQuery` im Feed und
`useQuery` auf Startseite und Mitglieder-Übersicht lagen auf demselben
Schlüssel `["feed","list",uid,null]` und legten dort unvereinbare Formen ab
(`{pages}` gegen `{posts,nextCursor}`). Wer von `/` nach `/aktivitaet` wechselte,
sah „Noch keine Beiträge" über einem vollen Feed; umgekehrt verlor die
Startseite ihre Beiträge. Das heilte nur, weil `staleTime` überall 0 ist — ein
später gesetztes `staleTime` machte es dauerhaft.
→ **Behoben:** eigener Schlüssel `feedSeitenKey`, mit dem Anhängsel am Ende,
damit `feedListKey` weiter als Invalidierungs-Präfix greift. Test: ein
vorbelegter Eintrag der Startseite darf den Feed nicht leer erscheinen lassen.

**2. `create_post_with_media` prüft den `storage_path` nicht** (codex und claude
unabhängig, HIGH) — die Funktion ist `SECURITY DEFINER`, umgeht also
`post_media_insert_own`, und selbst diese Policy prüft nur den Beitrag, nie den
Pfad. Der Weg: ein Mitglied liest ab Rang 4 den `storage_path` eines fremden
`members`-Beitrags, wartet auf dessen Löschung — die Zeile fällt per Kaskade,
das Objekt bleibt liegen (benannt in den Non-goals) — und hängt den verwaisten
Pfad an seinen eigenen `public`-Beitrag. Danach signiert `anon` ein Bild, das
nie öffentlich war. `unique (storage_path)` hält das nur auf, solange die alte
Zeile lebt.
→ **Behoben:** die RPC verlangt, dass der erste Pfadabschnitt die Kennung des
Aufrufers ist — dieselbe Prüfung, die die INSERT-Policy des Buckets macht, nur
zum Zeitpunkt des Zeilen-Inserts. Das widerspricht **nicht** der Regel, dass
`post_media_lesbar` den Pfad nie zerlegt: dort würde aus dem Pfad eine
Sichtbarkeit abgeleitet, hier eine Eigentümerschaft gespiegelt. pgTAP §19.7a,
vorher rot.

## Zwei falsche Sätze in Entscheidungs-Köpfen

**3. Der GIN-Index, den es nie gab** (claude, MEDIUM). `20260812090200_tags.sql`
und `design.md` begründen den Verzicht auf eine Verknüpfungstabelle unter
anderem damit, dass „`.contains(…)` und ihr GIN-Index unverändert
weiterarbeiten". Es gibt fünf GIN-Indizes in diesem Repo und keinen auf
`posts.hashtags`.

**4. Kein Index für die neue Sortierung** (claude, MEDIUM). `(created_at desc,
id desc)` wird von `posts_visibility_created_at_idx` nicht bedient — dessen
führende Spalte ist `visibility`.

→ **Beides behoben und gemessen**, mit `set enable_seqscan = off`, also unter
einem Kostenaufschlag von 1e10 auf den Seq-Scan:

| | vorher | nachher |
|---|---|---|
| `order by created_at desc, id desc` | Seq Scan + Sort | **Index Only Scan**, kein Sort |
| `hashtags @> array[…]` | Seq Scan | **Bitmap Index Scan** |

Das ist kein Zeilenzahl-Argument: der Planer hätte jeden passenden Index
genommen und blieb beim Seq-Scan, weil keiner existierte.
`20260812090300_posts_indizes.sql`; die zwei falschen Sätze sind korrigiert und
als Korrektur gekennzeichnet.

## Weiter behoben

| Befund | Von | Was jetzt gilt |
|---|---|---|
| Veröffentlichen war möglich, **während Bilder noch verkleinert werden** — der Beitrag ging ohne sie raus | codex | „Posten" ist gesperrt, solange eine Verarbeitung läuft |
| Ein Fehlschlag des **ganzen** Signatur-Aufrufs galt als Erfolg und wurde 50 min gecacht; ohne `<img>` löste auch kein Bildfehler ein Nachsignieren aus | codex | wirft jetzt, statt `{}` zurückzugeben |
| Bei genau 20 sichtbaren Beiträgen versprach der Cursor eine **garantiert leere** nächste Seite | codex | eine Spähzeile (`limit 21`) entscheidet das, nicht die Seitenlänge |
| `key = lower(label)` war zugesagt, aber nur an den 15 Startzeilen geprüft — eine spätere redaktionelle Ergänzung läuft an keiner Suite vorbei | codex | eigener Constraint `tags_key_ist_label`, pgTAP dazu |
| Die Sechser-Grenze las einen **Schnappschuss** von `bilder.length`; zwei rasche Auswahlen kamen daran vorbei | beide | die Grenze steht im Zustandswechsel selbst |
| Der Nachsignier-Wächter merkte sich den **Pfad**, nicht die URL — nach dem zweiten Ablauf blieb die Kachel dauerhaft kaputt | beide | Wächter je URL: kaputt bleibt kaputt, abgelaufen bekommt seinen Versuch |
| Ein Fehler der Tag-Abfrage ließ die Filterleiste **still** verschwinden | claude | gemeldet und leere Liste, wie bei Zählern und Bildzeilen |
| `shrinkToWebp` prüfte die **1-MiB-Grenze des Buckets** nie; der Bruch fiel erst beim Hochladen auf | claude | misst und kodiert notfalls mit weniger Qualität nach |
| `width`/`height` waren wirkungslos, weil `aspect-4/3` die Box ohnehin setzt | claude | das Einzelbild behält sein echtes Seitenverhältnis |
| Die Trigger-Funktion erbte ihre Rechte | claude | `revoke execute`, wie die beiden anderen Funktionen der Datei |

## Gemessen statt geglaubt

**Die Locale-Abhängigkeit von `[[:alnum:]]`** (claude, MEDIUM) — die Sorge war,
`db push` könnte auf DEV/PROD an der Startbefüllung scheitern, weil
`persönlichkeitsentwicklung` dort durch den Constraint fällt. Auf DEV
nachgesehen: `en_US.UTF-8`, Umlaut **true**, Bindestrich und Leerzeichen
**false** — genau wie lokal. Für PROD steht die Prüfung in 10.5.

## Nicht behoben, mit Begründung

- **Bilder 4–6 sind unerreichbar** (claude, MEDIUM). Schema, Trigger und
  Composer erlauben sechs; das Raster zeigt vier, und die vierte Kachel liegt
  unter dem „+n". Ohne Lightbox sieht sie niemand. Das ist **so spezifiziert**
  (7.2), aber der Reviewer hat recht, dass die Kombination unfertig ist. Es ist
  eine Produktentscheidung — Lightbox nachziehen oder die Auswahl auf vier
  begrenzen —, und die trifft nicht der Autor beim Aufräumen. **Offen, Donald
  vorgelegt.**
- **Der Sechser-Trigger ist nicht wettlaufsicher** (codex, MEDIUM). Zwei
  gleichzeitige Direkt-Inserts sehen je fünf Zeilen und schreiben zusammen
  sieben. Steht so im Migrationskopf: der einzige Client-Weg ist die RPC, und
  die schreibt alle Zeilen in einer Anweisung. Dieselbe Klasse wie der bekannte
  `regs_write_own`-Bypass. Benannt, nicht geschlossen.
- **`created_at` ist änderbar** (codex, MEDIUM). Wird ein geladener Beitrag
  zurückdatiert, kann er doppelt erscheinen. Kein Code-Pfad ändert
  `posts.created_at`; die Spalte hat keinen Update-Weg in der Anwendung.
- **Die Storage-UPDATE-Policy erlaubt, die Bytes eines veröffentlichten Bildes
  zu ersetzen** (claude, LOW), während `post_media` bewusst kein UPDATE-Recht
  hält. Der Widerspruch ist echt, die Wirkung gering: es ist das eigene Bild am
  eigenen Beitrag, und Löschen-und-neu-Posten stünde ohnehin offen. `avatars`
  und `covers` tragen dieselbe Policy — eine Abweichung nur hier wäre die
  teurere Uneinheitlichkeit.
- **Ein zweiter Anlauf nach Fehlschlag lädt unter neuer `postId` erneut hoch**
  (codex, LOW) und lässt die Objekte des ersten liegen. Das ist die benannte
  Speicherschuld aus den Non-goals.
- **Blob-URLs der Vorschau werden beim Wegnavigieren nicht widerrufen**
  (codex, LOW). Sie fallen mit dem Dokument. Notiert.
- **Startseite und Mitglieder-Übersicht holen `post_media` mit, ohne es zu
  zeigen** (claude, LOW). Ein zusätzlicher, paralleler Rundlauf auf einer Seite,
  die ohnehin drei Abfragen macht. Ein Schalter dafür wäre Flexibilität für
  einen Fall, der nichts kostet.

## Offene Test-Lücken, benannt statt übergangen

- Die **Storage-UPDATE- und DELETE-Policies** werden in `rls_test.sql` nur
  gezählt und auf das Vorkommen von `is_activated` geprüft (codex, LOW). Eine
  kaputte Eigentümerprüfung in diesen beiden fiele der Suite nicht auf. Der
  INSERT-Weg ist gemessen, das Prädikat ist in allen dreien dasselbe — aber
  gemessen ist eben nur eines.
- Der Test zu `staleTime` prüft **nur das Verhältnis der beiden Konstanten**
  (codex, LOW), nicht, dass jemand sie benutzt. Das steht jetzt als Kommentar
  im Test, statt dass sein Name mehr verspricht, als er hält.
