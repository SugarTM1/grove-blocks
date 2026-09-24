$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$buildRoot = Join-Path $projectRoot 'dist'
$releaseRoot = Join-Path $projectRoot 'release'
if (-not (Test-Path -LiteralPath (Join-Path $buildRoot 'index.html'))) { throw 'Run npm run build first.' }
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath (Join-Path $releaseRoot 'grove-blocks-crazygames.zip') -Force
$kitRoot = Join-Path $releaseRoot 'submission-kit'
New-Item -ItemType Directory -Force -Path $kitRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $releaseRoot 'grove-blocks-crazygames.zip') -Destination $kitRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs') -Destination $kitRoot -Recurse -Force
$coversRoot = Join-Path $kitRoot 'covers'
$videosRoot = Join-Path $kitRoot 'videos'
New-Item -ItemType Directory -Force -Path $coversRoot,$videosRoot | Out-Null
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'marketing/covers') -Filter '*.png' | Copy-Item -Destination $coversRoot -Force
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'marketing/videos') -Filter '*.mp4' | Copy-Item -Destination $videosRoot -Force
Compress-Archive -Path (Join-Path $kitRoot '*') -DestinationPath (Join-Path $releaseRoot 'grove-blocks-submission-kit.zip') -Force
Get-ChildItem -LiteralPath $releaseRoot -Filter '*.zip' | Select-Object Name,Length
