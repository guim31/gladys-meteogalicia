// -----------------------------------------------------------------------------
// Pure functions over the MeteoGalicia JSON answers: stations, one station's
// 10-minute reading, municipalities, daily forecast, warning levels. No I/O,
// no clock: everything that depends on "now" receives it.
//
// Facts checked against the live service and its documentation
// (JSON_Pred_Concello_gl.pdf, 22 November 2026):
//   - a value not available is -9999;
//   - the reading time `instanteLecturaUTC` is UTC without a zone suffix;
//   - `dataPredicion` is a local calendar day ("2026-11-22T00:00:00");
//   - sky codes 101-125 are day icons, 201-225 the same skies at night;
//   - an unknown municipality answers `{ "predConcello": null }` (HTTP 200),
//     an unknown station `{ "listUltimos10min": [] }`.
// -----------------------------------------------------------------------------

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** A number from the service, null when missing or "not available" (-9999). */
export function value(raw) {
  const number = typeof raw === 'number' ? raw : Number.NaN;
  return Number.isFinite(number) && number > -9000 ? number : null;
}

/** Station ids are numbers (10157); kept as strings. */
export const STATION_ID_PATTERN = /^\d{4,6}$/;
/** Municipality ids are the 5-digit INE codes (15030 = A Coruña). */
export const CONCELLO_ID_PATTERN = /^\d{5}$/;

/** @returns {Array<{ id: string, name: string, lat: number, lon: number, altitude: number | null, concello: string, province: string }>} */
export function parseStations(data) {
  const list = data?.listaEstacionsMeteo;
  if (!Array.isArray(list)) {
    throw new Error('unexpected station list');
  }
  return list
    .filter((s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lon) && s.idEstacion != null)
    .map((s) => ({
      id: String(s.idEstacion),
      name: String(s.estacion ?? s.idEstacion),
      lat: s.lat,
      lon: s.lon,
      altitude: value(s.altitude),
      concello: String(s.concello ?? ''),
      province: String(s.provincia ?? ''),
    }));
}

// The measures published, by feature key: the parameter codes in order of
// preference (a station has its anemometer at 10 m, or at 2 m).
const MEASURES = {
  temperature: ['TA_AVG_1.5m'],
  dew_point: ['TO_AVG_1.5m'],
  humidity: ['HR_AVG_1.5m'],
  pressure: ['PRED_AVG_1.5m'],
  wind_speed: ['VV_AVG_10m', 'VV_AVG_2m'],
  wind_gust: ['VV_RACHA_10m', 'VV_RACHA_2m'],
  wind_direction: ['DV_AVG_10m', 'DV_AVG_2m'],
  rain_rate: ['PP_SUM_1.5m'],
};

// Validation code of a measure: 1 is a valid original value. The others
// (doubtful, wrong, not recorded) are never published.
const VALID = 1;

const CONVERT = {
  wind_speed: (ms) => round(ms * 3.6),
  wind_gust: (ms) => round(ms * 3.6),
  wind_direction: (deg) => Math.round(deg) % 360,
  // L/m² fallen in 10 minutes = mm in 10 minutes → mm/h.
  rain_rate: (mm) => round(mm * 6),
  humidity: (percent) => Math.round(percent),
  pressure: (hpa) => round(hpa),
  temperature: (c) => round(c),
  dew_point: (c) => round(c),
};

/**
 * The last reading of one station, null when the station is unknown.
 * @returns {{ id: string, name: string, time: number | null, values: Record<string, number> } | null}
 */
export function parseObservation(data) {
  const list = data?.listUltimos10min;
  if (!Array.isArray(list)) {
    throw new Error('unexpected observation answer');
  }
  const [entry] = list;
  if (!entry) {
    return null;
  }
  const measures = new Map();
  for (const measure of entry.listaMedidas ?? []) {
    const number = value(measure?.valor);
    if (number !== null && measure.lnCodigoValidacion === VALID) {
      measures.set(measure.codigoParametro, number);
    }
  }
  const values = {};
  for (const [key, codes] of Object.entries(MEASURES)) {
    const code = codes.find((candidate) => measures.has(candidate));
    if (code) {
      values[key] = CONVERT[key](measures.get(code));
    }
  }
  const time = Date.parse(`${entry.instanteLecturaUTC}Z`);
  return {
    id: String(entry.idEstacion),
    name: String(entry.estacion ?? ''),
    time: Number.isFinite(time) ? time : null,
    values,
  };
}

/** @returns {Array<{ id: string, name: string }>} the 313 municipalities */
export function parseConcellos(data) {
  const list = data?.listaObservacionConcellos;
  if (!Array.isArray(list)) {
    throw new Error('unexpected municipality list');
  }
  return list
    .filter((c) => c?.idConcello != null && c.nomeConcello)
    .map((c) => ({ id: String(c.idConcello), name: String(c.nomeConcello) }));
}

/** "A Coruña" → "a coruna": lower case, no accent, words only. */
export function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// The service spells some names with or without their article ("A ARNOIA"
// in the station list, "Arnoia" in the municipality list; "de Cangas").
const ARTICLES = new Set(['a', 'o', 'as', 'os', 'de']);
const bareName = (name) =>
  normalizeName(name)
    .split(' ')
    .filter((word, index, words) => !(ARTICLES.has(word) && words.length > 1))
    .join(' ');

/**
 * The municipality matching an INE code or a name, null when none.
 * @param {Array<{ id: string, name: string }>} concellos
 * @param {string} query
 */
export function findConcello(concellos, query) {
  const text = String(query ?? '').trim();
  if (text === '') {
    return null;
  }
  if (CONCELLO_ID_PATTERN.test(text)) {
    return concellos.find((c) => c.id === text) ?? null;
  }
  const exact = normalizeName(text);
  const found = concellos.find((c) => normalizeName(c.name) === exact);
  if (found) {
    return found;
  }
  const bare = bareName(text);
  return concellos.find((c) => bareName(c.name) === bare) ?? null;
}

/** Great-circle distance in km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The `count` places nearest to a point, each with its `distance` in km. */
export function nearest(places, lat, lon, count = 1) {
  return places
    .map((place) => ({ ...place, distance: distanceKm(lat, lon, place.lat, place.lon) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

/**
 * Sky codes (annex II of the documentation), by code modulo 100: the night
 * icons (2xx) show the same skies as the day ones (1xx).
 */
export const SKY_KEYS = {
  1: 'clear',
  2: 'high_clouds',
  3: 'partly_cloudy',
  4: 'cloudy',
  5: 'very_cloudy',
  6: 'fog',
  7: 'showers',
  8: 'cloudy_showers',
  9: 'snow_showers',
  10: 'drizzle',
  11: 'rain',
  12: 'snow',
  13: 'thunderstorm',
  14: 'mist',
  15: 'fog_banks',
  16: 'mid_clouds',
  17: 'light_rain',
  18: 'light_showers',
  19: 'thunderstorm_few_clouds',
  20: 'sleet',
  21: 'hail',
  22: 'cloudy_light_showers',
  23: 'cloudy_snow',
  24: 'haze',
  25: 'overcast',
};

/** The sky key of a code (101 → "clear"), null when unknown or not available. */
export function skyKey(code) {
  const number = value(code);
  if (number === null || number < 100 || number >= 300) {
    return null;
  }
  return SKY_KEYS[number % 100] ?? null;
}

const SLOTS = ['manha', 'tarde', 'noite'];

/**
 * The daily forecast of a municipality, null when the service has none (an
 * unknown id).
 * @returns {{ id: string, name: string, days: Array<{ date: string, sky: string | null, min: number | null, max: number | null, rainChance: number | null, uv: number | null }> } | null}
 */
export function parseForecast(data) {
  if (!data || !('predConcello' in data)) {
    throw new Error('unexpected forecast answer');
  }
  const forecast = data.predConcello;
  if (!forecast) {
    return null;
  }
  const days = (forecast.listaPredDiaConcello ?? [])
    .filter((day) => typeof day?.dataPredicion === 'string')
    .map((day) => {
      const chances = SLOTS.map((slot) => value(day.pchoiva?.[slot])).filter((v) => v !== null);
      return {
        date: day.dataPredicion.slice(0, 10),
        sky: skyKey(day.ceoDia),
        min: value(day.tMin),
        max: value(day.tMax),
        rainChance: chances.length > 0 ? Math.max(...chances) : null,
        uv: value(day.uvMax),
      };
    });
  return { id: String(forecast.idConcello), name: String(forecast.nome ?? ''), days };
}

/** Warning levels of MeteoGalicia (0 = none). */
export const WARNING_LEVELS = { 1: 'yellow', 2: 'orange', 3: 'red' };
export const WARNING_LEVEL_KEYS = Object.values(WARNING_LEVELS);

/**
 * The highest warning level of a municipality for each day of the answer
 * (0 = today), from 0 (none) to 3 (red).
 * @returns {Array<{ day: number, level: number }>}
 */
export function parseWarningLevels(data, concelloId) {
  const days = data?.listaDiaConcellos;
  if (!Array.isArray(days)) {
    throw new Error('unexpected warning answer');
  }
  const levels = [];
  for (const day of days) {
    const entry = (day?.listaNiveisMaximos ?? []).find(
      (candidate) => String(candidate?.idConcello) === String(concelloId),
    );
    const level = value(entry?.nivelMax);
    if (Number.isInteger(day?.dia) && level !== null && level >= 0 && level <= 3) {
      levels.push({ day: day.dia, level });
    }
  }
  return levels.sort((a, b) => a.day - b.day);
}

/** Local calendar day (YYYY-MM-DD) of an instant, in the Gladys time zone. */
export function localDay(time, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(time));
}

/** The calendar day `offset` days after a YYYY-MM-DD date. */
export function addDays(date, offset) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

/** The zone of the days of MeteoGalicia (forecast dates, warning days). */
export const SERVICE_TIME_ZONE = 'Europe/Madrid';

/**
 * Today's and tomorrow's forecast, null when not published. "Today" is the
 * Galician day the forecast dates refer to, whatever the zone of Gladys.
 */
export function forecastDays(forecast, now) {
  const today = localDay(now, SERVICE_TIME_ZONE);
  // The next calendar day, not now + 24 h: a DST night has 23 or 25 hours.
  const tomorrow = addDays(today, 1);
  const day = (date) => forecast?.days.find((entry) => entry.date === date) ?? null;
  return { today: day(today), tomorrow: day(tomorrow), all: forecast?.days ?? [] };
}
