# 用法：powershell -NoProfile -File tools\collect_voice.ps1 [每类题目的出题次数]
# 用无头 Edge 把每个游戏、每个等级都出几百次题，把游戏会说的所有台词（题目、夸奖、算式读法……）收集起来，
# 写到 tools\voice_lines.json（{ 文件名: 台词 }）。下一步用 tools\gen_voice.py 生成 mp3。
param([int]$Reps = 200, [int]$Budget = 1800000)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$root = Split-Path $PSScriptRoot -Parent
$page = (Resolve-Path (Join-Path $root "tests\smoke.html")).Path
$url = "file:///" + ($page -replace '\\', '/') + "?collect=$Reps"
$prof = Join-Path $env:TEMP ("123game_edge_" + [guid]::NewGuid().ToString("N"))
$dom = & $edge --headless --disable-gpu --no-first-run --user-data-dir=$prof --window-size="360,780" --virtual-time-budget=$Budget --dump-dom $url 2>$null | Out-String
Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
if ($dom -match '(?s)<pre id="out">(.*?)</pre>') { [System.Net.WebUtility]::HtmlDecode($Matches[1]).Split("`n") | Select-Object -Last 3 }
if ($dom -match '(?s)<pre id="voice">(.*?)</pre>') {
  $json = [System.Net.WebUtility]::HtmlDecode($Matches[1])
  $file = Join-Path $PSScriptRoot "voice_lines.json"
  # 每次出题是随机的，所以和以前收集到的合并起来：多跑几次，覆盖的台词就越全
  $new = $json | ConvertFrom-Json
  $all = [ordered]@{}
  if (Test-Path $file) { (Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $all[$_.Name] = $_.Value } }
  $before = $all.Count
  $new.PSObject.Properties | ForEach-Object { $all[$_.Name] = $_.Value }
  [System.IO.File]::WriteAllText($file, ($all | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
  "voice_lines.json: $before -> $($all.Count) lines (this run found $(@($new.PSObject.Properties).Count))"
} else { "NO VOICE OUTPUT" }
