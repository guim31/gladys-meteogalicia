// -----------------------------------------------------------------------------
// The integration end to end: the SDK's fake Gladys, a simulated MeteoGalicia
// (the real answers recorded on 22 November 2026), a controllable clock.
// Devices, states, the container's own refresh timer, the onPoll fallback,
// the "warning level raised" trigger, the actions, the logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MemoryStore } from '../src/store.js';
import { HEARTBEAT, WARNING_TRIGGER } from '../src/service.js';
import { FIXTURES, NOW, warningLevels } from './helpers/fakeMeteoGalicia.js';
import { HOUSE, createWorld, featureId } from './helpers/world.js';

const STATION = '10053'; // Campus Lugo, 2 km from HOUSE
const CONCELLO = '27028'; // Lugo

const stationFeature = (world, key, id = STATION) => featureId(world.gladys, 'station', id, key);
const concelloFeature = (world, key, id = CONCELLO) => featureId(world.gladys, 'concello', id, key);
const statesOf = (world, featureExternalId) =>
  world.gladys.fake.states.filter(
    (state) => state.device_feature_external_id === featureExternalId,
  );

/** The recorded reading of Campus Lugo with another temperature. */
function withTemperature(world, temperature) {
  const recorded = world.meteo.answers.observation;
  world.meteo.answers.observation = (id) =>
    recorded(id).replace(
      /("codigoParametro":"TA_AVG_1\.5m","lnCodigoValidacion":1,"nomeParametro":"[^"]*","unidade":"[^"]*","valor":)[-\d.]+/,
      `$1${temperature}`,
    );
}

/** The warning levels of Lugo set to these, by day. */
const levels = (world, byDay) => {
  world.meteo.answers.warningLevels = (id) => warningLevels(id, byDay);
};

test('the house gives two devices: the nearest station, and its municipality', async () => {
  const world = await createWorld();
  const [station, concello] = world.gladys.fake.discoveredDevices;
  assert.equal(station.name, 'MeteoGalicia Campus Lugo');
  assert.equal(station.external_id, world.gladys.externalIds('station', STATION).device);
  assert.deepEqual(
    station.features.map((feature) => feature.external_id.split(':').pop()),
    [
      'temperature',
      'dew_point',
      'humidity',
      'pressure',
      'wind_speed',
      'wind_gust',
      'wind_direction',
      'rain_rate',
    ],
  );
  assert.equal(concello.name, 'MeteoGalicia Lugo');
  assert.equal(concello.external_id, world.gladys.externalIds('concello', CONCELLO).device);
  assert.equal(concello.features.length, 10);
  await world.app.stop();
});

test('a station only gets the features of what it measures (Vigo: no anemometer, no barometer)', async () => {
  const world = await createWorld({ config: { station_id: '10142' } });
  const [station] = world.gladys.fake.discoveredDevices;
  assert.deepEqual(
    station.features.map((feature) => feature.external_id.split(':').pop()),
    ['temperature', 'dew_point', 'humidity', 'rain_rate'],
  );
  await world.app.stop();
});

test('values converted from the real reading: m/s to km/h, 10-minute rain to mm/h', async () => {
  const world = await createWorld();
  await world.createAll();
  const last = (key) => world.gladys.fake.lastState(stationFeature(world, key));
  assert.equal(last('temperature'), 12.2);
  assert.equal(last('dew_point'), 7.6);
  assert.equal(last('humidity'), 74);
  assert.equal(last('pressure'), 1026.1);
  assert.equal(last('wind_speed'), 11.3); // 3.15 m/s
  assert.equal(last('wind_gust'), 21.7); // 6.04 m/s
  assert.equal(last('wind_direction'), 229);
  assert.equal(last('rain_rate'), 0);
  await world.app.stop();
});

test('adding the devices publishes the forecast and the warning levels at once', async () => {
  const world = await createWorld();
  await world.createAll();
  const fake = world.gladys.fake;
  assert.equal(fake.lastState(concelloFeature(world, 'today_min')), 6);
  assert.equal(fake.lastState(concelloFeature(world, 'today_max')), 13);
  assert.equal(fake.lastState(concelloFeature(world, 'uv_index')), 2);
  assert.equal(fake.lastState(concelloFeature(world, 'tomorrow_min')), 5);
  assert.equal(fake.lastState(concelloFeature(world, 'tomorrow_max')), 14);
  assert.equal(fake.lastState(concelloFeature(world, 'warning_level')), 0);
  assert.equal(fake.lastState(concelloFeature(world, 'warning_level_tomorrow')), 0);
  const texts = Object.fromEntries(
    ['condition', 'tomorrow_condition', 'warnings'].map((key) => [
      key,
      statesOf(world, concelloFeature(world, key)).at(-1).text,
    ]),
  );
  assert.deepEqual(texts, {
    condition: 'Averses faibles',
    tomorrow_condition: 'Éclaircies',
    warnings: 'Aucun avis',
  });
  // The widget is refreshed when a device is added.
  assert.ok(fake.widgetRefreshes?.length !== 0);
  await world.app.stop();
});

test('the warning levels per day, and their summary', async () => {
  const world = await createWorld();
  await world.createAll();
  levels(world, [2, 3, 1]);
  await world.refresh();
  assert.equal(world.gladys.fake.lastState(concelloFeature(world, 'warning_level')), 2);
  assert.equal(world.gladys.fake.lastState(concelloFeature(world, 'warning_level_tomorrow')), 3);
  assert.equal(
    statesOf(world, concelloFeature(world, 'warnings')).at(-1).text,
    "Aujourd'hui: Orange · Demain: Rouge · Après-demain: Jaune",
  );
  await world.app.stop();
});

test('the states refresh on the container timer, without any onPoll from the core', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ timers: true });
  await world.createAll();
  withTemperature(world, 9.4);
  const before = world.meteo.count('observation');

  world.clock.now += 10 * 60 * 1000;
  t.mock.timers.tick(10 * 60 * 1000);
  await world.app.poller.idle;

  assert.equal(world.meteo.count('observation'), before + 1);
  assert.equal(world.gladys.fake.lastState(stationFeature(world, 'temperature')), 9.4);
  const polls = world.gladys.fake.wsMessages.filter((message) => /poll/i.test(message.type));
  assert.equal(polls.length, 0, 'the core never polled');
  await world.app.stop();
});

test("the core's onPoll is a fallback: skipped after a recent refresh, used when the timer stalls", async () => {
  const world = await createWorld();
  await world.createAll();
  const [station] = world.gladys.fake.discoveredDevices;
  const before = world.meteo.count('observation');

  assert.deepEqual(await world.gladys.fake.poll(station), { success: true });
  assert.equal(world.meteo.count('observation'), before, 'refreshed recently: skipped');

  world.clock.now += 10 * 60 * 1000;
  withTemperature(world, 7.1);
  await world.gladys.fake.poll(station);
  assert.equal(world.meteo.count('observation'), before + 1);
  assert.equal(world.gladys.fake.lastState(stationFeature(world, 'temperature')), 7.1);

  // A device of another integration (or a stale one) is ignored.
  await world.gladys.fake.poll({ external_id: 'ext:test-integration:station:1' });
  assert.equal(world.meteo.count('observation'), before + 1);
  await world.app.stop();
});

test('only the changes are published, and an unchanged value is re-sent every 6 hours', async (t) => {
  // The SDK dates its heartbeat with the system clock.
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const world = await createWorld();
  await world.createAll();
  const temperature = stationFeature(world, 'temperature');
  assert.equal(statesOf(world, temperature).length, 1);
  t.mock.timers.setTime(NOW + 10 * 60 * 1000);
  await world.refresh(10);
  assert.equal(statesOf(world, temperature).length, 1, 'unchanged: not sent again');
  t.mock.timers.setTime(NOW + HEARTBEAT + 20 * 60 * 1000);
  world.clock.now += HEARTBEAT;
  await world.refresh(10);
  assert.equal(statesOf(world, temperature).length, 2, 'heartbeat');
  await world.app.stop();
});

test('the forecast is read once an hour, the station and the warnings every cycle, the lists once a day', async () => {
  const world = await createWorld();
  assert.equal(world.meteo.count('stations'), 1);
  assert.equal(world.meteo.count('concellos'), 1);
  assert.equal(world.meteo.count('observation'), 1);
  for (let i = 0; i < 6; i += 1) {
    await world.refresh(10);
  }
  assert.equal(world.meteo.count('observation'), 7);
  assert.equal(world.meteo.count('warningLevels'), 7);
  assert.equal(world.meteo.count('forecast'), 2);
  assert.equal(world.meteo.count('stations'), 1);
  assert.equal(world.meteo.count('concellos'), 1);
  // Requests carry public ids only, never the position of the house.
  for (const { url } of world.meteo.requests) {
    assert.ok(!url.search.includes('43.0'), url.href);
  }
  await world.app.stop();
});

test('a station silent for hours: its last values are not re-sent as current', async () => {
  const world = await createWorld();
  await world.createAll();
  const recorded = FIXTURES.observations[STATION];
  world.meteo.answers.observation = () => recorded; // frozen at its recorded time
  world.clock.now += 4 * 3600 * 1000;
  const before = statesOf(world, stationFeature(world, 'temperature')).length;
  await world.refresh(10);
  assert.equal(statesOf(world, stationFeature(world, 'temperature')).length, before);
  await world.app.stop();
});

test('a doubtful measure (validation code other than 1) is never published', async () => {
  const world = await createWorld({ connect: false });
  const recorded = world.meteo.answers.observation;
  world.meteo.answers.observation = (id) =>
    recorded(id).replace(
      /("codigoParametro":"TA_AVG_1\.5m","lnCodigoValidacion":)1/,
      (_, start) => `${start}3`, // 3: not a valid original value
    );
  await world.gladys.connect();
  await world.app.ready;
  const [station] = world.gladys.fake.discoveredDevices;
  assert.ok(!station.features.some((feature) => feature.external_id.endsWith(':temperature')));
  await world.createAll();
  assert.equal(statesOf(world, stationFeature(world, 'temperature')).length, 0);
  assert.equal(world.gladys.fake.lastState(stationFeature(world, 'humidity')), 74);
  await world.app.stop();
});

test('the first run only takes note of the warning levels: no scene event', async () => {
  const world = await createWorld({ connect: false });
  levels(world, [1, 2, 0]);
  await world.gladys.connect();
  await world.app.ready;
  await world.refresh();
  assert.equal(world.gladys.fake.sceneEvents.length, 0);
  await world.app.stop();
});

test('a level that rises fires the trigger, once per day and level; a lower level does not', async () => {
  const world = await createWorld();
  levels(world, [0, 1, 0]);
  await world.refresh();
  levels(world, [0, 1, 0]);
  await world.refresh();
  levels(world, [0, 2, 0]);
  await world.refresh();
  levels(world, [0, 1, 0]);
  await world.refresh();
  const events = world.gladys.fake.sceneEvents;
  assert.equal(events.length, 2);
  assert.equal(events[0].key ?? events[0].trigger, WARNING_TRIGGER);
  assert.deepEqual(
    events.map(({ data }) => [data.day, data.level, data.level_number, data.is_update]),
    [
      ['tomorrow', 'yellow', 1, false],
      ['tomorrow', 'orange', 2, true],
    ],
  );
  assert.equal(events[0].data.level_label, 'Jaune');
  assert.equal(events[0].data.day_label, 'Demain');
  assert.equal(events[0].data.concello, 'Lugo');
  assert.equal(events[0].data.date, 'lun. 23');
  await world.app.stop();
});

test('the next day, tomorrow becomes today: the same warning does not fire again', async () => {
  const world = await createWorld();
  levels(world, [0, 2, 0]);
  await world.refresh();
  assert.equal(world.gladys.fake.sceneEvents.length, 1);
  levels(world, [2, 0, 0]);
  await world.refresh(24 * 60);
  assert.equal(world.gladys.fake.sceneEvents.length, 1);
  await world.app.stop();
});

test('a restart does not fire again for the levels already announced', async () => {
  const store = new MemoryStore();
  const first = await createWorld({ store });
  levels(first, [1, 0, 0]);
  await first.refresh();
  assert.equal(first.gladys.fake.sceneEvents.length, 1);
  await first.app.stop();

  const second = await createWorld({ store, connect: false });
  levels(second, [1, 0, 0]);
  await second.gladys.connect();
  await second.app.ready;
  await second.refresh();
  assert.equal(second.gladys.fake.sceneEvents.length, 0);
  await second.app.stop();
});

test('another municipality starts a new baseline: no event for its warnings in force', async () => {
  const store = new MemoryStore();
  const world = await createWorld({ store });
  levels(world, [2, 2, 2]);
  await world.gladys.fake.configUpdated?.({ concello: 'Vigo' });
  await world.app.service.cycle();
  assert.equal(world.gladys.fake.sceneEvents.length, 0);
  await world.app.stop();
});

test('the trigger data match the filters and variables declared in the manifest', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
  );
  const trigger = manifest.scene_triggers.find((entry) => entry.key === WARNING_TRIGGER);
  const world = await createWorld();
  levels(world, [1, 2, 3]);
  await world.refresh(10);
  assert.equal(world.gladys.fake.sceneEvents.length, 3);
  for (const { data } of world.gladys.fake.sceneEvents) {
    for (const field of trigger.fields) {
      const values = field.options.map((option) => option.value);
      assert.ok(values.includes(data[field.key]), `${field.key}=${data[field.key]}`);
    }
    for (const variable of trigger.variables) {
      assert.ok(variable.key in data, `variable ${variable.key} missing`);
      assert.equal(typeof data[variable.key], variable.type, variable.key);
    }
  }
  await world.app.stop();
});

test('a normal refresh cycle writes nothing at info level, and never the home coordinates', async () => {
  const world = await createWorld();
  await world.createAll();
  const start = world.logs.lines.length;
  for (let i = 0; i < 3; i += 1) {
    withTemperature(world, 8 + i);
    await world.refresh(10);
  }
  const cycle = world.logs.lines.slice(start);
  assert.ok(cycle.length > 0, 'the cycle logs at debug level');
  assert.deepEqual(
    cycle.filter((line) => line.level !== 'debug'),
    [],
  );
  const coordinates = [String(HOUSE.latitude), String(HOUSE.longitude), '43.01', '-7.56'];
  for (const line of world.logs.lines) {
    for (const value of coordinates) {
      assert.ok(!line.text.includes(value), `"${line.text}" shows a coordinate`);
    }
  }
  await world.app.stop();
});

test('a MeteoGalicia outage is logged once, its recovery once, and shown in the status', async () => {
  const world = await createWorld();
  const outage = new TypeError('fetch failed');
  const saved = { ...world.meteo.answers };
  world.meteo.answers.observation = outage;
  world.meteo.answers.forecast = outage;
  world.meteo.answers.warningLevels = outage;
  for (let i = 0; i < 4; i += 1) {
    await world.refresh(60);
  }
  const warnings = world.logs.at('warn');
  assert.equal(warnings.length, 3, warnings.map((line) => line.text).join('\n'));
  const status = world.gladys.fake.connectionStatuses.at(-1);
  assert.equal(status.connected, false);
  assert.match(status.message.fr, /MeteoGalicia ne répond pas/);

  Object.assign(world.meteo.answers, saved);
  await world.refresh(60);
  assert.equal(world.logs.at('info').filter((line) => /answers again/.test(line.text)).length, 3);
  assert.equal(world.gladys.fake.connectionStatuses.at(-1).connected, true);
  await world.app.stop();
});

test('MeteoGalicia down at startup: retried at the next cycle, then the devices appear', async () => {
  const world = await createWorld({ connect: false });
  world.meteo.answers.stations = { status: 503 };
  await world.gladys.connect();
  await world.app.ready;
  assert.equal(world.gladys.fake.discoveredDevices.length, 0);
  assert.equal(world.gladys.fake.connectionStatuses.at(-1).connected, false);
  world.meteo.answers.stations = FIXTURES.stations;
  await world.refresh();
  assert.equal(world.gladys.fake.discoveredDevices.length, 2);
  assert.equal(world.gladys.fake.connectionStatuses.at(-1).connected, true);
  await world.app.stop();
});

test('an answer that is not JSON (a captive portal page) is an error, not a crash', async () => {
  const world = await createWorld();
  world.meteo.answers.warningLevels = '<html>Wi-Fi login</html>';
  await world.refresh();
  assert.match(world.logs.at('warn').at(-1).text, /not JSON/);
  await world.app.stop();
});

test('no house located and nothing configured: no device, the status says what to do', async () => {
  const world = await createWorld({ houses: [] });
  assert.equal(world.gladys.fake.discoveredDevices.length, 0);
  const status = world.gladys.fake.connectionStatuses.at(-1);
  assert.equal(status.connected, false);
  assert.match(status.message.en, /No location/);
  await world.app.stop();
});

test('typed coordinates take precedence over the house: A Coruña', async () => {
  const world = await createWorld({ config: { latitude: '43,3713', longitude: '-8,3960' } });
  const names = world.gladys.fake.discoveredDevices.map((device) => device.name);
  assert.deepEqual(names, ['MeteoGalicia Coruña-Torre de Hércules', 'MeteoGalicia A Coruña']);
  await world.app.stop();
});

test('a station and a municipality typed, without any house: Vigo', async () => {
  const world = await createWorld({
    houses: [],
    config: { station_id: '10142', concello: 'vigo' },
  });
  const names = world.gladys.fake.discoveredDevices.map((device) => device.name);
  assert.deepEqual(names, ['MeteoGalicia Vigo', 'MeteoGalicia Vigo']);
  await world.createAll();
  assert.equal(world.gladys.fake.lastState(concelloFeature(world, 'today_max', '36057')), 17);
  await world.app.stop();
});

test('a municipality alone, by its INE code: forecast and warnings, no station', async () => {
  const world = await createWorld({ houses: [], config: { concello: '15030' } });
  const devices = world.gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => device.name),
    ['MeteoGalicia A Coruña'],
  );
  assert.equal(world.gladys.fake.connectionStatuses.at(-1).connected, true);
  await world.app.stop();
});

test('configuration problems are reported in the status', async () => {
  const cases = [
    [{ station_id: 'Coruña' }, /number such as 10157/],
    [{ station_id: '99999' }, /not among the MeteoGalicia stations/],
    [{ concello: 'Lisboa' }, /not among the 313/],
    [{ latitude: 'north', longitude: '2' }, /not readable/],
    [{ house: 'elsewhere' }, /no longer exists/],
    [{ latitude: '48.85', longitude: '2.35' }, /outside Galicia/],
  ];
  for (const [config, expected] of cases) {
    const world = await createWorld({ config });
    const status = world.gladys.fake.connectionStatuses.at(-1);
    assert.equal(status.connected, false, JSON.stringify(config));
    assert.match(status.message.en, expected);
    for (const lang of ['fr', 'de', 'es']) {
      assert.ok(status.message[lang], lang);
    }
    await world.app.stop();
  }
});

test('an unknown station typed: the forecast of the municipality still works', async () => {
  const world = await createWorld({
    houses: [],
    config: { station_id: '99999', concello: 'Lugo' },
  });
  assert.deepEqual(
    world.gladys.fake.discoveredDevices.map((device) => device.name),
    ['MeteoGalicia Lugo'],
  );
  await world.app.stop();
});

test('a configuration change re-reads everything for the new place', async () => {
  const world = await createWorld();
  await world.gladys.fake.configUpdated({ concello: 'A Coruña', station_id: '10157' });
  await world.app.poller.idle;
  const names = world.gladys.fake.discoveredDevices.slice(-2).map((device) => device.name);
  assert.deepEqual(names, ['MeteoGalicia Coruña-Torre de Hércules', 'MeteoGalicia A Coruña']);
  await world.app.stop();
});

test('a scan request publishes the devices again', async () => {
  const world = await createWorld();
  const publications = () => world.gladys.fake.bodies('POST', '/discovered_device').length;
  const before = publications();
  await world.gladys.fake.scanRequest();
  assert.equal(publications(), before + 1);
  assert.equal(world.gladys.fake.discoveredDevices.length, 2);
  await world.app.stop();
});

test('the "list the nearest stations" action: green with distances, red without a place', async () => {
  const world = await createWorld();
  const ack = await world.gladys.fake.action('list_stations', {});
  assert.equal(ack.success, true);
  const lines = ack.data.message.fr.split('\n');
  assert.match(lines[0], /maison « Maison »/);
  assert.match(lines[1], /^10053 Campus Lugo, LUGO \(400 m\) — 2,1 km$/);
  assert.equal(lines.length, 10);
  assert.match(ack.data.message.de, /Kopiere eine ID/);
  await world.app.stop();

  const lost = await createWorld({ houses: [] });
  const failed = await lost.gladys.fake.action('list_stations', {});
  assert.equal(failed.success, false);
  assert.match(failed.error.fr, /Aucun lieu/);
  await lost.app.stop();

  const offline = await createWorld();
  offline.meteo.answers.stations = new TypeError('fetch failed');
  const down = await offline.gladys.fake.action('list_stations', {});
  assert.equal(down.success, false);
  assert.match(down.error.fr, /MeteoGalicia : échec/);
  await offline.app.stop();
});

test('the "check the connection" action reads every source now; a failure shows in red', async () => {
  const world = await createWorld();
  const before = world.meteo.count('forecast');
  const ack = await world.gladys.fake.action('check_connection', {});
  assert.equal(ack.success, true);
  assert.equal(world.meteo.count('forecast'), before + 1);
  assert.match(
    ack.data.message.en,
    /^MeteoGalicia answers\. Campus Lugo: 12\.2 °C at .* Forecast: Lugo \(27028\)\. Warning level today: No warning\.$/,
  );
  assert.match(ack.data.message.fr, /12,2 °C/);

  world.meteo.answers.warningLevels = { status: 500 };
  const failed = await world.gladys.fake.action('check_connection', {});
  assert.equal(failed.success, false);
  assert.match(failed.error.en, /HTTP 500/);
  assert.match(failed.error.fr, /échec/);

  world.meteo.answers.stations = { status: 404 };
  const setup = await world.gladys.fake.action('check_connection', {});
  assert.equal(setup.success, false);
  assert.match(setup.error.es, /MeteoGalicia: error/);
  const infos = world.logs.at('info').filter((line) => /Action: check/.test(line.text));
  assert.equal(infos.length, 3, 'one line per user action');
  await world.app.stop();

  const lost = await createWorld({ houses: [] });
  const none = await lost.gladys.fake.action('check_connection', {});
  assert.equal(none.success, false);
  assert.match(none.error.en, /No location/);
  await lost.app.stop();
});

test('feature names follow the configured language', async () => {
  for (const [language, name] of [
    ['en', 'Temperature'],
    ['fr', 'Température'],
    ['de', 'Temperatur'],
    ['es', 'Temperatura'],
  ]) {
    const world = await createWorld({ config: { language } });
    assert.equal(world.gladys.fake.discoveredDevices[0].features[0].name, name);
    await world.app.stop();
  }
});

test('a scene event Gladys refuses is not recorded: it fires at the next cycle', async () => {
  const world = await createWorld();
  const publish = world.gladys.publishSceneEvent.bind(world.gladys);
  let refuse = true;
  world.gladys.publishSceneEvent = async (...args) => {
    if (refuse) {
      throw new Error('HTTP 503');
    }
    return publish(...args);
  };
  levels(world, [0, 2, 0]);
  await world.refresh();
  assert.equal(world.gladys.fake.sceneEvents.length, 0);
  refuse = false;
  await world.refresh();
  assert.equal(world.gladys.fake.sceneEvents.length, 1);
  await world.refresh();
  assert.equal(world.gladys.fake.sceneEvents.length, 1);
  await world.app.stop();
});

test('a measure invalid at setup gets its feature once it is valid again', async () => {
  const world = await createWorld({ connect: false });
  const recorded = world.meteo.answers.observation;
  world.meteo.answers.observation = (id) =>
    recorded(id).replace(
      /("codigoParametro":"VV_RACHA_10m","lnCodigoValidacion":)1/,
      (_, start) => `${start}2`,
    );
  await world.gladys.connect();
  await world.app.ready;
  const keys = () =>
    world.gladys.fake.discoveredDevices[0].features.map((f) => f.external_id.split(':').pop());
  assert.ok(!keys().includes('wind_gust'));
  world.meteo.answers.observation = recorded;
  await world.refresh();
  assert.ok(keys().includes('wind_gust'));
  await world.app.stop();
});

test('a reconfiguration during a cycle does not keep the data of the old municipality', async () => {
  const world = await createWorld();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const recorded = world.meteo.answers.forecast;
  // The forecast of Lugo arrives only after the configuration changed.
  world.meteo.answers.forecast = async (id) => {
    if (id === '27028') {
      await gate;
    }
    return recorded(id);
  };
  const oldCycle = world.app.service.cycle({ forceForecast: true });
  world.app.service.reset();
  release();
  await oldCycle;
  assert.equal(world.app.service.snapshot().forecast, null, 'the late answer is ignored');
  await world.app.stop();
});

test('a reconfiguration during the setup does not keep the old station', async () => {
  const world = await createWorld({ connect: false });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const recorded = world.meteo.answers.stations;
  world.meteo.answers.stations = async () => {
    await gate;
    return recorded;
  };
  const oldSetup = world.app.service.cycle();
  world.app.service.reset();
  release();
  assert.equal(await oldSetup, false);
  assert.equal(world.app.service.snapshot().target, null);
  await world.app.stop();
});
