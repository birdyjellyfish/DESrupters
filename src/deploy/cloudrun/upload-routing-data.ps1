param(
  [string]$ProjectId = 'qwiklabs-gcp-02-09a07b4c9a6f',
  [string]$BucketName = 'qwiklabs-gcp-02-09a07b4c9a6f-wayfinder-data',
  [string]$DataPrefix = 'routing-v1'
)
$ErrorActionPreference = 'Stop'
$GcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
$GcloudPath = if ($GcloudCommand) { $GcloudCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd' }
if (-not (Test-Path -LiteralPath $GcloudPath)) { throw 'Install the Google Cloud CLI and run gcloud auth login first.' }
if ($BucketName -notmatch '^[a-z0-9][a-z0-9._-]+[a-z0-9]$' -or $DataPrefix -notmatch '^[a-zA-Z0-9][a-zA-Z0-9/_-]*$') { throw 'Invalid bucket or data prefix.' }
$DataRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../data')).Path
$Files = @('valhalla/valhalla_tiles.tar','valhalla/valhalla.json','valhalla/valhalla_tiles/admins.sqlite','valhalla/valhalla_tiles/timezones.sqlite','osm/source.osm.pbf','crowd-baselines.json')
foreach ($File in $Files) {
  $Source = (Resolve-Path -LiteralPath (Join-Path $DataRoot $File)).Path
  if (-not $Source.StartsWith($DataRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Source escaped the data directory.' }
  if (-not (Get-Item -LiteralPath $Source).Length) { throw "Empty input: $File" }
}
foreach ($File in $Files) {
  & $GcloudPath storage cp (Join-Path $DataRoot $File) "gs://$BucketName/$DataPrefix/$File" "--project=$ProjectId"
  if ($LASTEXITCODE -ne 0) { throw "Upload failed: $File" }
}
Write-Host 'Uploaded routing inputs and baseline. No credentials or runtime state were uploaded.'
