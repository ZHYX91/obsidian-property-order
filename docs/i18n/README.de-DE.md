# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Steuere Vorschläge und Listenwerte in Obsidian Properties.

- **[Vorschläge für Eigenschaftsnamen](#vorschläge-für-eigenschaftsnamen):** Namen wie `status` und `owner` beim Hinzufügen einer Eigenschaft anheften, ausblenden, gruppieren und sortieren.
- **[Vorschläge für Eigenschaftswerte](#vorschläge-für-eigenschaftswerte):** Für jede Eigenschaft festlegen, welche Werte angeboten werden, einschließlich eigener Vorgaben wie `todo`, `doing` und `done`.
- **[Listenwerte umordnen](#listenwerte-umordnen):** Listeneinträge per Ziehen oder Befehlspalette umordnen oder zwischen unterstützten Eigenschaften derselben Notiz verschieben.

Die Funktionen sind unabhängig voneinander. Property Order verwaltet Vorschläge und Listenwerte; die Eigenschaftsfelder selbst werden in einer Notiz nicht umgestellt. Erfordert Obsidian 1.12.7 oder neuer auf Desktop oder Mobilgerät.

## Vorschläge für Eigenschaftsnamen

Finde häufig verwendete Namen leichter in Obsidians nativen Vorschlägen unter **Eigenschaft hinzufügen**.

1. Öffne **Einstellungen → Property Order → Namensvorschläge**.
2. Hefte häufig verwendete Namen an, stelle selten benötigte ans Ende und blende unerwünschte Namen mit exakten Namen oder Platzhalterregeln aus.
3. Wähle Nach Name, Zuletzt verwendet oder Notizen mit dieser Eigenschaft. Die optionale **Gruppierung nach Eigenschaftstyp** gruppiert normale Vorschläge nach Obsidian-Typ; angeheftete Namen bleiben vorn und ans Ende gesetzte Namen hinten.

Hefte beispielsweise `status` und `owner` an und blende `legacy_code` aus. Öffne in einer Notiz **Eigenschaft hinzufügen**, um das Ergebnis zu sehen. Diese Regeln ordnen nur Namen, die Obsidian bereits anbietet. Das Anheften erzeugt keinen neuen Vorschlag und verschiebt kein Feld in der Notiz.

Native Namensvorschläge vor dem Anwenden der Regeln:

![Native Vorschläge für Eigenschaftsnamen vor der Anpassung](../assets/property-order-key-suggestions-before.png)

Dieselben Vorschläge mit angehefteten häufigen Namen und einem ausgeblendeten unerwünschten Namen:

![Namensvorschläge mit angeheftetem status und owner sowie ausgeblendetem legacy_code](../assets/property-order-key-suggestions-after.png)

Zuletzt verwendet richtet sich nach bestätigten Hinzufügungen, nicht nach dem Überfahren oder Durchsehen von Vorschlägen. Nach Name und Zuletzt verwendet durchsuchen den Vault nicht. Die Sortierung nach Notizanzahl zählt anhand zwischengespeicherter Metadaten, wie viele Markdown-Notizen die jeweilige Eigenschaft enthalten.

## Vorschläge für Eigenschaftswerte

Steuere die Werte, die nach der Auswahl einer Eigenschaft angeboten werden, etwa `todo` und `done` für `status`. Diese Funktion ist **standardmäßig ausgeschaltet** und unabhängig von den Namensvorschlägen.

1. Öffne **Einstellungen → Property Order → Wertvorschläge** und aktiviere **Vorschläge für Eigenschaftswerte anpassen**.
2. Lege ein Standardverhalten für nicht zugewiesene Eigenschaften fest oder weise einem exakten Eigenschaftsnamen Wie Obsidian, Nach Name, Auswahlhäufigkeit, Notizen mit diesem Wert, Keine Vorschläge oder Eigene Vorschläge zu.
3. Für eine wiederverwendbare `status`-Liste füge eine Regelkarte **Eigene Vorschläge** hinzu, trage `status` ein und ergänze mit **Eigenen Vorschlag hinzufügen** die Werte `todo`, `doing` und `done`.

![Eigene status-Vorgaben beim Bearbeiten eines Eigenschaftswerts](../assets/property-order-value-suggestions.png)

Eigene Vorschläge bestehen aus angehefteten, normalen und am Ende platzierten Vorschlägen. Ausdrücklich eingetragene Werte bleiben auch verfügbar, wenn noch keine Notiz sie nutzt, und werden anhand deiner Eingabe gefiltert. **↔ (Zu normalen Vorschlägen)** hebt die feste Position auf, behält den Vorschlag aber bei. Das Entfernen einer Vorgabe aus den Einstellungen löscht keinen Notizinhalt.

Die Auswahlhäufigkeit zählt erst, wenn Obsidian bestätigt, dass der Wert geschrieben wurde. Die Notizanzahl zählt Markdown-Notizen mit diesem Wert, nicht deine Auswahlen. **Keine Vorschläge** lässt manuelle Eingaben weiterhin zu. Das Ändern von Vorschlagsregeln allein bearbeitet keine Notizen.

## Listenwerte umordnen

Ordne unterstützte YAML-Textlisten auf oberster Ebene direkt in Properties um oder verschiebe einen Wert in eine andere Listeneigenschaft derselben Notiz. Ziehen zwischen Eigenschaften ist standardmäßig aktiviert und lässt sich unter **Wertreihenfolge** ausschalten.

![Einen Wert zwischen Eigenschaften verschieben](../assets/property-order-cross-property-drag.gif)

- **Desktop:** Ziehe einen Wert an seine neue Position oder in eine andere unterstützte Listeneigenschaft.
- **Mobil:** Halte einen Wert gedrückt, wähle **Neu anordnen** oder **Neu anordnen oder verschieben** im nativen Obsidian-Menü und ziehe dann diesen Wert. Ist die Menüerweiterung nicht verfügbar, bleibt die native Bearbeitung erhalten; das Plugin ersetzt das Menü nicht durch eine Nachbildung.
- **Tastatur:** Starte **Property Order: Eigenschaftswerte umordnen** über die Befehlspalette. Wähle Quelleigenschaft und Wert und verschiebe ihn nach oben, unten, an eine Position ab 1, an den Anfang/das Ende oder ans Ende einer anderen Eigenschaft. Es gibt kein voreingestelltes Tastenkürzel. Der Befehl funktioniert auch bei ausgeschaltetem Ziehen; der Schalter für Ziehen zwischen Eigenschaften gilt nur für Zeigeraktionen.

Jedes abgeschlossene Umordnen oder Verschieben ist eine einzelne rückgängig zu machende Bearbeitung. Vor dem Start der Aktualisierung lassen **Escape** oder **Abbrechen** die Notiz unverändert. Sobald sie beginnt, warte auf den Abschluss und nutze bei Bedarf Rückgängig im Editor. Ziehen unterstützt umgebrochene und RTL-Layouts, Scrollen an unterstützten Panelrändern und Statusmeldungen für Screenreader.

**Prüfe vor dem Umordnen die Werttypen:** Nichttextliche Einträge in unterstützten Textlisten können zu Zeichenketten werden, etwa `true` zu `"true"` und `123` zu `"123"`. Dabei ändert sich der Datentyp. Prüfe das Ergebnis, wenn Zahlen- oder boolesche Typen wichtig sind.

**Aktuelles Format beibehalten ist der Standard.** Unter **Wertreihenfolge** kannst du Klammerlisten oder einen Eintrag pro Zeile wählen. Beim Wechsel zu Klammerlisten kannst du Kommentare oder Leerzeilen verlieren; behalte das aktuelle Format bei, wenn diese wichtig sind. Öffne **Formatbeispiele** neben **Listenformat nach dem Umordnen**, um die Optionen zu vergleichen.

## Installation

### Community-Erweiterungen (empfohlen)

Öffne in Obsidian **Einstellungen → Community-Erweiterungen → Durchsuchen**, suche nach **Property Order** und wähle **Installieren** und **Aktivieren**. Du kannst auch die [Seite in den Community-Erweiterungen](https://obsidian.md/plugins?id=property-order) öffnen. Die folgende ZIP-Anleitung brauchst du nur für eine manuelle Installation.

### Manuelle Installation

Lade `property-order-<version>.zip` von der [neuesten Veröffentlichung](https://github.com/ZHYX91/obsidian-property-order/releases/latest) herunter und entpacke es nach `Vault/.obsidian/plugins/`. Das Archiv enthält den Ordner `property-order/` mit `main.js`, `manifest.json` und `styles.css`. Lade Obsidian neu und aktiviere Property Order unter den Community-Erweiterungen.

### Aktualisieren

Sichere und behalte `Vault/.obsidian/plugins/property-order/data.json`, sofern die Datei vorhanden ist. Ersetze nur `main.js`, `manifest.json` und `styles.css`. Lösche `data.json` nur, wenn du ausdrücklich alle Plugin-Einstellungen zurücksetzen möchtest.

## Einstellungsübersicht

Alle unterstützten Obsidian-Versionen verwenden dieselben vier Registerkarten:

| Registerkarte | Zuständigkeit |
| --- | --- |
| **Allgemein** | Plugin-Sprache und optionale Diagnosehinweise. **Wie Obsidian** verwendet die passende Sprache oder ersatzweise Englisch. |
| **Wertreihenfolge** | Ziehen innerhalb und zwischen Eigenschaften sowie das Listenformat nach dem Umordnen. Das Ausschalten des Ziehens behält die separate Einstellung für Ziehen zwischen Eigenschaften bei. |
| **Namensvorschläge** | Angeheftete, ausgeblendete und ans Ende gesetzte Namen; Sortierung nach Name, letzter Verwendung und Notizanzahl; optionale Typgruppierung; Löschen des Verlaufs und ein Feld zum Testen von Regeln. |
| **Wertvorschläge** | Das ausdrücklich zu aktivierende Standardverhalten, Regeln je Eigenschaft, eigene Vorgaben und Löschen der Auswahlzähler. |

**Eigenschaftsreihenfolge auf dieser Seite** ordnet nur die Eigenschaften in Regelkarten und im eigenen Editor. Sie ändert weder Felder in Notizen noch die Reihenfolge der Wertvorschläge.

Oberfläche und README unterstützen Englisch, vereinfachtes und traditionelles Chinesisch, Deutsch, Französisch, Spanisch, brasilianisches Portugiesisch, Russisch, Japanisch, Koreanisch, Vietnamesisch und Arabisch.

## Kompatibilität und Einschränkungen

- Das Ziehen von Werten unterstützt normale YAML-Eigenschaftszeilen auf oberster Ebene, die Obsidian als Textlisten darstellt. Nicht unterstützt werden ganze Dokumente als `{ ... }`-Mapping, Objektlisten, verschachtelte Listen, mehrzeilige Flow-Listen, Zeilenziehen im Quellmodus und Verschieben zwischen Dateien.
- Leere oder skalare Werte können teilnehmen, wenn Obsidian ihre Eigenschaft als Liste erkennt. Einige Zeilen mit Typkonflikten funktionieren ebenfalls, wenn die einzelnen Werte eindeutig sind. Mehrdeutige Zeilen mit gemischten Werten werden vorsichtig behandelt und erlauben möglicherweise nur das Anhängen.
- Der Tastaturbefehl benötigt ein sichtbares, unterstütztes Properties-Panel im aktiven Markdown-Bereich. Ändern sich Datei oder Werte bei geöffnetem Dialog, öffne den Befehl erneut.
- Eigene Vorgaben erscheinen nur beim Bearbeiten von Werten in Properties. Ohne natives Vorschlagsfenster kann das Plugin sie neben dem Eingabefeld anzeigen. Kann es den Editor oder die native Vorschlagsoberfläche nicht sicher erkennen, bleiben normale Eingaben oder native Vorschläge verfügbar.
- Vor der Speicheranfrage an Obsidian prüft die Wertreihenfolge das YAML. Nicht unterstützter oder widersprüchlicher Inhalt bleibt unverändert. Die Auswahl oder Bearbeitung einer Eigenschaft in Obsidian kann die Notiz verändern; reine Vorschlagseinstellungen tun dies nicht.

## Datenschutz und Sicherheit

Property Order arbeitet lokal. Es benötigt kein Konto, lädt keine Notizinhalte hoch und ruft keine entfernten Dienste auf. Umordnen oder Verschieben ändert nur die beteiligten Eigenschaften.

Die Notizanzahl nutzt zwischengespeicherte Frontmatter-Metadaten, statt jeden Notiztext zu lesen. Der Verlauf zuletzt verwendeter Eigenschaftsnamen (höchstens 100 Namen) und bestätigte Wertauswahlzähler liegen nur im lokalen Speicher dieses Vaults auf dem aktuellen Gerät, getrennt von `data.json`. Sie werden nicht synchronisiert und lassen sich in den Einstellungen löschen. Überfahren, Durchsehen, Abbrechen und unbestätigte Bearbeitungen aktualisieren sie nicht.

## Entwicklung und Hilfe

Verwende Node.js 24.19.0 und npm 11.17.0. Installiere die in `package-lock.json` festgehaltenen Abhängigkeitsversionen und führe anschließend alle Repository-Prüfungen aus:

```bash
npm ci
npm run check
```

### Dokumentation

- [Produktanforderungen (English)](../product-requirements.en.md)
- [Interaktionsspezifikation (English)](../ux-spec.en.md)
- [Architektur (English)](../architecture.en.md)
- [Teststrategie (English)](../testing-strategy.en.md)
- [Änderungsprotokoll (English)](../../CHANGELOG.md)
- [Beitragsleitfaden (English)](../../CONTRIBUTING.md)
- [Sicherheitsrichtlinie (English)](../../SECURITY.md)

- [Fragen und Antworten (Q&A)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a): Fragen zur Verwendung und Einrichtung.
- [Ideen (Ideas)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas): Erste Ideen für Funktionen und Arbeitsabläufe.
- [Anwendungsbeispiele (Show and tell)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell): Tipps, Arbeitsabläufe und Referenzumsetzungen.
- Verwende für reproduzierbare Fehler und konkrete Funktionswünsche die strukturierten [GitHub-Issue-Formulare](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose).
- Melde Sicherheitslücken vertraulich über den in der [Sicherheitsrichtlinie](https://github.com/ZHYX91/obsidian-property-order/security/policy) beschriebenen Weg.

Entferne private Vault-Pfade, Notizinhalte, YAML-Werte und Zugangsdaten, bevor du etwas öffentlich veröffentlichst.

## Lizenz

[MIT](../../LICENSE) © ZhengYX
