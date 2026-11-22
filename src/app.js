// -----------------------------------------------------------------------------
// Wires the Gladys SDK to the MeteoGalicia service: handlers, configuration
// actions, widget, refresh timer. Everything external is injectable (fetch,
// store, clock, timers, logger) so the tests run the real wiring against the
// SDK's fake Gladys and recorded MeteoGalicia answers.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES, normalizeConfig } from './config.js';
import { createMeteoGaliciaClient } from './meteogalicia/client.js';
import { ACTION_TEXT, TEXT, formatNumber, formatWhen, levelName } from './i18n.js';
import { createPoller } from './poller.js';
import { createService } from './service.js';
import { Store } from './store.js';
import { WIDGET_KEY, buildWeatherContent } from './widgets.js';

/** Configuration action keys: forever. */
export const ACTIONS = { LIST_STATIONS: 'list_stations', CHECK: 'check_connection' };

const NEAREST_COUNT = 8;

/**
 * A failed action: Gladys shows in red what the handler throws, in green what
 * it returns. The message is the multi-language object.
 */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/** The same message in every language. */
const everyLanguage = (build) => Object.fromEntries(LANGUAGES.map((lang) => [lang, build(lang)]));

/** Text of the "List the nearest stations" action; throws on a configuration problem. */
export function nearestMessage(result) {
  if (result.problem) {
    throw new ActionFailure(TEXT[result.problem]);
  }
  return everyLanguage((lang) => {
    const t = ACTION_TEXT[lang];
    const where = result.place.source === 'house' ? t.yourHouse(result.place.name) : t.coordinates;
    return [
      t.nearest(where),
      ...result.stations.map((station) =>
        t.station({ ...station, distance: formatNumber(station.distance, lang) }),
      ),
      t.copy,
    ].join('\n');
  });
}

/** Text of the "Check the connection" action; throws when anything failed. */
export function checkMessage(result, { now, timeZone }) {
  const { target } = result;
  if (result.errors.setup) {
    throw new ActionFailure(
      everyLanguage((lang) => ACTION_TEXT[lang].failed('MeteoGalicia', result.errors.setup)),
    );
  }
  if (!target.station && !target.concello) {
    throw new ActionFailure(TEXT[target.problem ?? 'notConfigured']);
  }
  const message = everyLanguage((lang) => {
    const t = ACTION_TEXT[lang];
    const parts = [];
    if (target.station) {
      const temperature = result.observation?.values.temperature;
      parts.push(
        result.errors.observation
          ? t.failed(t.stationPart, result.errors.observation)
          : t.observation(
              target.station.name,
              temperature === undefined ? '?' : formatNumber(temperature, lang),
              result.observation?.time
                ? formatWhen(result.observation.time, lang, timeZone, now)
                : '?',
            ),
      );
    }
    if (target.concello) {
      parts.push(
        result.errors.forecast
          ? t.failed(t.forecastPart, result.errors.forecast)
          : t.forecastOk(target.concello.name, target.concello.id),
      );
      const today = (result.levels ?? []).find((entry) => entry.day === 0);
      parts.push(
        result.errors.warnings
          ? t.failed(t.warningsPart, result.errors.warnings)
          : t.warningLevel(today ? levelName(today.level, lang) : '?'),
      );
    }
    const text = t.checkOk(parts.join(' '));
    return target.problem ? `${text} ${TEXT[target.problem][lang]}` : text;
  });
  // A source that failed, or a configuration problem: shown in red.
  if (target.problem || Object.keys(result.errors).length > 0) {
    throw new ActionFailure(message);
  }
  return message;
}

/**
 * @param {object} gladys GladysIntegration (or the SDK's fake Gladys)
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {{ load: Function, save: Function }} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the refresh timer
 * @param {object} [options.logger]
 * @param {string} [options.timeZone]
 */
export function registerHandlers(gladys, options = {}) {
  const now = options.now ?? (() => Date.now());
  const logger = options.logger ?? createLogger({ name: 'meteogalicia' });
  // The supervisor injects TZ, the time zone of Gladys; undefined = the system's.
  const timeZone = options.timeZone ?? (process.env.TZ || undefined);
  const store = options.store ?? new Store('/data');
  let config = normalizeConfig(gladys.config ?? {});
  const getConfig = () => config;

  const client = createMeteoGaliciaClient({ fetch: options.fetch, logger: logger.child('http') });
  const service = createService({ gladys, client, store, logger, getConfig, now, timeZone });

  // The widget is nudged when what it shows changed, not after every refresh.
  let shown = null;
  const refreshWidget = () => {
    const next = JSON.stringify(service.snapshot());
    if (next !== shown) {
      shown = next;
      gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  };
  const poller = createPoller({
    gladys,
    service,
    getConfig,
    logger,
    now,
    timers: options.timers ?? true,
    onCycle: refreshWidget,
  });

  gladys.onScanRequest(() => service.publishDevices());

  gladys.onPoll(async (device) => {
    if (service.owns(device.external_id)) {
      await poller.pollFromCore(device);
    }
  });

  // A device just added (or updated): the SDK forgot what it had published
  // for it, and Gladys dropped the states sent before it existed.
  const sendAgain = async () => {
    await service.publishStates();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  };
  gladys.onDeviceCreated(sendAgain);
  gladys.onDeviceUpdated(sendAgain);
  // The widget shows the name given in Gladys.
  gladys.onDeviceDeleted(() => gladys.requestWidgetRefresh(WIDGET_KEY));

  gladys.onAction(ACTIONS.LIST_STATIONS, async () => {
    logger.info('Action: list the nearest stations');
    let result;
    try {
      result = await service.nearest(NEAREST_COUNT);
    } catch (err) {
      throw new ActionFailure(
        everyLanguage((lang) => ACTION_TEXT[lang].failed('MeteoGalicia', err.message)),
      );
    }
    return nearestMessage(result);
  });

  gladys.onAction(ACTIONS.CHECK, async () => {
    logger.info('Action: check the connection');
    // Not in the middle of a timer cycle: check() resets what it reads.
    await poller.idle;
    const result = await service.check();
    refreshWidget();
    return checkMessage(result, { now: now(), timeZone });
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language, units }) =>
    buildWeatherContent(service.snapshot(), { settings, language, units, now: now(), timeZone }),
  );

  async function start() {
    service.reset();
    await poller.restart();
  }

  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Configuration updated');
    config = normalizeConfig(newConfig);
    await start();
  });

  // The SDK logs the connection lifecycle itself (gladys-sdk).
  let ready = Promise.resolve();
  gladys.on('connected', async () => {
    ready = (async () => {
      try {
        config = normalizeConfig(await gladys.getConfig());
        await start();
      } catch (err) {
        logger.error(`Initialization failed (${err.message})`);
        await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
      }
    })();
    await ready;
  });

  return {
    service,
    poller,
    get ready() {
      return ready;
    },
    async stop() {
      poller.stop();
      await poller.idle;
    },
  };
}
