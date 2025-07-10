# 設定: 必要な情報を記入してください
$resourceGroup = $env:RESOURCEGROUPNAME
$appName = $env:APPNAME
$siteName = $env:SITENAME
$srcPath = $PSScriptRoot     # デプロイするフォルダ
$zipPath = "$env:TEMP\app_deploy.zip"

# Azure にログイン（ログイン済みの場合はスキップ可能）
az account show > $null 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Azureにログインします..."
  az login
}
$token = az account get-access-token --resource https://management.azure.com --query accessToken -o tsv
$startupFile = "startup.sh"
$urlOfStartupFile = "https://$siteName.azurewebsites.net/api/vfs/site/wwwroot/$startupFile"

# 除外パターン（正規表現も使用可能）
$excludePatterns = @(
  '\.git',
  '\.venv',
  '__pycache__',
  'output\\.*?\.mp3',
  'output\\.*?\.html'
)

# フィルタ関数
function ShouldIncludeFile($filePath) {
  foreach ($pattern in $excludePatterns) {
    if ($filePath -match $pattern) {
      return $false
    }
  }
  return $true
}

# 既存ZIP削除
if (Test-Path $zipPath) {
  Remove-Item $zipPath
}

# ZIP作成（除外付き）
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipFile = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')

$allFiles = Get-ChildItem -Path $srcPath -Recurse -File

foreach ($file in $allFiles) {
  $relativePath = $file.FullName.Substring($srcPath.Length + 1) -replace '\\', '/'
  if (ShouldIncludeFile($relativePath)) {
    $zipEntryPath = [System.IO.Path]::Combine($zipFileName, $relativePath)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipFile, $file.FullName, $zipEntryPath)
  } else {
    Write-Host "除外: $relativePath"
  }
}

$zipFile.Dispose()
Write-Host "✅ ZIP 作成完了: $zipPath"

Write-Host $urlOfStartupFile
# デプロイ実行
Write-Host "Azure App Service にデプロイ中..."
Invoke-RestMethod -Uri $urlOfStartupFile `
  -Headers @{ Authorization = "Bearer $token" } `
  -Method PUT -InFile $startupFile -ContentType "text/plain"
az webapp config set `
  --resource-group $resourceGroup `
  --name $appName `
  --startup-file "/bin/bash /home/site/wwwroot/$startupFile"
az webapp deploy `
  --resource-group $resourceGroup `
  --name $appName `
  --src-path $zipPath `
  --type zip

# 終了メッセージ
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ デプロイ完了！"
} else {
    Write-Host "❌ デプロイに失敗しました。"
}
