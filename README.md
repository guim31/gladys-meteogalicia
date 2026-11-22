# MeteoGalicia for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
official weather of **Galicia** (Spain) from [MeteoGalicia](https://www.meteogalicia.gal), the
weather service of the Xunta de Galicia: the readings of its automatic weather stations, the daily
forecast of the municipalities and their warning levels. Open data, no account, no API key.

> **Not affiliated with MeteoGalicia or the Xunta de Galicia.** This project only reads the public
> JSON services MeteoGalicia publishes on servizos.meteogalicia.gal. Source: MeteoGalicia – Xunta
> de Galicia.

## Features

- **Station device**: the last 10-minute reading of the nearest MeteoGalicia station (or the one
  you choose), with only what it measures: temperature, dew point, humidity, sea-level pressure,
  wind speed, gusts and direction, rain intensity. Only the values MeteoGalicia marks as valid.
- **Municipality device**: the weather, minimum and maximum of today and tomorrow, today's UV
  index, and the **warning level** of today and tomorrow (0 to 3) with a text summary. The
  municipality is the station's, or one you type (INE code or name).
- **Scene trigger** _MeteoGalicia warning level raised_: as soon as the highest warning level of
  the municipality rises for today, tomorrow or the day after. Filters on level and day.
- **Dashboard widget** _MeteoGalicia weather_: the station readings, the minimum and maximum of the
  coming days, the warning levels, today and tomorrow in words with the chance of rain; in the
  language and units of the dashboard; every block can be hidden.
- **Configuration actions**: _List the nearest stations_ (with their distance) and _Check the
  connection_.
- **Read-only**, in English, French, German and Spanish.

## Requirements

- Gladys Assistant **5.3.0** or later (catalog countries; the configuration picks a Gladys house,
  which needs 5.2.0).
- A place in Galicia (within 40 km of a MeteoGalicia station), or a station or municipality typed
  in the configuration.
- Internet access from Gladys to `servizos.meteogalicia.gal`.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-meteogalicia` (or install it from the store).
2. Accept the **location** permission: the integration reads the position of your house to pick
   the nearest station. The position never leaves Gladys: the list of stations is downloaded and
   the choice is made locally.
3. Open the configuration. Every field is optional: by default the first located house, its
   nearest station and the municipality of that station are used.
4. In the **Discovery** tab, add the two devices to Gladys.

The user documentation, in four languages, is in [`docs/`](docs/en.md).

## How it works

All the services are under `https://servizos.meteogalicia.gal/mgrss/`:

- **Stations**: `observacion/listaEstacionsMeteo.action`, the 155 automatic stations with their
  position and municipality, read at setup and once a day.
- **Reading**: `observacion/ultimos10minEstacionsMeteo.action?idEst=<id>`, the last 10-minute
  reading of the station, at every refresh.
- **Municipalities**: `observacion/observacionConcellos.action`, the ids and names of the 313
  municipalities, to find the one typed or the station's.
- **Forecast**: `predicion/jsonPredConcellos.action?idConc=<INE code>`, the daily forecast of the
  municipality (today and the next 2 or 3 days), read once an hour.
- **Warnings**: `predicion/adversos/jsonConcellosNivelMax.action?idConcello=<INE code>&dia=-1`,
  the highest warning level of the municipality for today and the next 2 days, at every refresh.
- The container refreshes by itself on a timer (10 minutes by default), about 13 requests an hour.
  The devices also declare a one-minute `onPoll`, which only acts if the timer has stalled
  (GladysAssistant/Gladys#3198).
- Only the changed values are published, with a heartbeat every 6 hours. The warning levels
  already announced to the scenes are kept in `/data/state.json`, so a restart does not fire them
  again.

## Limits

- One station and one municipality per installation.
- The warnings are the highest level per day and municipality: this service does not give the
  phenomenon nor the hours. Daily forecast only.
- Solar radiation and soil temperatures are not published as features (no matching Gladys unit).
- The feature names are set when the devices are created, in the configured language.
- Developed without an official specification of every service (only the forecast one is
  documented): MeteoGalicia may change them without notice. Feedback welcome.
- Weather data: © MeteoGalicia – Xunta de Galicia, reused with the mention of the source, which the
  widget shows.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
```

The tests run against the SDK's fake Gladys and the real MeteoGalicia answers recorded in
[`test/fixtures`](test/fixtures/README.md); they never touch the network.

Versions and releases belong to the **Release** workflow (Actions → Release): never edit the
`version` of `package.json` or of the manifest by hand. See [`CLAUDE.md`](CLAUDE.md) for the
project rules.

## Credits

- [MeteoGalicia](https://www.meteogalicia.gal) (Xunta de Galicia) for the open data and the
  documentation of the municipal forecast service.
- The Home Assistant HACS integration `meteogalicia` and its library
  [`meteogalicia-api`](https://github.com/danieldiazi/meteogalicia-api) by danieldiazi (GPLv3),
  which showed the way to these services (no code reused).
- The structure of this integration follows
  [`gladys-arso`](https://github.com/guim31/gladys-arso) (Apache-2.0).
- Cover: the MeteoGalicia logo, property of the Xunta de Galicia, shown to identify the data
  source.

## License

[Apache-2.0](LICENSE)
