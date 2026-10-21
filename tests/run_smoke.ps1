# 用法：powershell -NoProfile -File tests\run_smoke.ps1 [虚拟时间毫秒]
# 用无头 Edge 打开 tests/smoke.html（file:// 即可，不需要服务器），打印 <pre id="out"> 的内容。
param([int]$Budget = 600000, [int]$Width = 360, [int]$Height = 780)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$page = (Resolve-Path (Join-Path $PSScriptRoot "smoke.html")).Path
$url = "file:///" + ($page -replace '\\', '/')
$prof = Join-Path $env:TEMP ("123game_edge_" + [guid]::NewGuid().ToString("N"))
$dom = & $edge --headless --disable-gpu --no-first-run --user-data-dir=$prof --window-size="$Width,$Height" --virtual-time-budget=$Budget --dump-dom $url 2>$null | Out-String
Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
if ($dom -match '(?s)<pre id="out">(.*?)</pre>') { [System.Net.WebUtility]::HtmlDecode($Matches[1]) } else { "NO OUTPUT" }

