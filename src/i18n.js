// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface: English, French, German (informal "du") and Spanish (formal
// "usted"). Feature names follow the `language` of the configuration (they are
// frozen once the device is created); widget texts follow the language of the
// dashboard. test/i18n.test.js checks every table. Brand names (MeteoGalicia)
// are never translated.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Feature names, by language then feature key. */
export const FEATURE_NAMES = {
  en: {
    temperature: 'Temperature',
    dew_point: 'Dew point',
    humidity: 'Humidity',
    pressure: 'Pressure (sea level)',
    wind_speed: 'Wind speed',
    wind_gust: 'Wind gusts',
    wind_direction: 'Wind direction',
    rain_rate: 'Rain intensity',
    condition: 'Weather today',
    today_min: 'Minimum today',
    today_max: 'Maximum today',
    uv_index: 'UV index today',
    tomorrow_condition: 'Weather tomorrow',
    tomorrow_min: 'Minimum tomorrow',
    tomorrow_max: 'Maximum tomorrow',
    warning_level: 'Warning level today',
    warning_level_tomorrow: 'Warning level tomorrow',
    warnings: 'Weather warnings',
  },
  fr: {
    temperature: 'Température',
    dew_point: 'Point de rosée',
    humidity: 'Humidité',
    pressure: 'Pression (niveau de la mer)',
    wind_speed: 'Vitesse du vent',
    wind_gust: 'Rafales',
    wind_direction: 'Direction du vent',
    rain_rate: 'Intensité de pluie',
    condition: "Temps aujourd'hui",
    today_min: "Minimale aujourd'hui",
    today_max: "Maximale aujourd'hui",
    uv_index: "Indice UV aujourd'hui",
    tomorrow_condition: 'Temps demain',
    tomorrow_min: 'Minimale demain',
    tomorrow_max: 'Maximale demain',
    warning_level: "Niveau d'avis aujourd'hui",
    warning_level_tomorrow: "Niveau d'avis demain",
    warnings: 'Avis météo',
  },
  de: {
    temperature: 'Temperatur',
    dew_point: 'Taupunkt',
    humidity: 'Luftfeuchtigkeit',
    pressure: 'Luftdruck (Meeresniveau)',
    wind_speed: 'Windgeschwindigkeit',
    wind_gust: 'Windböen',
    wind_direction: 'Windrichtung',
    rain_rate: 'Regenintensität',
    condition: 'Wetter heute',
    today_min: 'Minimum heute',
    today_max: 'Maximum heute',
    uv_index: 'UV-Index heute',
    tomorrow_condition: 'Wetter morgen',
    tomorrow_min: 'Minimum morgen',
    tomorrow_max: 'Maximum morgen',
    warning_level: 'Warnstufe heute',
    warning_level_tomorrow: 'Warnstufe morgen',
    warnings: 'Wetterwarnungen',
  },
  es: {
    temperature: 'Temperatura',
    dew_point: 'Punto de rocío',
    humidity: 'Humedad',
    pressure: 'Presión (nivel del mar)',
    wind_speed: 'Velocidad del viento',
    wind_gust: 'Rachas de viento',
    wind_direction: 'Dirección del viento',
    rain_rate: 'Intensidad de lluvia',
    condition: 'Tiempo hoy',
    today_min: 'Mínima hoy',
    today_max: 'Máxima hoy',
    uv_index: 'Índice UV hoy',
    tomorrow_condition: 'Tiempo mañana',
    tomorrow_min: 'Mínima mañana',
    tomorrow_max: 'Máxima mañana',
    warning_level: 'Nivel de aviso hoy',
    warning_level_tomorrow: 'Nivel de aviso mañana',
    warnings: 'Avisos meteorológicos',
  },
};

/** Sky of a forecast (annex II of MeteoGalicia), by language then sky key. */
export const SKY_NAMES = {
  en: {
    clear: 'Clear',
    high_clouds: 'High clouds',
    partly_cloudy: 'Partly cloudy',
    cloudy: 'Cloudy',
    very_cloudy: 'Very cloudy',
    fog: 'Fog',
    showers: 'Showers',
    cloudy_showers: 'Cloudy with showers',
    snow_showers: 'Snow showers',
    drizzle: 'Drizzle',
    rain: 'Rain',
    snow: 'Snow',
    thunderstorm: 'Thunderstorm',
    mist: 'Mist',
    fog_banks: 'Fog banks',
    mid_clouds: 'Mid-level clouds',
    light_rain: 'Light rain',
    light_showers: 'Light showers',
    thunderstorm_few_clouds: 'Thunderstorm, few clouds',
    sleet: 'Sleet',
    hail: 'Hail',
    cloudy_light_showers: 'Cloudy, light showers',
    cloudy_snow: 'Cloudy with snow',
    haze: 'Haze',
    overcast: 'Overcast',
  },
  fr: {
    clear: 'Dégagé',
    high_clouds: 'Nuages élevés',
    partly_cloudy: 'Éclaircies',
    cloudy: 'Nuageux',
    very_cloudy: 'Très nuageux',
    fog: 'Brouillard',
    showers: 'Averses',
    cloudy_showers: 'Nuageux avec averses',
    snow_showers: 'Averses de neige',
    drizzle: 'Bruine',
    rain: 'Pluie',
    snow: 'Neige',
    thunderstorm: 'Orage',
    mist: 'Brume',
    fog_banks: 'Bancs de brouillard',
    mid_clouds: 'Nuages moyens',
    light_rain: 'Pluie faible',
    light_showers: 'Averses faibles',
    thunderstorm_few_clouds: 'Orage, peu nuageux',
    sleet: 'Pluie et neige',
    hail: 'Grêle',
    cloudy_light_showers: 'Couvert, averses faibles',
    cloudy_snow: 'Couvert avec neige',
    haze: 'Brume sèche',
    overcast: 'Couvert',
  },
  de: {
    clear: 'Klar',
    high_clouds: 'Hohe Wolken',
    partly_cloudy: 'Teils bewölkt',
    cloudy: 'Bewölkt',
    very_cloudy: 'Stark bewölkt',
    fog: 'Nebel',
    showers: 'Schauer',
    cloudy_showers: 'Bewölkt mit Schauern',
    snow_showers: 'Schneeschauer',
    drizzle: 'Nieselregen',
    rain: 'Regen',
    snow: 'Schnee',
    thunderstorm: 'Gewitter',
    mist: 'Dunst',
    fog_banks: 'Nebelbänke',
    mid_clouds: 'Mittelhohe Wolken',
    light_rain: 'Leichter Regen',
    light_showers: 'Leichte Schauer',
    thunderstorm_few_clouds: 'Gewitter, wenig Wolken',
    sleet: 'Schneeregen',
    hail: 'Hagel',
    cloudy_light_showers: 'Bedeckt, leichte Schauer',
    cloudy_snow: 'Bedeckt mit Schnee',
    haze: 'Trockener Dunst',
    overcast: 'Bedeckt',
  },
  es: {
    clear: 'Despejado',
    high_clouds: 'Nubes altas',
    partly_cloudy: 'Nubes y claros',
    cloudy: 'Nublado',
    very_cloudy: 'Muy nublado',
    fog: 'Niebla',
    showers: 'Chubascos',
    cloudy_showers: 'Nublado con chubascos',
    snow_showers: 'Chubascos de nieve',
    drizzle: 'Llovizna',
    rain: 'Lluvia',
    snow: 'Nieve',
    thunderstorm: 'Tormenta',
    mist: 'Neblina',
    fog_banks: 'Bancos de niebla',
    mid_clouds: 'Nubes medias',
    light_rain: 'Lluvia débil',
    light_showers: 'Chubascos débiles',
    thunderstorm_few_clouds: 'Tormenta con pocas nubes',
    sleet: 'Aguanieve',
    hail: 'Granizo',
    cloudy_light_showers: 'Nublado, chubascos débiles',
    cloudy_snow: 'Cubierto con nieve',
    haze: 'Calima',
    overcast: 'Cubierto',
  },
};

/** Warning levels, by language then level key. */
export const WARNING_LEVEL_NAMES = {
  en: { yellow: 'Yellow', orange: 'Orange', red: 'Red' },
  fr: { yellow: 'Jaune', orange: 'Orange', red: 'Rouge' },
  de: { yellow: 'Gelb', orange: 'Orange', red: 'Rot' },
  es: { yellow: 'Amarillo', orange: 'Naranja', red: 'Rojo' },
};

/** Days of a warning level, by language then day key. */
export const WARNING_DAY_NAMES = {
  en: { today: 'Today', tomorrow: 'Tomorrow', day_after: 'Day after tomorrow' },
  fr: { today: "Aujourd'hui", tomorrow: 'Demain', day_after: 'Après-demain' },
  de: { today: 'Heute', tomorrow: 'Morgen', day_after: 'Übermorgen' },
  es: { today: 'Hoy', tomorrow: 'Mañana', day_after: 'Pasado mañana' },
};

export const TEXT = {
  noWarning: {
    en: 'No warning',
    fr: 'Aucun avis',
    de: 'Keine Warnung',
    es: 'Ningún aviso',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
    de: 'Die Initialisierung ist fehlgeschlagen, sieh in den Protokollen der Integration nach.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  notConfigured: {
    en: 'No location: set the position of a Gladys house, or pick a house, coordinates, a station or a municipality.',
    fr: "Aucun lieu : renseignez la position d'une maison Gladys, ou choisissez une maison, des coordonnées, une station ou une commune.",
    de: 'Kein Ort: Lege die Position eines Gladys-Zuhauses fest oder wähle ein Zuhause, Koordinaten, eine Station oder eine Gemeinde.',
    es: 'Ningún lugar: defina la posición de una casa de Gladys, o elija una casa, coordenadas, una estación o un municipio.',
  },
  coordinatesInvalid: {
    en: 'The latitude and longitude are not readable: type two numbers, such as 43.37 and -8.40.',
    fr: 'Latitude et longitude illisibles : saisissez deux nombres, comme 43,37 et -8,40.',
    de: 'Breiten- und Längengrad sind nicht lesbar: Gib zwei Zahlen ein, etwa 43,37 und -8,40.',
    es: 'La latitud y la longitud no son legibles: escriba dos números, como 43,37 y -8,40.',
  },
  stationIdInvalid: {
    en: 'A station id is a number such as 10157: use the "List the nearest stations" action.',
    fr: "Un identifiant de station est un nombre comme 10157 : utilisez l'action « Lister les stations proches ».",
    de: 'Eine Stations-ID ist eine Zahl wie 10157: Nutze die Aktion „Nächste Stationen anzeigen“.',
    es: 'Un identificador de estación es un número como 10157: use la acción «Listar las estaciones cercanas».',
  },
  houseNotFound: {
    en: 'The chosen house no longer exists or has no position: pick it again, or set its position in Gladys.',
    fr: "La maison choisie n'existe plus ou n'a pas de position : choisissez-la de nouveau, ou placez-la dans Gladys.",
    de: 'Das gewählte Zuhause gibt es nicht mehr oder es hat keine Position: Wähle es erneut oder lege seine Position in Gladys fest.',
    es: 'La casa elegida ya no existe o no tiene posición: elíjala de nuevo, o defina su posición en Gladys.',
  },
  outsideArea: {
    en: 'This location is outside Galicia: MeteoGalicia only covers Galicia. Type a station or a municipality.',
    fr: 'Ce lieu est hors de Galice : MeteoGalicia ne couvre que la Galice. Indiquez une station ou une commune.',
    de: 'Dieser Ort liegt außerhalb Galiciens: MeteoGalicia deckt nur Galicien ab. Gib eine Station oder eine Gemeinde an.',
    es: 'Este lugar está fuera de Galicia: MeteoGalicia solo cubre Galicia. Indique una estación o un municipio.',
  },
  stationUnknown: {
    en: 'This station id is not among the MeteoGalicia stations: use the "List the nearest stations" action.',
    fr: "Cet identifiant ne correspond à aucune station de MeteoGalicia : utilisez l'action « Lister les stations proches ».",
    de: 'Diese ID gehört zu keiner MeteoGalicia-Station: Nutze die Aktion „Nächste Stationen anzeigen“.',
    es: 'Este identificador no corresponde a ninguna estación de MeteoGalicia: use la acción «Listar las estaciones cercanas».',
  },
  concelloUnknown: {
    en: 'This municipality is not among the 313 of Galicia: type its INE code (15030) or its name (A Coruña).',
    fr: 'Cette commune ne fait pas partie des 313 de Galice : saisissez son code INE (15030) ou son nom (A Coruña).',
    de: 'Diese Gemeinde gehört nicht zu den 313 Galiciens: Gib ihren INE-Code (15030) oder ihren Namen (A Coruña) ein.',
    es: 'Este municipio no está entre los 313 de Galicia: escriba su código INE (15030) o su nombre (A Coruña).',
  },
  unreachable: {
    en: 'MeteoGalicia does not answer: the values will be updated when it is back.',
    fr: 'MeteoGalicia ne répond pas : les valeurs seront mises à jour à son retour.',
    de: 'MeteoGalicia antwortet nicht: Die Werte werden aktualisiert, sobald der Dienst zurück ist.',
    es: 'MeteoGalicia no responde: los valores se actualizarán cuando vuelva.',
  },
};

/** Texts of the widget, by language. */
export const WIDGET_TEXT = {
  en: {
    humidity: 'Humidity',
    wind: 'Wind',
    gusts: 'Gusts',
    temperature: 'Temperature',
    forecastChart: 'Coming days',
    minimum: 'Minimum',
    maximum: 'Maximum',
    warnings: 'Warnings',
    none: 'None',
    rain: 'rain',
    source: 'Source: MeteoGalicia – Xunta de Galicia',
    notConfigured: 'Set the location in the integration configuration.',
    waiting: 'Waiting for the first MeteoGalicia data…',
  },
  fr: {
    humidity: 'Humidité',
    wind: 'Vent',
    gusts: 'Rafales',
    temperature: 'Température',
    forecastChart: 'Prochains jours',
    minimum: 'Minimale',
    maximum: 'Maximale',
    warnings: 'Avis',
    none: 'Aucun',
    rain: 'pluie',
    source: 'Source : MeteoGalicia – Xunta de Galicia',
    notConfigured: "Indiquez le lieu dans la configuration de l'intégration.",
    waiting: 'En attente des premières données de MeteoGalicia…',
  },
  de: {
    humidity: 'Feuchte',
    wind: 'Wind',
    gusts: 'Böen',
    temperature: 'Temperatur',
    forecastChart: 'Nächste Tage',
    minimum: 'Minimum',
    maximum: 'Maximum',
    warnings: 'Warnungen',
    none: 'Keine',
    rain: 'Regen',
    source: 'Quelle: MeteoGalicia – Xunta de Galicia',
    notConfigured: 'Lege den Ort in der Konfiguration der Integration fest.',
    waiting: 'Warte auf die ersten MeteoGalicia-Daten…',
  },
  es: {
    humidity: 'Humedad',
    wind: 'Viento',
    gusts: 'Rachas',
    temperature: 'Temperatura',
    forecastChart: 'Próximos días',
    minimum: 'Mínima',
    maximum: 'Máxima',
    warnings: 'Avisos',
    none: 'Ninguno',
    rain: 'lluvia',
    source: 'Fuente: MeteoGalicia – Xunta de Galicia',
    notConfigured: 'Indique el lugar en la configuración de la integración.',
    waiting: 'Esperando los primeros datos de MeteoGalicia…',
  },
};

/** Texts of the configuration actions, by language. */
export const ACTION_TEXT = {
  en: {
    nearest: (where) => `Nearest MeteoGalicia stations to ${where}:`,
    station: (s) => `${s.id} ${s.name}, ${s.concello} (${s.altitude} m) — ${s.distance} km`,
    copy: 'Copy an id into "Weather station" and save, or leave it empty for the nearest one.',
    checkOk: (parts) => `MeteoGalicia answers. ${parts}`,
    observation: (label, value, time) => `${label}: ${value} °C at ${time}.`,
    forecastOk: (name, id) => `Forecast: ${name} (${id}).`,
    warningLevel: (level) => `Warning level today: ${level}.`,
    failed: (what, reason) => `${what} failed: ${reason}.`,
    stationPart: 'Station',
    forecastPart: 'Forecast',
    warningsPart: 'Warnings',
    yourHouse: (name) => `the house “${name}”`,
    coordinates: 'the configured coordinates',
  },
  fr: {
    nearest: (where) => `Stations MeteoGalicia les plus proches de ${where} :`,
    station: (s) => `${s.id} ${s.name}, ${s.concello} (${s.altitude} m) — ${s.distance} km`,
    copy: 'Copiez un identifiant dans « Station météo » et enregistrez, ou laissez vide pour la plus proche.',
    checkOk: (parts) => `MeteoGalicia répond. ${parts}`,
    observation: (label, value, time) => `${label} : ${value} °C à ${time}.`,
    forecastOk: (name, id) => `Prévisions : ${name} (${id}).`,
    warningLevel: (level) => `Niveau d'avis aujourd'hui : ${level}.`,
    failed: (what, reason) => `${what} : échec (${reason}).`,
    stationPart: 'Station',
    forecastPart: 'Prévisions',
    warningsPart: 'Avis',
    yourHouse: (name) => `la maison « ${name} »`,
    coordinates: 'les coordonnées saisies',
  },
  de: {
    nearest: (where) => `Nächste MeteoGalicia-Stationen – ${where}:`,
    station: (s) => `${s.id} ${s.name}, ${s.concello} (${s.altitude} m) — ${s.distance} km`,
    copy: 'Kopiere eine ID in „Wetterstation“ und speichere, oder lass das Feld leer für die nächste.',
    checkOk: (parts) => `MeteoGalicia antwortet. ${parts}`,
    observation: (label, value, time) => `${label}: ${value} °C um ${time}.`,
    forecastOk: (name, id) => `Vorhersage: ${name} (${id}).`,
    warningLevel: (level) => `Warnstufe heute: ${level}.`,
    failed: (what, reason) => `${what} fehlgeschlagen: ${reason}.`,
    stationPart: 'Station',
    forecastPart: 'Vorhersage',
    warningsPart: 'Warnungen',
    yourHouse: (name) => `Zuhause „${name}“`,
    coordinates: 'eingegebene Koordinaten',
  },
  es: {
    nearest: (where) => `Estaciones de MeteoGalicia más cercanas a ${where}:`,
    station: (s) => `${s.id} ${s.name}, ${s.concello} (${s.altitude} m) — ${s.distance} km`,
    copy: 'Copie un identificador en «Estación meteorológica» y guarde, o déjelo vacío para la más cercana.',
    checkOk: (parts) => `MeteoGalicia responde. ${parts}`,
    observation: (label, value, time) => `${label}: ${value} °C a las ${time}.`,
    forecastOk: (name, id) => `Previsión: ${name} (${id}).`,
    warningLevel: (level) => `Nivel de aviso hoy: ${level}.`,
    failed: (what, reason) => `${what}: error (${reason}).`,
    stationPart: 'Estación',
    forecastPart: 'Previsión',
    warningsPart: 'Avisos',
    yourHouse: (name) => `la casa «${name}»`,
    coordinates: 'las coordenadas indicadas',
  },
};

/** The language to use, English for anything Gladys may send we do not know. */
export const pickLanguage = (language) => (LANGUAGES.includes(language) ? language : 'en');

/** Localized sky of a forecast day, null when unknown. */
export const skyName = (sky, language) => (sky && SKY_NAMES[pickLanguage(language)][sky]) || null;

/** A decimal number with the separator of the language: 8.6 → "8,6" in French. */
export const formatNumber = (value, language, digits = 1) =>
  new Intl.NumberFormat(pickLanguage(language), { maximumFractionDigits: digits }).format(value);

/** The name of a warning level from 0 to 3 ("None" for 0). */
export function levelName(level, language) {
  const lang = pickLanguage(language);
  const key = ['', 'yellow', 'orange', 'red'][level];
  return key ? WARNING_LEVEL_NAMES[lang][key] : TEXT.noWarning[lang];
}

/** "Today: Yellow · Tomorrow: Orange", null when no day has a warning. */
export function levelsSummary(levels, language) {
  const lang = pickLanguage(language);
  const days = ['today', 'tomorrow', 'day_after'];
  const parts = (levels ?? [])
    .filter((entry) => entry.level > 0 && days[entry.day])
    .map((entry) => `${WARNING_DAY_NAMES[lang][days[entry.day]]}: ${levelName(entry.level, lang)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** A short local date and time: "Tue 18:00" in the Gladys time zone. */
export function formatWhen(time, language, timeZone, now) {
  const lang = pickLanguage(language);
  const sameDay =
    new Date(time).toLocaleDateString('en-CA', { timeZone }) ===
    new Date(now).toLocaleDateString('en-CA', { timeZone });
  return new Intl.DateTimeFormat(lang, {
    timeZone,
    ...(sameDay ? {} : { weekday: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A short local day: "Mon 23" (a forecast date, YYYY-MM-DD). */
export function formatDay(date, language) {
  return new Intl.DateTimeFormat(pickLanguage(language), {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}
