import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const { pool, spatialOverlay, walkingContext } = await import('../lib/server/spatial.mjs');
try {
  const rows = await pool.query('SELECT layer,count FROM spatial_imports ORDER BY layer');
  console.log(rows.rows);
  const overlay = await spatialOverlay([103.89,1.39,103.91,1.41],['shelter','bus_stop','exit','station','footpath']);
  console.log({ features: overlay.features.length, layers:[...new Set(overlay.features.map(f=>f.properties.layer))] });
  const polygon = await pool.query("SELECT ST_AsGeoJSON(ST_ExteriorRing(geom))::json g FROM spatial_features WHERE layer='shelter' AND GeometryType(geom)='POLYGON' LIMIT 1");
  const measured = await walkingContext(polygon.rows[0].g.coordinates);
  if (!measured.available || measured.shelteredMeters<=0) throw new Error('Shelter overlap check failed');
  console.log({ shelterOverlapCheck: measured });
} finally { await pool.end(); }
