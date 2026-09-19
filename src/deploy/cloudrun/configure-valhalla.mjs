import {readFile,writeFile,stat} from 'node:fs/promises';
const directory='/app/data/valhalla';
for(const file of [`${directory}/valhalla_tiles.tar`,'/app/data/osm/source.osm.pbf']) {
  if(!(await stat(file)).size)throw new Error(`Missing routing input: ${file}`);
}
const config=JSON.parse(await readFile(`${directory}/valhalla.json`,'utf8'));
Object.assign(config.mjolnir,{
  tile_extract:`${directory}/valhalla_tiles.tar`,tile_dir:`${directory}/valhalla_tiles`,
  admin:`${directory}/valhalla_tiles/admins.sqlite`,timezone:`${directory}/valhalla_tiles/timezones.sqlite`,
  traffic_extract:'',default_speeds_config:'',
  // Bound the router cache; leave capacity for Next.js and request processing.
  max_cache_size:256*1024*1024,
});
config.httpd.service.listen='tcp://127.0.0.1:8002';
config.httpd.service.drain_seconds=1;
config.httpd.service.shutdown_seconds=1;
await writeFile(`${directory}/cloudrun.json`,JSON.stringify(config));
console.log('Valhalla configured to serve the bundled graph without rebuilding or extracting it.');
