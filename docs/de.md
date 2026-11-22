# MeteoGalicia

Das amtliche Wetter **Galiciens** (Spanien) in Gladys, von **MeteoGalicia**, dem Wetterdienst der
**Xunta de Galicia**: die Messwerte der nächsten **automatischen Wetterstation** alle 10 Minuten,
die **Tagesvorhersage** einer Gemeinde (Concello) und ihre **Warnstufen** für heute, morgen und
übermorgen.

Offene Daten: kein Konto, kein API-Schlüssel. Diese Integration steht in keiner Verbindung zu
MeteoGalicia oder der Xunta de Galicia.

## Überblick

- **Zwei Geräte**: die nächste Station (Temperatur, Luftfeuchtigkeit, Luftdruck, Wind, Böen,
  Regen: was die Station misst) und eine Gemeinde (Vorhersage für heute und morgen, UV-Index,
  Warnstufen).
- **Ein Szenen-Auslöser**, „MeteoGalicia-Warnstufe erhöht“, sobald MeteoGalicia die Warnstufe der
  Gemeinde für heute, morgen oder übermorgen erhöht.
- **Ein Dashboard-Widget** mit den Messwerten, Minimum und Maximum der nächsten Tage, den
  Warnstufen und der Vorhersage für heute und morgen.
- **Nur lesend**: MeteoGalicia ist eine Datenquelle, nichts wird gesteuert.

## Voraussetzungen

- Gladys **5.3.0** oder neuer.
- Ein Ort in **Galicien**: eine seiner 313 Gemeinden, höchstens 40 km von einer
  MeteoGalicia-Station entfernt.
- Dein Gladys-Zuhause auf der Karte platziert (**Einstellungen → Zuhause**), oder Koordinaten, eine
  Station oder eine Gemeinde in der Konfiguration eingetragen.
- Gladys braucht Internetzugang (`servizos.meteogalicia.gal`).

## Konfiguration

Installiere die Integration über **Integrationen → Von GitHub installieren** (oder aus dem Store)
und öffne ihre Konfiguration. Alle Felder sind optional: Standardmäßig nimmt die Integration die
Position deines ersten platzierten Zuhauses, die nächste Station, die Gemeinde dieser Station, und
aktualisiert alle 10 Minuten.

| Feld                       | Verwendung                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Zuhause                    | Das Zuhause, dessen Position genutzt wird. Leer: das erste Zuhause mit Position.                                                |
| Breitengrad, Längengrad    | Ein anderer Ort als ein Zuhause, zum Beispiel `43,37` und `-8,40` (ein Punkt geht auch). Beide oder keiner.                     |
| Wetterstation              | Die ID einer MeteoGalicia-Station, zum Beispiel `10157` (A Coruña). Leer: die nächste.                                          |
| Gemeinde                   | INE-Code (`15030`) oder Name (`A Coruña`) der Gemeinde für Vorhersage und Warnungen. Leer: die der Station.                     |
| Aktualisierungsintervall   | 10, 15, 30 oder 60 Minuten. Die Stationen melden alle 10 Minuten.                                                               |
| Sprache der Funktionsnamen | Sprache der Funktionsnamen (beim Anlegen der Geräte festgelegt) und der Texte der Szenen-Ereignisse. Standardmäßig Französisch. |

Die Position des Zuhauses wird über die Gladys-Berechtigung `location` gelesen, die bei der
Installation angezeigt wird. Diese Position **verlässt Gladys nie**: Die Integration lädt die Liste der
Stationen herunter und wählt die nächste selbst aus; MeteoGalicia erhält nur öffentliche IDs (eine
Station, eine Gemeinde). Auch in die Protokolle wird sie nie geschrieben.

Die Standardgemeinde ist die **der nächsten Station**: MeteoGalicia veröffentlicht die Position der
Gemeinden nicht. Wohnst du nahe einer Gemeindegrenze, gib deine Gemeinde ein.

Öffne dann den Reiter **Entdeckung** der Integration und füge die beiden Geräte zu Gladys hinzu.

## Geräte

### Station

Der Name ist „MeteoGalicia“ gefolgt vom Namen der Station. Werte der letzten 10-Minuten-Messung:

| Funktion                 | Einheit | Hinweis                                                    |
| ------------------------ | ------- | ---------------------------------------------------------- |
| Temperatur               | °C      | Lufttemperatur in 1,5 m                                    |
| Taupunkt                 | °C      |                                                            |
| Luftfeuchtigkeit         | %       |                                                            |
| Luftdruck (Meeresniveau) | hPa     | Auf Meeresniveau reduzierter Luftdruck, wie in Vorhersagen |
| Windgeschwindigkeit      | km/h    | Mittel der 10 Minuten, in 10 m (oder 2 m)                  |
| Windböen                 | km/h    | Stärkste Böe der 10 Minuten                                |
| Windrichtung             | °       | Woher der Wind kommt: 0 = Nord, 90 = Ost                   |
| Regenintensität          | mm/h    | Regen der letzten 10 Minuten als Stundenrate (× 6)         |

Eine Station erhält nur die Funktionen dessen, was sie misst (etwa ein Drittel der Stationen hat
weder Wind noch Luftdruck): Eine einmal hinzugefügte Funktion bleibt, auch wenn die Station sie
nicht mehr sendet. Nur Werte, die MeteoGalicia als gültig markiert, werden veröffentlicht. Eine
Station, die seit mehr als 3 Stunden schweigt, wird nicht mehr als aktuell veröffentlicht.

### Gemeinde

Der Name ist „MeteoGalicia“ gefolgt vom Namen der Gemeinde. Deren Tagesvorhersage und die höchste
für sie angekündigte Warnstufe:

| Funktion         | Einheit | Hinweis                                                           |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Wetter heute     | Text    | Typischster Himmel des Tages, zum Beispiel „Leichte Schauer“      |
| Minimum heute    | °C      | Galicische Tage (Europe/Madrid)                                   |
| Maximum heute    | °C      |                                                                   |
| UV-Index heute   | Index   | Höchster vorhergesagter UV-Index                                  |
| Wetter morgen    | Text    |                                                                   |
| Minimum morgen   | °C      |                                                                   |
| Maximum morgen   | °C      |                                                                   |
| Warnstufe heute  | 0 bis 3 | Höchste Stufe des Tages: 0 keine, 1 gelb, 2 orange, 3 rot         |
| Warnstufe morgen | 0 bis 3 |                                                                   |
| Wetterwarnungen  | Text    | Die Tage mit Warnung, zum Beispiel „Heute: Gelb · Morgen: Orange“ |

Die Stufen sind die höchsten des ganzen Tages für die Gemeinde, gleich welches Phänomen (Wind,
Regen, Küstenereignis, Schnee, Hitze…), so wie MeteoGalicia sie je Gemeinde veröffentlicht.

## Widget

**MeteoGalicia-Wetter** zeigt in der Sprache und den Einheiten des Dashboards:

- den Namen der Gemeinde (wie in Gladys benannt), dann Temperatur, Luftfeuchtigkeit, Wind und
  Böen der Station;
- Minimum und Maximum der nächsten Tage (bis zu 4);
- die Warnstufe jedes Tages mit Warnung, oder eine grüne Zeile „Keine“;
- das Wetter von heute und morgen, mit Minimum, Maximum und Regenwahrscheinlichkeit;
- die Quelle und die Uhrzeit der Messung.

Die Einstellung **Auszublendende Blöcke** blendet die Messwerte der Station, das Diagramm, die
Warnstufen oder die Vorhersage für heute und morgen aus.

## Szenen-Auslöser

**MeteoGalicia-Warnstufe erhöht** löst aus, wenn die höchste Warnstufe der Gemeinde für einen Tag
(heute, morgen oder übermorgen) steigt: von keiner auf gelb, von gelb auf orange… Einmal pro Tag und
Stufe, sobald sie angekündigt wird (eine Stufe, die am selben Tag sinkt und wieder steigt, löst nicht erneut aus). Ein Neustart löst nicht erneut aus, ebenso wenig der nächste
Tag, wenn aus „morgen“ „heute“ wird. Der allererste Start (und der erste nach einem Wechsel der
Gemeinde) merkt sich nur die bereits angekündigten Stufen.

Filter (leer = alle): **Stufen** (gelb, orange, rot) und **Tage** (heute, morgen, übermorgen).

An die Szenen-Aktionen übergebene Informationen: Stufe, Stufe (1 bis 3), Stufenschlüssel, Tag,
Tagesschlüssel, Datum, von einer niedrigeren Warnung erhöht, Gemeinde. Zum Beispiel eine Nachricht:
`MeteoGalicia: Warnung {{triggerEvent.data.level_label}} {{triggerEvent.data.day_label}} in
{{triggerEvent.data.concello}}`.

## Konfigurationsaktionen

- **Nächste Stationen anzeigen**: die 8 Stationen, die dem Ort am nächsten sind, mit ID, Gemeinde,
  Höhe und Entfernung. Kopiere eine ID in „Wetterstation“, um eine andere zu wählen (eine Station im
  Tal passt oft besser als eine nähere auf einem Gipfel).
- **Verbindung prüfen**: liest sofort alle Quellen und sagt, was geantwortet hat: die Temperatur der
  Station und ihre Uhrzeit, die Gemeinde der Vorhersage, die heutige Warnstufe. Rot angezeigt, wenn
  eine Quelle fehlgeschlagen ist.

## Szenenbeispiele

- **Sturm im Anmarsch**: Auslöser „MeteoGalicia-Warnstufe erhöht“, Stufen „Orange“ und „Rot“ →
  Rollläden schließen, Markise einfahren, Nachricht mit dem Tag senden.
- **Starke Sonne**: jeden Tag um 10:00, wenn „UV-Index heute“ größer oder gleich 6 ist → daran
  erinnern, die Kinder einzucremen.
- **Frost morgen**: jeden Abend um 20:00, wenn „Minimum morgen“ unter 1 °C liegt → benachrichtigen,
  Pflanzen und Windschutzscheibe zu schützen.

## Fehlerbehebung

- **„Kein Ort“**: Kein Zuhause hat eine Position. Platziere dein Zuhause auf der Karte unter
  **Einstellungen → Zuhause**, oder gib Koordinaten, eine Station oder eine Gemeinde ein.
- **„Außerhalb Galiciens“**: Der Ort ist mehr als 40 km von jeder MeteoGalicia-Station entfernt.
  Gib eine Station oder eine Gemeinde ein, um die Integration trotzdem zu nutzen.
- **„Gehört nicht zu den 313“**: Die eingegebene Gemeinde ist unbekannt. Gib ihren fünfstelligen
  INE-Code (zum Beispiel `15078` für Santiago de Compostela) oder ihren Namen ein.
- **„MeteoGalicia antwortet nicht“**: Gladys erreicht `servizos.meteogalicia.gal` nicht; die Werte
  werden aktualisiert, sobald der Dienst zurück ist. Die Protokolle nennen die fehlerhafte Quelle
  einmal, und wann sie wieder funktioniert.
- **Eine Funktion fehlt an der Station**: Die Station misst sie nicht. Wähle mit **Nächste
  Stationen anzeigen** eine andere Station.
- **Mehr Details**: Setze die Variable `LOG_LEVEL` des Containers auf `debug`.

## Grenzen

- **Daten**: offene Daten von MeteoGalicia (Xunta de Galicia), weiterverwendet mit Angabe der
  Quelle („Quelle: MeteoGalicia – Xunta de Galicia“, vom Widget angezeigt).
- **Anfragen**: etwa 13 pro Stunde im Standardtakt (Station und Warnstufen bei jeder
  Aktualisierung, Vorhersage einmal pro Stunde, Listen der Stationen und Gemeinden einmal am Tag).
  Die Stationen melden alle 10 Minuten: Ein schnellerer Takt würde nichts Neues lesen.
- Die Warnungen sind die **höchste Stufe je Tag und Gemeinde**: Das Phänomen (Wind, Regen, Küste…)
  und die genauen Uhrzeiten veröffentlicht dieser Dienst nicht.
- Die Vorhersage ist täglich (heute und die nächsten 2 oder 3 Tage), ohne stündliche Vorhersage.
  Sonnenstrahlung und Bodentemperaturen werden nicht als Funktionen veröffentlicht (keine passende
  Einheit in Gladys).
- Eine Station und eine Gemeinde pro Installation.
- Die Funktionsnamen werden beim Anlegen der Geräte festgelegt: Eine spätere Sprachänderung benennt
  sie nicht um.
- Ohne offizielle Spezifikation jedes Dienstes entwickelt: MeteoGalicia kann sie ohne Vorankündigung
  ändern. Rückmeldungen sind willkommen.
