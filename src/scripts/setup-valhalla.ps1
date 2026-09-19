param(
  [Parameter(Mandatory=$true)]
  [string]$PbfPath
)

$ErrorActionPreference = "Stop"
$resolvedPbf = (Resolve-Path -LiteralPath $PbfPath).Path
$repoRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $repoRoot "data\valhalla"
$image = "ghcr.io/valhalla/valhalla-scripted:latest"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$buildCommand = @"
mkdir -p /out/valhalla_tiles
valhalla_build_config --mjolnir-tile-dir /out/valhalla_tiles --mjolnir-tile-extract /out/valhalla_tiles.tar --mjolnir-timezone /out/valhalla_tiles/timezones.sqlite --mjolnir-admin /out/valhalla_tiles/admins.sqlite > /out/valhalla.json
valhalla_build_timezones > /out/valhalla_tiles/timezones.sqlite
valhalla_build_admins -c /out/valhalla.json /data/input.osm.pbf
valhalla_build_tiles -c /out/valhalla.json /data/input.osm.pbf
valhalla_build_extract -c /out/valhalla.json -v --overwrite
"@

Write-Host "Building Valhalla tiles from $resolvedPbf"
Write-Host "The first build can take several minutes and needs several GB of free disk space."
& docker run --rm `
  --entrypoint /bin/bash `
  -v "${outputDir}:/out" `
  -v "${resolvedPbf}:/data/input.osm.pbf:ro" `
  $image -lc $buildCommand

if ($LASTEXITCODE -ne 0) { throw "Valhalla tile build failed" }
Write-Host "Valhalla tiles are ready in $outputDir"
Write-Host "Start the router with: docker compose -f docker-compose.valhalla.yml up -d"
