// The "MeteoGalicia weather" widget: within the core budget (the SDK's own
// validator), localized, in metric and US units, blocks hidden on demand,
// honest when data is missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_BLOCKS, WIDGET_KEY } from '../src/widgets.js';
import { warningLevels } from './helpers/fakeMeteoGalicia.js';
import { createWorld } from './helpers/world.js';

const get = async (world, language = 'en', units = 'metric', settings = {}) => {
  const ack = await world.gladys.fake.widgetGet(WIDGET_KEY, { language, units, settings });
  assert.equal(ack.success, true);
  return ack.data.content;
};
const ofType = (content, type) => content.components.filter((c) => c.type === type);

test('the full content fits the budget and renders exactly as sent', async () => {
  const world = await createWorld();
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const units of ['metric', 'us']) {
      const content = await get(world, language, units);
      assert.deepEqual(validateWidgetContent(content), [], `${language}/${units}`);
      assert.equal(content.components.length, 8);
    }
  }
  const content = await get(world, 'fr');
  assert.equal(ofType(content, 'text')[0].text, 'Lugo');
  assert.deepEqual(
    ofType(content, 'value').map((tile) => [tile.label, tile.value, tile.unit]),
    [
      ['Température', 12.2, '°C'],
      ['Humidité', 74, '%'],
      ['Vent', 11.3, 'km/h'],
      ['Rafales', 21.7, 'km/h'],
    ],
  );
  const [chart] = ofType(content, 'chart');
  assert.deepEqual(
    chart.series.map((series) => [series.name, series.points.map((point) => point.v)]),
    [
      ['Maximale', [13, 14, 11, 11]],
      ['Minimale', [6, 5, 7, 7]],
    ],
  );
  const [status] = ofType(content, 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value]),
    [
      ['Avis', 'Aucun'],
      ["Aujourd'hui", 'Averses faibles · 6 – 13 °C · 55 % pluie'],
      ['Demain', 'Éclaircies · 5 – 14 °C · 55 % pluie'],
    ],
  );
  assert.match(
    ofType(content, 'text').at(-1).text,
    /^Source : MeteoGalicia – Xunta de Galicia · 11:50$/,
  );
  await world.app.stop();
});

test('US units convert temperatures and speeds', async () => {
  const world = await createWorld();
  const content = await get(world, 'en', 'us');
  const tiles = ofType(content, 'value');
  assert.deepEqual([tiles[0].value, tiles[0].unit], [54, '°F']);
  assert.deepEqual([tiles[2].value, tiles[2].unit], [7, 'mph']);
  assert.match(
    ofType(content, 'status')[0].items[1].value,
    /^Light showers · 43 – 55 °F · 55 % rain$/,
  );
  await world.app.stop();
});

test('warning levels show per day, in their colour', async () => {
  const world = await createWorld();
  world.meteo.answers.warningLevels = (id) => warningLevels(id, [1, 3, 0]);
  await world.refresh();
  const [status] = ofType(await get(world, 'es'), 'status');
  assert.deepEqual(
    status.items.slice(0, 2).map((item) => [item.label, item.value, item.color]),
    [
      ['Hoy', 'Amarillo', 'warning'],
      ['Mañana', 'Rojo', 'danger'],
    ],
  );
  await world.app.stop();
});

test('every block can be hidden, the attribution stays', async () => {
  const world = await createWorld();
  const content = await get(world, 'en', 'metric', { hide: WIDGET_BLOCKS });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['text', 'text'],
  );
  assert.equal(content.components[1].text, 'Source: MeteoGalicia – Xunta de Galicia');
  const some = await get(world, 'en', 'metric', { hide: ['station', 'chart'] });
  assert.deepEqual(
    some.components.map((c) => c.type),
    ['text', 'status', 'text'],
  );
  await world.app.stop();
});

test('the heading is the name given in Gladys', async () => {
  const world = await createWorld();
  await world.createAll();
  const concello = world.gladys.devices.find((d) => d.external_id.includes('concello'));
  concello.name = 'Météo de la maison';
  assert.equal(ofType(await get(world), 'text')[0].text, 'Météo de la maison');
  await world.app.stop();
});

test('without location, the widget says so; before any data, it waits', async () => {
  const lost = await createWorld({ houses: [] });
  const content = await get(lost, 'fr');
  assert.equal(content.components.length, 1);
  assert.match(content.components[0].text, /^Aucun lieu/);
  await lost.app.stop();

  const down = await createWorld({ connect: false });
  down.meteo.answers.observation = new Error('offline');
  down.meteo.answers.forecast = new Error('offline');
  down.meteo.answers.warningLevels = new Error('offline');
  await down.gladys.connect();
  await down.app.ready;
  assert.match((await get(down)).components[0].text, /Waiting|MeteoGalicia does not answer/);
  await down.app.stop();
});
