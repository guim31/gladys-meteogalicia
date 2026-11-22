// The pure parsers, on the real MeteoGalicia answers of test/fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findConcello,
  forecastDays,
  parseConcellos,
  parseForecast,
  parseObservation,
  parseStations,
  parseWarningLevels,
  skyKey,
  value,
} from '../src/meteogalicia/model.js';
import { createMeteoGaliciaClient } from '../src/meteogalicia/client.js';
import { FIXTURES, NOW, TIME_ZONE } from './helpers/fakeMeteoGalicia.js';

const stations = parseStations(JSON.parse(FIXTURES.stations));
const concellos = parseConcellos(JSON.parse(FIXTURES.concellos));

test('the station and municipality lists', () => {
  assert.equal(stations.length, 155);
  assert.deepEqual(
    stations.find((s) => s.id === '10157'),
    {
      id: '10157',
      name: 'Coruña-Torre de Hércules',
      lat: 43.382763,
      lon: -8.409202,
      altitude: 21,
      concello: 'A CORUÑA',
      province: 'A Coruña',
    },
  );
  assert.equal(concellos.length, 313);
  assert.throws(() => parseStations({}), /station list/);
});

test('every station municipality is found in the municipality list', () => {
  const missing = stations.filter((s) => !findConcello(concellos, s.concello));
  assert.deepEqual(
    missing.map((s) => s.concello),
    [],
  );
});

test('a municipality by INE code, by name, without accent or article', () => {
  assert.equal(findConcello(concellos, '15030').name, 'A Coruña');
  assert.equal(findConcello(concellos, 'a coruna').id, '15030');
  assert.equal(findConcello(concellos, 'Coruña').id, '15030');
  assert.equal(findConcello(concellos, 'SANTIAGO DE COMPOSTELA').id, '15078');
  assert.equal(findConcello(concellos, 'A ARNOIA').id, '32003');
  assert.equal(findConcello(concellos, 'Cangas').id, '36008');
  assert.equal(findConcello(concellos, '99999'), null);
  assert.equal(findConcello(concellos, 'Lisboa'), null);
  assert.equal(findConcello(concellos, ''), null);
});

test('a 10-minute reading: valid values only, converted, -9999 ignored', () => {
  const reading = parseObservation(JSON.parse(FIXTURES.observations[10053]));
  assert.equal(reading.id, '10053');
  assert.equal(reading.time, Date.parse('2026-11-22T10:50:00Z'));
  assert.deepEqual(reading.values, {
    temperature: 12.2,
    dew_point: 7.6,
    humidity: 74,
    pressure: 1026.1,
    wind_speed: 11.3,
    wind_gust: 21.7,
    wind_direction: 229,
    rain_rate: 0,
  });
  assert.equal(parseObservation({ listUltimos10min: [] }), null);
  assert.equal(value(-9999), null);
  assert.equal(value('12'), null);
  assert.throws(() => parseObservation({}), /observation/);
});

test('the forecast of a municipality, today and tomorrow in the Gladys time zone', () => {
  const forecast = parseForecast(JSON.parse(FIXTURES.forecasts[27028]));
  assert.equal(forecast.name, 'Lugo');
  assert.equal(forecast.days.length, 4);
  const { today, tomorrow } = forecastDays(forecast, NOW, TIME_ZONE);
  assert.deepEqual(today, {
    date: '2026-11-22',
    sky: 'light_showers',
    min: 6,
    max: 13,
    rainChance: 55,
    uv: 2,
  });
  assert.equal(tomorrow.sky, 'partly_cloudy');
  assert.equal(parseForecast({ predConcello: null }), null);
  assert.throws(() => parseForecast({}), /forecast/);
});

test('sky codes: day and night icons share their meaning', () => {
  assert.equal(skyKey(101), 'clear');
  assert.equal(skyKey(201), 'clear');
  assert.equal(skyKey(125), 'overcast');
  assert.equal(skyKey(-9999), null);
  assert.equal(skyKey(326), null);
});

test('warning levels per day, for the municipality asked only', () => {
  assert.deepEqual(parseWarningLevels(JSON.parse(FIXTURES.warningLevels), '27028'), [
    { day: 0, level: 0 },
    { day: 1, level: 0 },
    { day: 2, level: 0 },
  ]);
  assert.deepEqual(parseWarningLevels(JSON.parse(FIXTURES.warningLevels), '15030'), []);
  assert.throws(() => parseWarningLevels({}), /warning/);
});

test('the client: HTTP errors, non-JSON answers and network failures are errors', async () => {
  const answer =
    (body, status = 200) =>
    async () =>
      new Response(body, { status });
  const ok = createMeteoGaliciaClient({ fetch: answer('{"predConcello":null}') });
  assert.deepEqual(await ok.forecast('15030'), { predConcello: null });
  await assert.rejects(
    createMeteoGaliciaClient({ fetch: answer('down', 503) }).stations(),
    /HTTP 503/,
  );
  await assert.rejects(
    createMeteoGaliciaClient({ fetch: answer('<html></html>') }).stations(),
    /not JSON/,
  );
  await assert.rejects(
    createMeteoGaliciaClient({
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    }).stations(),
    /servizos\.meteogalicia\.gal unreachable \(fetch failed\)/,
  );
});
