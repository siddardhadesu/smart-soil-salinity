
/**
 * Safe year-to-column whitelist mapping.
 * Covers both Nellore and Ongole (2015–2035).
 * Prevents SQL injection — year param is never concatenated directly into SQL.
 */

export const YEAR_COLUMN_MAP: Record<number, string> = {
  2015: 'ec_2015',
  2016: 'ec_2016',
  2017: 'ec_2017',
  2018: 'ec_2018',
  2019: 'ec_2019',
  2020: 'ec_2020',
  2021: 'ec_2021',
  2022: 'ec_2022',
  2023: 'ec_2023',
  2024: 'ec_2024',
  2025: 'ec_2025',
  2026: 'ec_2026',
  2027: 'ec_2027',
  2028: 'ec_2028',
  2029: 'ec_2029',
  2030: 'ec_2030',
  2031: 'ec_2031',
  2032: 'ec_2032',
  2033: 'ec_2033',
  2034: 'ec_2034',
  2035: 'ec_2035',
};

const YEARS_2015_2035 = Array.from(
  { length: 21 },
  (_, i) => 2015 + i
);

const HISTORICAL_YEARS = Array.from(
  { length: 11 },
  (_, i) => 2015 + i
);

const PREDICTED_YEARS = Array.from(
  { length: 10 },
  (_, i) => 2026 + i
);

// Per-location configuration
export const DISTRICT_CONFIG: Record<string, {
  selectableYears: number[];
  historicalYears: number[];
  predictedYears: number[];
  trendYears: number[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  center: [number, number];
  placeholder: { lat: string; lon: string };
}> = {
  Nellore: {
    selectableYears: YEARS_2015_2035,
    historicalYears: HISTORICAL_YEARS,
    predictedYears: PREDICTED_YEARS,
    trendYears: YEARS_2015_2035,

    bounds: {
      minLat: 13.49304733205003,
      maxLat: 15.06882791032125,
      minLon: 79.15320715078965,
      maxLon: 80.2328058940486,
    },

    center: [14.28093762118564, 79.69300652241913],

    placeholder: {
      lat: '14.28094',
      lon: '79.69301',
    },
  },

  Ongole: {
    selectableYears: YEARS_2015_2035,
    historicalYears: HISTORICAL_YEARS,
    predictedYears: PREDICTED_YEARS,
    trendYears: YEARS_2015_2035,

    bounds: {
      minLat: 14.977627439165524,
      maxLat: 16.255154813336308,
      minLon: 78.75070515966172,
      maxLon: 80.4281066413467,
    },

    center: [15.616391126250916, 79.5894059005042],

    placeholder: {
      lat: '15.61639',
      lon: '79.58941',
    },
  },
};

export const getDataType = (
  year: number,
  district: string
): 'Historical' | 'Predicted' => {
  const config = DISTRICT_CONFIG[district];

  if (!config) {
    return year <= 2025 ? 'Historical' : 'Predicted';
  }

  return config.historicalYears.includes(year)
    ? 'Historical'
    : 'Predicted';
};

export const isValidYear = (year: number): boolean => {
  return Object.prototype.hasOwnProperty.call(YEAR_COLUMN_MAP, year);
};

export const getColumnForYear = (year: number): string | null => {
  return YEAR_COLUMN_MAP[year] || null;
};

export const getDistrictYears = (district: string) => {
  return DISTRICT_CONFIG[district] ?? DISTRICT_CONFIG['Nellore'];
};
