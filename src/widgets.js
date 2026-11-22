// -----------------------------------------------------------------------------
// The dashboard widget "MeteoGalicia weather": the station's readings, the
// minimum and maximum of the coming days, the warning levels and the forecast
// in words. Built from what the last refresh read (no request of its own), in
// the language and the unit system of the dashboard: the core caches the
// content per settings, language and units, pre-localizing it here is the
// expected design. Each block can be hidden (setting `hide`).
//
// Budget of the core: 8 components at most, 2 texts, 6 tiles, 1 focal, 1
// status list. This content uses 8 at most: heading, 4 tiles, chart, status,
// caption.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { forecastDays } from './meteogalicia/model.js';
import {
  TEXT,
  WARNING_DAY_NAMES,
  WIDGET_TEXT,
  formatNumber,
  formatWhen,
  levelName,
  pickLanguage,
  skyName,
} from './i18n.js';

/** Widget key: forever. */
export const WIDGET_KEY = 'weather';

/** Blocks the setting `hide` can hide: option values forever. */
export const WIDGET_BLOCKS = ['station', 'chart', 'warnings', 'forecast'];

// Content lifetime: the data moves every 10 minutes; the service also nudges
// the widget after each refresh that changed something.
const TTL_SECONDS = 600;

const LEVEL_COLORS = {
  1: WIDGET_COLORS.WARNING,
  2: WIDGET_COLORS.WARNING,
  3: WIDGET_COLORS.DANGER,
};

const DAY_KEYS = ['today', 'tomorrow', 'day_after'];

const round = (value) => Math.round(value * 10) / 10;

/** Metric values, converted for a dashboard in US units. */
function unitsOf(units) {
  const us = units === 'us';
  return {
    temperature: (celsius) => (us ? round((celsius * 9) / 5 + 32) : celsius),
    temperatureUnit: us ? '°F' : '°C',
    speed: (kmh) => (us ? round(kmh / 1.609344) : kmh),
    speedUnit: us ? 'mph' : 'km/h',
  };
}

const textOnly = (text) => ({
  ttl_seconds: 60,
  components: [{ type: 'text', variant: 'body', text }],
});

/** "Showers · 11 – 16 °C · 55 % rain" */
function dayLine(day, convert, lang, t) {
  if (!day) {
    return null;
  }
  // Forecast temperatures are whole degrees: so are their conversions.
  const n = (value) => formatNumber(Math.round(convert.temperature(value)), lang);
  const parts = [];
  const sky = skyName(day.sky, lang);
  if (sky) {
    parts.push(sky);
  }
  if (day.min !== null && day.max !== null) {
    parts.push(`${n(day.min)} – ${n(day.max)} ${convert.temperatureUnit}`);
  }
  if (day.rainChance !== null) {
    parts.push(`${day.rainChance} % ${t.rain}`);
  }
  // A status value holds 40 characters: the rain chance goes first, never cut.
  while (parts.length > 1 && parts.join(' · ').length > 40) {
    parts.pop();
  }
  return parts.length > 0 ? parts.join(' · ').slice(0, 40) : null;
}

/** The blocks the user chose to hide (a multi_select may arrive as a string). */
function hiddenBlocks(settings) {
  const raw = settings?.hide;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return new Set(list.map((value) => String(value).trim()));
}

/**
 * @param {ReturnType<ReturnType<import('./service.js').createService>['snapshot']>} snapshot
 * @param {{ settings?: object, language: string, units: string, now: number, timeZone?: string }} context
 */
export function buildWeatherContent(snapshot, { settings, language, units, now, timeZone }) {
  const lang = pickLanguage(language);
  const t = WIDGET_TEXT[lang];
  const { target, observation, forecast, levels, title } = snapshot;
  if (!target) {
    // Setup not done yet, or MeteoGalicia did not answer it.
    return textOnly(t.waiting);
  }
  if (!target.station && !target.concello) {
    return textOnly(TEXT[target.problem]?.[lang] ?? t.notConfigured);
  }
  if (!observation && !forecast && !levels) {
    return textOnly(t.waiting);
  }
  const hide = hiddenBlocks(settings);
  const convert = unitsOf(units);
  const components = [
    {
      type: 'text',
      variant: 'heading',
      text: String(title ?? target.concello?.name ?? target.station.name).slice(0, 40),
    },
  ];

  if (!hide.has('station')) {
    const values = observation?.values ?? {};
    const tile = (label, value, unit, icon) =>
      value === undefined ? null : { type: 'value', label, value, unit, icon };
    components.push(
      ...[
        tile(
          t.temperature,
          values.temperature === undefined ? undefined : convert.temperature(values.temperature),
          convert.temperatureUnit,
          'thermometer',
        ),
        tile(t.humidity, values.humidity, '%', 'droplet'),
        tile(
          t.wind,
          values.wind_speed === undefined ? undefined : convert.speed(values.wind_speed),
          convert.speedUnit,
          'wind',
        ),
        tile(
          t.gusts,
          values.wind_gust === undefined ? undefined : convert.speed(values.wind_gust),
          convert.speedUnit,
          'wind',
        ),
      ].filter(Boolean),
    );
  }

  const days = forecast ? forecastDays(forecast, now, timeZone) : null;
  if (!hide.has('chart')) {
    const coming = (days?.all ?? []).filter(
      (day) => day.date >= (days.today?.date ?? '') && day.min !== null && day.max !== null,
    );
    if (coming.length > 1) {
      const series = (name, key) => ({
        name,
        points: coming.map((day) => ({
          t: `${day.date}T12:00:00.000Z`,
          v: convert.temperature(day[key]),
        })),
      });
      components.push({
        type: 'chart',
        chart_type: 'line',
        title: t.forecastChart,
        unit: convert.temperatureUnit,
        series: [series(t.maximum, 'max'), series(t.minimum, 'min')],
      });
    }
  }

  const items = [];
  if (levels && !hide.has('warnings')) {
    const raised = levels.filter((entry) => entry.level > 0 && DAY_KEYS[entry.day]);
    for (const entry of raised) {
      items.push({
        label: WARNING_DAY_NAMES[lang][DAY_KEYS[entry.day]],
        value: levelName(entry.level, lang),
        color: LEVEL_COLORS[entry.level],
        icon: 'alert-triangle',
      });
    }
    if (raised.length === 0) {
      items.push({
        label: t.warnings,
        value: t.none,
        color: WIDGET_COLORS.SUCCESS,
        icon: 'check-circle',
      });
    }
  }
  if (days && !hide.has('forecast')) {
    const today = dayLine(days.today, convert, lang, t);
    if (today) {
      items.push({ label: WARNING_DAY_NAMES[lang].today, value: today, icon: 'sun' });
    }
    const tomorrow = dayLine(days.tomorrow, convert, lang, t);
    if (tomorrow) {
      items.push({
        label: WARNING_DAY_NAMES[lang].tomorrow,
        value: tomorrow,
        icon: 'calendar',
      });
    }
  }
  if (items.length > 0) {
    components.push({ type: 'status', items: items.slice(0, 10) });
  }

  // Attribution asked by MeteoGalicia for any reuse of its data.
  const time =
    observation?.time && !hide.has('station')
      ? ` · ${formatWhen(observation.time, lang, timeZone, now)}`
      : '';
  components.push({ type: 'text', variant: 'caption', text: `${t.source}${time}` });
  return { ttl_seconds: TTL_SECONDS, components };
}
