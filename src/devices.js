// -----------------------------------------------------------------------------
// The two devices of the integration, and the states they publish.
//
//   - station: the last 10-minute reading of one MeteoGalicia automatic
//     station (external id from the station id, e.g. 10157); only the
//     measures the station takes, plus the features already added in Gladys,
//     so that a missing reading never removes a feature;
//   - concello: the forecast and the warning levels of one municipality
//     (external id from its INE code, e.g. 15030).
//
// Feature keys are forever (Gladys keys history, scenes and dashboards on
// them). Everything is read-only: MeteoGalicia is a data source.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { FEATURE_NAMES, TEXT, levelsSummary, skyName } from './i18n.js';
import { forecastDays } from './meteogalicia/model.js';

/** Device types (first part of the external ids): forever. */
export const DEVICE_TYPES = { STATION: 'station', CONCELLO: 'concello' };

const sensor = (category, type, unit, min, max) => ({ category, type, unit, min, max });

/** Features of the station device, by key: forever. */
export const STATION_FEATURES = {
  temperature: sensor(C.TEMPERATURE_SENSOR, 'decimal', U.CELSIUS, -50, 50),
  dew_point: sensor(C.TEMPERATURE_SENSOR, 'decimal', U.CELSIUS, -50, 50),
  humidity: sensor(C.HUMIDITY_SENSOR, 'decimal', U.PERCENT, 0, 100),
  pressure: sensor(C.PRESSURE_SENSOR, 'decimal', U.HECTO_PASCAL, 900, 1100),
  wind_speed: sensor(C.SPEED_SENSOR, 'decimal', U.KILOMETER_PER_HOUR, 0, 250),
  wind_gust: sensor(C.SPEED_SENSOR, 'decimal', U.KILOMETER_PER_HOUR, 0, 250),
  wind_direction: sensor(C.ANGLE_SENSOR, 'integer', U.DEGREE, 0, 360),
  rain_rate: sensor(C.PRECIPITATION_SENSOR, 'decimal', U.MILLIMETER_PER_HOUR, 0, 200),
};

const level = () => ({ category: C.RISK, type: 'integer', min: 0, max: 3 });
const textFeature = () => ({ category: C.TEXT, type: 'text', min: 0, max: 0 });

/** Features of the municipality device, by key: forever. */
export const CONCELLO_FEATURES = {
  condition: textFeature(),
  today_min: sensor(C.TEMPERATURE_SENSOR, 'min', U.CELSIUS, -50, 50),
  today_max: sensor(C.TEMPERATURE_SENSOR, 'max', U.CELSIUS, -50, 50),
  uv_index: sensor(C.UV_SENSOR, 'integer', U.UV_INDEX, 0, 15),
  tomorrow_condition: textFeature(),
  tomorrow_min: sensor(C.TEMPERATURE_SENSOR, 'min', U.CELSIUS, -50, 50),
  tomorrow_max: sensor(C.TEMPERATURE_SENSOR, 'max', U.CELSIUS, -50, 50),
  warning_level: level(),
  warning_level_tomorrow: level(),
  warnings: textFeature(),
};

/** Platform id of a station device: the MeteoGalicia station id. */
export const stationPlatformId = (station) => station.id;

/** The feature keys of a device created in Gladys (empty when none). */
export function featureKeysOf(device) {
  return (device?.features ?? [])
    .map((feature) => String(feature.external_id ?? '').slice(device.external_id.length + 1))
    .filter((key) => key in STATION_FEATURES);
}

function buildFeatures(ids, definitions, keys, language) {
  return keys.map((key) => {
    const definition = definitions[key];
    return {
      name: FEATURE_NAMES[language][key],
      external_id: ids.feature(key),
      category: definition.category,
      type: definition.type,
      ...(definition.unit ? { unit: definition.unit } : {}),
      // Display bounds of the gauges; the core never clamps a state on them.
      min: definition.min,
      max: definition.max,
      read_only: true,
      has_feedback: false,
      keep_history: true,
    };
  });
}

/**
 * The devices to publish. Polling: the container refreshes the data itself
 * (src/poller.js); the core's onPoll, once a minute, is only a fallback.
 * @param {object} gladys
 * @param {{ station: object | null, concello: { id: string, name: string } | null, language: string }} target
 */
export function buildDevices(gladys, { station, concello, language }) {
  const devices = [];
  if (station) {
    const ids = gladys.externalIds(DEVICE_TYPES.STATION, stationPlatformId(station));
    // Measured keys, in the order of STATION_FEATURES.
    const keys = Object.keys(STATION_FEATURES).filter((key) =>
      (station.features ?? Object.keys(STATION_FEATURES)).includes(key),
    );
    devices.push({
      name: `MeteoGalicia ${station.name}`,
      external_id: ids.device,
      model: 'Automatic station',
      should_poll: true,
      poll_frequency: 60000,
      features: buildFeatures(ids, STATION_FEATURES, keys, language),
      params: [
        { name: 'station_id', value: station.id },
        { name: 'altitude', value: String(station.altitude ?? '') },
      ],
    });
  }
  if (concello) {
    const ids = gladys.externalIds(DEVICE_TYPES.CONCELLO, concello.id);
    devices.push({
      name: `MeteoGalicia ${concello.name}`,
      external_id: ids.device,
      model: 'Forecast & warnings',
      should_poll: true,
      poll_frequency: 60000,
      features: buildFeatures(ids, CONCELLO_FEATURES, Object.keys(CONCELLO_FEATURES), language),
      params: [{ name: 'concello_id', value: concello.id }],
    });
  }
  return devices;
}

const state = (ids, key, value) =>
  value === null || value === undefined
    ? null
    : { device_feature_external_id: ids.feature(key), state: value };

const text = (ids, key, value) =>
  typeof value === 'string' && value.trim() !== ''
    ? { device_feature_external_id: ids.feature(key), text: value.slice(0, 250) }
    : null;

/** States of the station device from its reading (values already converted). */
export function stationStates(gladys, station, reading) {
  const ids = gladys.externalIds(DEVICE_TYPES.STATION, stationPlatformId(station));
  const keys = station.features ?? Object.keys(STATION_FEATURES);
  return keys.map((key) => state(ids, key, reading.values[key])).filter(Boolean);
}

/**
 * States of the municipality device.
 * @param {object} data `{ forecast?, levels? }`, each the last parsed answer
 */
export function concelloStates(gladys, concello, { forecast, levels }, { now, language }) {
  const ids = gladys.externalIds(DEVICE_TYPES.CONCELLO, concello.id);
  const states = [];
  if (forecast) {
    const { today, tomorrow } = forecastDays(forecast, now);
    states.push(
      text(ids, 'condition', today && skyName(today.sky, language)),
      state(ids, 'today_min', today?.min),
      state(ids, 'today_max', today?.max),
      state(ids, 'uv_index', today?.uv),
      text(ids, 'tomorrow_condition', tomorrow && skyName(tomorrow.sky, language)),
      state(ids, 'tomorrow_min', tomorrow?.min),
      state(ids, 'tomorrow_max', tomorrow?.max),
    );
  }
  if (levels) {
    const today = levels.find((entry) => entry.day === 0);
    const tomorrow = levels.find((entry) => entry.day === 1);
    states.push(
      state(ids, 'warning_level', today?.level),
      state(ids, 'warning_level_tomorrow', tomorrow?.level),
      text(ids, 'warnings', levelsSummary(levels, language) ?? TEXT.noWarning[language]),
    );
  }
  return states.filter(Boolean);
}
