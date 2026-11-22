// -----------------------------------------------------------------------------
// The MeteoGalicia service: where the data is read (location, station,
// municipality), when it is read (each source at its own pace), and what
// Gladys receives (devices, states, "warning raised" scene events, connection
// status).
//
// Pace of the sources, all public and without key (see docs, "Limits"):
//   - the 10-minute reading of the station: every cycle (10 min by default);
//   - the warning levels of the municipality: every cycle;
//   - the forecast of the municipality: once an hour (updated twice a day);
//   - the station and municipality lists: at setup, then once a day.
// About 13 requests an hour at the default pace.
// -----------------------------------------------------------------------------

import {
  SERVICE_TIME_ZONE,
  WARNING_LEVELS,
  addDays,
  findConcello,
  localDay,
  nearest,
  parseConcellos,
  parseForecast,
  parseObservation,
  parseStations,
  parseWarningLevels,
} from './meteogalicia/model.js';
import {
  STATION_FEATURES,
  buildDevices,
  concelloStates,
  featureKeysOf,
  stationStates,
} from './devices.js';
import { TEXT, WARNING_DAY_NAMES, WARNING_LEVEL_NAMES, formatDay } from './i18n.js';
import { createIssueLog } from './issues.js';

/** Scene trigger key: forever. */
export const WARNING_TRIGGER = 'warning_raised';

/** The day of a warning level, by offset from today: keys forever. */
export const WARNING_DAYS = ['today', 'tomorrow', 'day_after'];

// The service works in Galician days, whatever the zone of Gladys.
export { SERVICE_TIME_ZONE };

const HOUR = 3600 * 1000;
export const LISTS_MAX_AGE = 24 * HOUR;
export const FORECAST_MAX_AGE = 55 * 60 * 1000;
// A station silent for this long is down: its last values are not re-sent.
export const OBSERVATION_MAX_AGE = 3 * HOUR;
// An unchanged value is re-sent this often, so Gladys never shows it as stale.
export const HEARTBEAT = 6 * HOUR;
// Farther than this from every station, the place is not in Galicia.
export const MAX_DISTANCE_KM = 40;

// Measured by every MeteoGalicia station (all 155 on 22 November 2026, rain but one).
const COMMON_MEASURES = ['temperature', 'dew_point', 'humidity', 'rain_rate'];

const formatCoordinates = (lat, lon) => `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

/**
 * @param {object} options
 * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
 * @param {ReturnType<import('./meteogalicia/client.js').createMeteoGaliciaClient>} options.client
 * @param {{ load: Function, save: Function }} options.store
 * @param {object} options.logger
 * @param {() => object} options.getConfig the current normalized config
 * @param {() => number} options.now
 */
export function createService({ gladys, client, store, logger, getConfig, now }) {
  const issues = createIssueLog(logger);
  let stationList = null; // { list, at }
  let concelloList = null; // { list, at }
  let target = null; // { station, concello, place, problem }
  let observation = null; // the last reading of the target station
  let forecast = null; // { data, at }
  let warnings = null; // { levels: [{ day, date, level }], at }
  let seen; // { concello, levels: { [date]: level } } | null, undefined until loaded
  let lastStatus = null;
  // Bumped when the config changes: a read started before is ignored.
  let generation = 0;
  // The last error of each failing source, for the check action.
  const lastErrors = new Map();

  async function stations() {
    if (!stationList || now() - stationList.at >= LISTS_MAX_AGE) {
      stationList = { list: parseStations(await client.stations()), at: now() };
    }
    return stationList.list;
  }

  async function concellos() {
    if (!concelloList || now() - concelloList.at >= LISTS_MAX_AGE) {
      concelloList = { list: parseConcellos(await client.concellos()), at: now() };
    }
    return concelloList.list;
  }

  /** The location from the config or a Gladys house, or a configuration problem. */
  async function resolveLocation(config) {
    if (config.coordinatesInvalid) {
      return { problem: 'coordinatesInvalid' };
    }
    if (config.latitude !== null) {
      return {
        place: {
          lat: config.latitude,
          lon: config.longitude,
          name: formatCoordinates(config.latitude, config.longitude),
          source: 'coordinates',
        },
      };
    }
    const houses = await gladys.getHouses();
    const located = houses.filter((house) => house.latitude !== null && house.longitude !== null);
    if (config.house) {
      const house = located.find((candidate) => candidate.selector === config.house);
      if (!house) {
        return { problem: 'houseNotFound' };
      }
      return {
        place: { lat: house.latitude, lon: house.longitude, name: house.name, source: 'house' },
      };
    }
    const house = located[0];
    return house
      ? { place: { lat: house.latitude, lon: house.longitude, name: house.name, source: 'house' } }
      : { place: null };
  }

  /** The feature keys a station device publishes: measured now, or already added. */
  function stationFeatureKeys(station, reading) {
    const ids = gladys.externalIds('station', station.id);
    const created = (gladys.devices ?? []).find((device) => device.external_id === ids.device);
    const keys = new Set([...Object.keys(reading?.values ?? {}), ...featureKeysOf(created)]);
    // A station silent right now: the measures every station takes.
    const known = keys.size > 0 ? keys : new Set(COMMON_MEASURES);
    return Object.keys(STATION_FEATURES).filter((key) => known.has(key));
  }

  const nothing = (problem) => ({ station: null, concello: null, place: null, problem });

  /**
   * Work out the station and the municipality from the config, then publish
   * the devices. Throws when MeteoGalicia or Gladys does not answer (retried
   * at the next cycle); a configuration problem is in `target.problem`.
   */
  async function setup() {
    const started = generation;
    const config = getConfig();
    if (config.stationIdInvalid) {
      target = nothing('stationIdInvalid');
      return target;
    }
    const location = await resolveLocation(config);
    if (location.problem) {
      target = nothing(location.problem);
      return target;
    }
    const { place } = location;
    if (!place && !config.stationId && !config.concello) {
      target = nothing('notConfigured');
      return target;
    }
    let problem = null;
    let station = null;
    if (config.stationId || place) {
      const list = await stations();
      if (config.stationId) {
        station = list.find((candidate) => candidate.id === config.stationId) ?? null;
        if (!station) {
          problem = 'stationUnknown';
        }
      } else {
        const [found] = nearest(list, place.lat, place.lon, 1);
        if (!found || found.distance > MAX_DISTANCE_KM) {
          problem = 'outsideArea';
        } else {
          station = found;
        }
      }
    }
    let concello = null;
    if (config.concello) {
      concello = findConcello(await concellos(), config.concello);
      if (!concello) {
        problem = 'concelloUnknown';
      }
    } else if (station) {
      // The municipality of the station: no position of the municipalities
      // is published, the station list names its municipality.
      concello = findConcello(await concellos(), station.concello);
      if (!concello) {
        problem = 'concelloUnknown';
      }
    }
    observation = null;
    forecast = null;
    warnings = null;
    if (station) {
      // Read now: the device publishes only the measures the station takes.
      // A failure here is retried by the cycle; the device keeps the common measures.
      observation = await client
        .observation(station.id)
        .then(parseObservation)
        .catch(() => null);
      station = {
        id: station.id,
        name: station.name,
        lat: station.lat,
        lon: station.lon,
        altitude: station.altitude,
        features: stationFeatureKeys(station, observation),
      };
    }
    if (started !== generation) {
      // The configuration changed meanwhile: the next cycle sets up the new one.
      return null;
    }
    target = { station, concello, place, problem };
    logger.info(
      `Ready: ${station ? `station ${station.id}` : 'no station'}, ` +
        `${concello ? `forecast and warnings of municipality ${concello.id}` : 'no forecast'}` +
        `${problem ? ` (${problem})` : ''}`,
    );
    await gladys.publishDiscoveredDevices(
      buildDevices(gladys, { ...target, language: config.language }),
    );
    return target;
  }

  async function readObservation() {
    // Taken before the await: a configuration change may reset the target meanwhile.
    const { station } = target;
    const started = generation;
    const reading = parseObservation(await client.observation(station.id));
    if (!reading) {
      throw new Error(`station ${station.id} sent no reading`);
    }
    if (started !== generation) {
      return;
    }
    observation = reading;
    // A measure invalid at setup (or new) gets its feature now: the device is
    // published again, and Gladys offers to update it.
    const missing = Object.keys(reading.values).filter((key) => !station.features.includes(key));
    if (missing.length > 0) {
      const features = stationFeatureKeys(station, {
        values: Object.fromEntries([...station.features, ...missing].map((key) => [key, 0])),
      });
      try {
        await gladys.publishDiscoveredDevices(
          buildDevices(gladys, {
            ...target,
            station: { ...station, features },
            language: getConfig().language,
          }),
        );
        // Kept only once published: a refused publication is tried again.
        station.features = features;
        logger.info(`Station ${station.id} now measures ${missing.join(', ')}`);
      } catch (err) {
        logger.warn(`New station features not published (${err.message})`);
      }
    }
  }

  async function readForecast() {
    const { concello } = target;
    const started = generation;
    const data = parseForecast(await client.forecast(concello.id));
    if (!data) {
      throw new Error(`no forecast for municipality ${concello.id}`);
    }
    if (started === generation) {
      forecast = { data, at: now() };
    }
  }

  async function readWarnings() {
    const { concello } = target;
    const started = generation;
    const levels = parseWarningLevels(await client.warningLevels(concello.id), concello.id);
    const today = localDay(now(), SERVICE_TIME_ZONE);
    if (started === generation) {
      warnings = {
        concello: concello.id,
        levels: levels.map((entry) => ({ ...entry, date: addDays(today, entry.day) })),
        at: now(),
      };
    }
  }

  /** Run one source, logging a lasting failure once; resolves true on success. */
  async function attempt(key, label, read) {
    try {
      await read();
      lastErrors.delete(key);
      issues.ok(key, `${label}: MeteoGalicia answers again`);
      return true;
    } catch (err) {
      lastErrors.set(key, err.message);
      issues.fail(key, `${label} unavailable (${err.message})`);
      return false;
    }
  }

  async function reportStatus(connected, message) {
    const next = JSON.stringify({ connected, message });
    if (next === lastStatus) {
      return;
    }
    lastStatus = next;
    await gladys.setConnectionStatus(connected, message);
  }

  /** The states of the devices the user added to Gladys. */
  function currentStates() {
    if (!target) {
      return [];
    }
    const config = getConfig();
    const created = new Set((gladys.devices ?? []).map((device) => device.external_id));
    const states = [];
    const { station, concello } = target;
    if (
      station &&
      observation &&
      created.has(gladys.externalIds('station', station.id).device) &&
      observation.time !== null &&
      now() - observation.time < OBSERVATION_MAX_AGE
    ) {
      states.push(...stationStates(gladys, station, observation));
    }
    if (concello && created.has(gladys.externalIds('concello', concello.id).device)) {
      states.push(
        ...concelloStates(
          gladys,
          concello,
          { forecast: forecast?.data, levels: warnings?.levels },
          { now: now(), language: config.language },
        ),
      );
    }
    return states;
  }

  async function publishStates() {
    const states = currentStates();
    if (states.length === 0) {
      return;
    }
    const result = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT });
    logger.debug(`${result.count} state(s) published`);
  }

  /**
   * Fire the scene trigger for every day whose warning level rose. The very
   * first run for a municipality only takes note of the levels: a fresh
   * install does not fire for warnings issued before it.
   */
  async function announceWarnings() {
    if (!warnings || !target?.concello || warnings.concello !== target.concello.id) {
      return;
    }
    if (seen === undefined) {
      seen = (await store.load())?.seen ?? null;
    }
    const concello = target.concello;
    const baseline = seen?.concello !== concello.id;
    const previous = baseline ? {} : seen.levels;
    const next = { ...previous };
    const raised = [];
    for (const entry of warnings.levels) {
      const before = previous[entry.date] ?? 0;
      if (entry.level > before) {
        raised.push({ ...entry, update: before > 0 });
      }
      next[entry.date] = Math.max(entry.level, before);
    }
    // Days gone are forgotten.
    const oldest = addDays(localDay(now(), SERVICE_TIME_ZONE), -2);
    for (const date of Object.keys(next)) {
      if (date < oldest) {
        delete next[date];
      }
    }
    if (baseline) {
      logger.debug(`Warning levels noted for municipality ${concello.id}, first run: no event`);
    } else {
      const language = getConfig().language;
      for (const entry of raised) {
        const levelKey = WARNING_LEVELS[entry.level];
        const dayKey = WARNING_DAYS[entry.day] ?? 'day_after';
        logger.info(`Warning level raised: ${levelKey} on ${entry.date}`);
        try {
          await gladys.publishSceneEvent(WARNING_TRIGGER, {
            level: levelKey,
            day: dayKey,
            level_number: entry.level,
            level_label: WARNING_LEVEL_NAMES[language][levelKey],
            day_label: WARNING_DAY_NAMES[language][dayKey],
            date: formatDay(entry.date, language),
            is_update: entry.update,
            concello: concello.name,
          });
        } catch (err) {
          // Not recorded as announced: tried again at the next cycle.
          logger.error(`Scene event refused (${err.message})`);
          next[entry.date] = previous[entry.date] ?? 0;
        }
      }
    }
    const updated = { concello: concello.id, levels: next };
    const changed = JSON.stringify(updated) !== JSON.stringify(seen);
    seen = updated;
    if (changed) {
      await store
        .save({ seen })
        .catch((err) => issues.fail('store', `Cannot write /data (${err.message})`));
    }
  }

  return {
    /** Forget everything read: the config changed. */
    reset() {
      generation += 1;
      target = null;
      observation = null;
      forecast = null;
      warnings = null;
      lastStatus = null;
    },

    /**
     * One refresh: setup if needed, read the sources that are due, publish
     * the states, announce the raised warnings, report the status.
     * @returns {Promise<boolean>} whether a source answered
     */
    async cycle({ forceForecast = false } = {}) {
      let fresh = false;
      if (!target) {
        try {
          const started = generation;
          await setup();
          if (started !== generation) {
            // Reconfigured during the setup: its result belongs to the old config.
            target = null;
            return false;
          }
          fresh = true;
        } catch (err) {
          target = null;
          lastErrors.set('setup', err.message);
          issues.fail('setup', `Setup failed (${err.message})`);
          await reportStatus(false, TEXT.unreachable);
          return false;
        }
        lastErrors.delete('setup');
        issues.ok('setup', 'Setup done: MeteoGalicia answers again');
      }
      const { station, concello, problem } = target;
      if (!station && !concello) {
        await reportStatus(false, TEXT[problem ?? 'notConfigured']);
        return false;
      }
      const results = [];
      if (station) {
        // Setup has just read the station.
        results.push(
          fresh && observation
            ? true
            : await attempt('observation', 'Observation', readObservation),
        );
      }
      if (concello) {
        if (forceForecast || !forecast || now() - forecast.at >= FORECAST_MAX_AGE) {
          results.push(await attempt('forecast', 'Forecast', readForecast));
        }
        results.push(await attempt('warnings', 'Warnings', readWarnings));
      }
      await publishStates();
      await announceWarnings();
      const anyOk = results.some(Boolean);
      if (problem) {
        await reportStatus(false, TEXT[problem]);
      } else {
        await reportStatus(anyOk, anyOk ? undefined : TEXT.unreachable);
      }
      return anyOk;
    },

    publishStates,

    /** Publish the devices again (a scan request). */
    async publishDevices() {
      if (target) {
        await gladys.publishDiscoveredDevices(
          buildDevices(gladys, { ...target, language: getConfig().language }),
        );
      }
    },

    /** Whether a device belongs to the current target. */
    owns(externalId) {
      if (!target) {
        return false;
      }
      return buildDevices(gladys, { ...target, language: getConfig().language }).some(
        (device) => device.external_id === externalId,
      );
    },

    /** Everything the widget shows; `title` is the name the user gave in Gladys. */
    snapshot() {
      let title = target?.concello?.name ?? target?.station?.name ?? null;
      if (target) {
        // The municipality first: it is what the widget is about.
        const own = buildDevices(gladys, { ...target, language: getConfig().language }).reverse();
        const named = own
          .map((device) => (gladys.devices ?? []).find((d) => d.external_id === device.external_id))
          .find((device) => device?.name);
        title = named?.name ?? title;
      }
      return {
        title,
        target,
        observation: target?.station && observation?.id === target.station.id ? observation : null,
        forecast: forecast?.data ?? null,
        levels: warnings?.levels ?? null,
      };
    },

    /** The `count` stations nearest to the location. */
    async nearest(count) {
      const config = getConfig();
      const location = await resolveLocation(config);
      if (location.problem || !location.place) {
        return { problem: location.problem ?? 'notConfigured' };
      }
      stationList = null;
      const list = await stations();
      return {
        place: location.place,
        stations: nearest(list, location.place.lat, location.place.lon, count).map((station) => ({
          ...station,
          distance: Math.round(station.distance * 10) / 10,
          altitude: station.altitude === null ? '?' : Math.round(station.altitude),
        })),
      };
    },

    /** Read every source now (configuration action). */
    async check() {
      generation += 1;
      target = null;
      observation = null;
      forecast = null;
      warnings = null;
      stationList = null;
      concelloList = null;
      lastStatus = null;
      lastErrors.clear();
      await this.cycle({ forceForecast: true });
      return { ...this.snapshot(), errors: Object.fromEntries(lastErrors) };
    },
  };
}
