# scripts/setup-hooks.ps1
# Windows PowerShell 版: 配置 git hooksPath 指向 .githooks/

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$HooksDir = Join-Path $RepoRoot ".githooks"

Set-Location $RepoRoot

if (-not (Test-Path $HooksDir)) {
  Write-Host "❌ 找不到 .githooks/ 目录，请确认在正确的仓库根目录下运行。" -ForegroundColor Red
  exit 1
}

Write-Host "🔧 查找 hook 脚本..."
$HookFiles = Get-ChildItem -Path $HooksDir -File | Where-Object { $_.Name -notlike "*.sample" -and $_.Name -notlike "*.md" }

foreach ($f in $HookFiles) {
  Write-Host "   - $($f.Name)"
}

$Current = git config core.hooksPath 2>$null
$Target = ".githooks"

if ($Current -eq $Target) {
  Write-Host ""
  Write-Host "✅ git core.hooksPath 已配置为: $Target" -ForegroundColor Green
} else {
  git config core.hooksPath $Target
  Write-Host ""
  Write-Host "🔧 已将 git core.hooksPath 设置为: $Target" -ForegroundColor Yellow
  if ($Current) {
    Write-Host "   (原值: $Current)"
  }
}

Write-Host ""
Write-Host "🎉 Git hooks 已启用。"
Write-Host ""
Write-Host "💡 临时绕过 hook (仅紧急情况):"
Write-Host "   git commit --no-verify"
Write-Host "   git push --no-verify"
