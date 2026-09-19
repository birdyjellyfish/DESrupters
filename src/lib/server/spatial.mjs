import pg from 'pg';
const pool = globalThis.__wayfinderPg ||= new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://wayfinder:wayfinder-local-only@localhost:5433/wayfinder',
  max: 5, connectionTimeoutMillis: 1000, idleTimeoutMillis: 30_000, statement_timeout: 5000,
});
pool.on('error', () => {});
export { pool };

export async function walkingContext(coordinates) {
  if (coordinates.length < 2) return { available: false, shelteredMeters: null };
  try {
    const { rows } = await pool.query(`WITH route AS (
      SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1),4326),3414) g
    ), near AS (
      SELECT layer, ST_UnaryUnion(ST_Collect(ST_Buffer(geom_m, CASE WHEN layer='shelter' THEN 3 ELSE 5 END))) g
      FROM spatial_features,route WHERE layer IN ('shelter','footpath','crossing','cycling') AND ST_DWithin(geom_m,route.g,8) GROUP BY layer
    ) SELECT layer, ST_Length(ST_Intersection(route.g,near.g)) meters FROM near,route`, [JSON.stringify({ type: 'LineString', coordinates })]);
    const imported = await pool.query("SELECT count(*)::int count FROM spatial_imports WHERE layer='shelter'");
    return { available: imported.rows[0].count > 0, shelteredMeters: Math.round(Number(rows.find(r => r.layer === 'shelter')?.meters || 0)),
      footpathMeters: Math.round(Number(rows.find(r => r.layer === 'footpath')?.meters || 0)),
      crossingMeters: Math.round(Number(rows.find(r => r.layer === 'crossing')?.meters || 0)),
      cyclingOverlapMeters: Math.round(Number(rows.find(r => r.layer === 'cycling')?.meters || 0)) };
  } catch { return { available: false, shelteredMeters: null }; }
}

export async function stationExit(station, routeCoordinates) {
  if (!station?.name || routeCoordinates.length < 2) return null;
  try {
    const { rows } = await pool.query(`WITH route AS (SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1),4326),3414) g)
      SELECT properties, ST_AsGeoJSON(geom)::json geometry FROM spatial_features,route
      WHERE layer='exit' AND upper(properties->>'stn_name')=upper($2) AND ST_DWithin(geom_m,route.g,25)
      ORDER BY ST_Distance(geom_m,route.g) LIMIT 1`, [JSON.stringify({ type: 'LineString', coordinates: routeCoordinates }), station.name]);
    const r = rows[0];
    return r ? { name: r.properties.exit_code, station: r.properties.stn_name, coordinates: r.geometry.coordinates, verified: false } : null;
  } catch { return null; }
}

export async function spatialOverlay(bbox, layers) {
  const { rows } = await pool.query(`SELECT layer,feature_id,properties,ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom,0.000008),6)::json geometry
    FROM spatial_features WHERE layer=ANY($1) AND geom && ST_MakeEnvelope($2,$3,$4,$5,4326)
    ORDER BY CASE layer WHEN 'exit' THEN 0 WHEN 'bus_stop' THEN 1 WHEN 'shelter' THEN 2 ELSE 3 END,feature_id LIMIT 2500`, [layers, ...bbox]);
  return { type: 'FeatureCollection', features: rows.map(r => ({ type: 'Feature', geometry: r.geometry, properties: { ...r.properties, layer: r.layer }, id: `${r.layer}-${r.feature_id}` })), truncated: rows.length === 2500 };
}
