import fs from 'node:fs/promises';
import path from 'node:path';
import shp from 'shpjs';
import pg from 'pg';
import nextEnv from '@next/env';
import { LINE_CODES } from '../lib/routing.mjs';

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://wayfinder:wayfinder-local-only@localhost:5433/wayfinder' });
const layers = {
  shelter: 'CoveredLinkWay_Mar2026.zip', footpath: 'Footpath_Mar2026.zip',
  crossing: 'PedestrainOverheadbridge_UnderPass_Mar2026.zip', cycling: 'CyclingPath_Mar2026.zip',
  station: 'TrainStation_Mar2026.zip', exit: 'TrainStationExit.zip',
  bus_stop: 'BusStopLocation_Mar2026.zip', taxi: 'TaxiStand_Mar2026.zip',
};
function validateCoordinates(coordinates) {
  if (typeof coordinates[0] === 'number') {
    const [lon, lat] = coordinates;
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < 103.5 || lon > 104.2 || lat < 1.1 || lat > 1.5) throw new Error('Projected coordinate outside Singapore: check source .prj');
  } else coordinates.forEach(validateCoordinates);
}
const client = await pool.connect();
try {
  await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE TABLE IF NOT EXISTS spatial_features (
      layer text NOT NULL, feature_id integer NOT NULL, properties jsonb NOT NULL,
      geom geometry(Geometry,4326) NOT NULL,
      geom_m geometry(Geometry,3414) NOT NULL,
      PRIMARY KEY(layer,feature_id));
    CREATE INDEX IF NOT EXISTS spatial_geom_idx ON spatial_features USING gist(geom);
    CREATE INDEX IF NOT EXISTS spatial_metric_idx ON spatial_features USING gist(geom_m);
    CREATE TABLE IF NOT EXISTS spatial_imports(layer text PRIMARY KEY, source text, count integer, imported_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS rail_line_codes(alias text PRIMARY KEY, canonical text NOT NULL);`);
  await client.query(`INSERT INTO rail_line_codes(alias,canonical) SELECT key,value FROM jsonb_each_text($1::jsonb)
    ON CONFLICT(alias) DO UPDATE SET canonical=excluded.canonical`,[JSON.stringify(LINE_CODES)]);
  for (const [layer, filename] of Object.entries(layers)) {
    // shpjs reads each archive's SVY21 .prj and reprojects to WGS84. Do not label raw metre coordinates as 4326.
    const parsed = await shp(await fs.readFile(path.join('data', 'spatial', filename)));
    const collections = Array.isArray(parsed) ? parsed : [parsed];
    const features = collections.flatMap(c => c.features).filter(f => f.geometry);
    features.forEach(f => validateCoordinates(f.geometry.coordinates));
    await client.query('BEGIN');
    // An explicit import replaces only this derived layer, atomically; original ZIPs and Valhalla are untouched.
    await client.query('DELETE FROM spatial_features WHERE layer=$1', [layer]);
    for (let offset = 0; offset < features.length; offset += 500) {
      const batch = features.slice(offset, offset + 500).map((f, i) => ({ id: offset + i, properties: f.properties, geometry: f.geometry }));
      await client.query(`INSERT INTO spatial_features(layer,feature_id,properties,geom,geom_m)
        SELECT $1, (f->>'id')::integer, f->'properties', g, ST_Transform(g,3414)
        FROM jsonb_array_elements($2::jsonb) f
        CROSS JOIN LATERAL (SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON((f->'geometry')::text),4326)) g) parsed`, [layer, JSON.stringify(batch)]);
    }
    await client.query(`INSERT INTO spatial_imports(layer,source,count) VALUES($1,$2,$3)
      ON CONFLICT(layer) DO UPDATE SET source=excluded.source,count=excluded.count,imported_at=now()`, [layer, filename, features.length]);
    await client.query('COMMIT');
    console.log(`${layer}: ${features.length} features, SVY21 → WGS84, indexed`);
  }
  await client.query('ANALYZE spatial_features');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(`Spatial import failed: ${error.message}`);
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
