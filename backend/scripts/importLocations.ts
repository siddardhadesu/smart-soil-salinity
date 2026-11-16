
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false,
});

const YEARS = Array.from({ length: 21 }, (_, i) => 2015 + i);

const FILES = [
  { district: 'Nellore', file: 'Nellore_300Points_2015_2025_PseudoEC.csv' },
  { district: 'Nellore', file: 'Nellore_300Points_2026_2035_PseudoEC.csv' },
  { district: 'Ongole', file: 'Ongole_300Points_2015_2025_PseudoEC.csv' },
  { district: 'Ongole', file: 'Ongole_300Points_2026_2035_PseudoEC.csv' },
];

interface Point {
  district: string;
  pointId: string;
  latitude: number;
  longitude: number;
  values: Record<number, number | null>;
}

const parseNumber = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const readCsv = (filePath: string): Promise<Record<string, string>[]> =>
  new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

async function importLocations() {
  const points = new Map<string, Point>();

  // Read and combine all four CSV files.
  for (const source of FILES) {
    const filePath = path.resolve(__dirname, '../../data', source.file);

    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    console.log(`Reading ${source.file}...`);
    const rows = await readCsv(filePath);

    for (const row of rows) {
      const rawPointId = row['Point_ID']?.trim();

    const pointId = rawPointId
  ? (Number.isFinite(Number(rawPointId))
      ? String(Number(rawPointId))
      : rawPointId)
  : '';


      const latitude = parseNumber(row['Latitude']);
      const longitude = parseNumber(row['Longitude']);
      const year = Number(row['Year']);
      const ec = parseNumber(row['EC_Pseudo']);

      if (
        !pointId ||
        latitude === null ||
        longitude === null ||
        !Number.isInteger(year) ||
        !YEARS.includes(year)
      ) {
        continue;
      }

      const key = `${source.district}_${pointId}`;

      if (!points.has(key)) {
        points.set(key, {
          district: source.district,
          pointId,
          latitude,
          longitude,
          values: Object.fromEntries(YEARS.map(y => [y, null])),
        });
      }

      const point = points.get(key)!;
      point.values[year] = ec;
    }

    console.log(`  Read ${rows.length} rows`);
  }

  console.log('\nCombined point counts:');

  for (const district of ['Nellore', 'Ongole']) {
    const locationPoints = [...points.values()].filter(
      p => p.district === district
    );

    console.log(`  ${district}: ${locationPoints.length} points`);

    if (locationPoints.length === 0) {
      throw new Error(`No points found for ${district}`);
    }

    const lats = locationPoints.map(p => p.latitude);
    const lons = locationPoints.map(p => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    console.log(
      `  Bounds: minLat=${minLat}, maxLat=${maxLat}, minLon=${minLon}, maxLon=${maxLon}`
    );
    console.log(
      `  Center: [${(minLat + maxLat) / 2}, ${(minLon + maxLon) / 2}]`
    );
  }

  const columns = YEARS.map(year => `ec_${year}`);
  const insertColumns = [
    'system_index',
    'latitude',
    'longitude',
    'geom',
    'district',
    ...columns,
  ];

  const placeholders = [
    '$1',
    '$2',
    '$3',
    'ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography',
    '$4',
    ...YEARS.map((_, i) => `$${i + 5}`),
  ];

  const updateColumns = [
    'latitude = EXCLUDED.latitude',
    'longitude = EXCLUDED.longitude',
    'geom = EXCLUDED.geom',
    ...columns.map(col => `${col} = EXCLUDED.${col}`),
  ];

  const sql = `
    INSERT INTO soil_salinity (${insertColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (district, system_index)
    DO UPDATE SET ${updateColumns.join(', ')}
  `;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
  DELETE FROM soil_salinity
  WHERE district IN ('Nellore', 'Ongole')
`);
    

    let imported = 0;

    for (const point of points.values()) {
      const systemIndex = `${point.district.toLowerCase()}_${point.pointId}`;

      const values = [
        systemIndex,
        point.latitude,
        point.longitude,
        point.district,
        ...YEARS.map(year => point.values[year]),
      ];

      await client.query(sql, values);
      imported++;
    }

    await client.query('COMMIT');

    console.log(`\nSuccessfully imported/updated ${imported} points.`);

    const result = await client.query(`
      SELECT district, COUNT(*) AS total
      FROM soil_salinity
      WHERE district IN ('Nellore', 'Ongole')
      GROUP BY district
      ORDER BY district
    `);

    console.table(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importLocations().catch(async error => {
  console.error('\nImport failed:', error);
  await pool.end();
  process.exit(1);
});
