# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-22

### Added

- The official weather of Galicia from MeteoGalicia (Xunta de Galicia) open data, without account
  or key.
- Station device: the last 10-minute reading of the nearest MeteoGalicia automatic station (or a
  chosen one), with only what it measures: temperature, dew point, humidity, sea-level pressure,
  wind, gusts, direction, rain intensity.
- Municipality device: weather, minimum and maximum of today and tomorrow, today's UV index, and
  the warning levels of today and tomorrow, with a text summary. Municipality chosen by INE code or
  name, or that of the station.
- Scene trigger "MeteoGalicia warning level raised", with filters on level and day.
- Dashboard widget "MeteoGalicia weather": station readings, coming days, warning levels, today and
  tomorrow, each block can be hidden.
- Configuration actions "List the nearest stations" and "Check the connection" (shown in red on
  failure).
- English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-meteogalicia/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-meteogalicia/releases/tag/v1.0.0
