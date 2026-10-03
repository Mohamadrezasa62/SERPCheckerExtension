param(
  [string]$ChromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $ChromePath)) { throw "Chrome executable not found: $ChromePath" }

$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$profile = Join-Path ([System.IO.Path]::GetTempPath()) ('rankban-smoke-' + [guid]::NewGuid().ToString('N'))
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$endpoint = "http://127.0.0.1:$port"
$chromeProcess = $null

try {
  $chromeProcess = Start-Process -FilePath $ChromePath -ArgumentList @(
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    "--disable-extensions-except=$workspace",
    "--load-extension=$workspace",
    "--user-data-dir=$profile",
    "--remote-debugging-port=$port",
    'about:blank'
  ) -WindowStyle Hidden -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 50; $attempt++) {
    try {
      $null = Invoke-RestMethod "$endpoint/json/version" -TimeoutSec 1
      $ready = $true
      break
    } catch { Start-Sleep -Milliseconds 200 }
  }
  if (-not $ready) { throw 'Chrome debugging endpoint did not become ready.' }

  $env:CDP_ENDPOINT = $endpoint
  node (Join-Path $PSScriptRoot 'smoke.mjs')
  if ($LASTEXITCODE -ne 0) { throw "Browser smoke check failed with exit code $LASTEXITCODE" }
} finally {
  Remove-Item Env:CDP_ENDPOINT -ErrorAction SilentlyContinue
  if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force }
  $resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $resolvedProfile = [System.IO.Path]::GetFullPath($profile)
  if ($resolvedProfile.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path $resolvedProfile -Leaf) -like 'rankban-smoke-*' -and
      (Test-Path -LiteralPath $resolvedProfile)) {
    Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue
  }
}
