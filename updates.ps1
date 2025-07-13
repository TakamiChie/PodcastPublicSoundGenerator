<#
  更新後再デプロイを行うためのPowerShellスクリプト。環境変数で以下の値を指定してください。
  リソースグループ...PPSG_AZURE_RESOURCE_GROUP
  APP名...PPSG_AZURE_APPNAME
  Dockerイメージ名...PPSG_AZURE_DOCKER_IMAGE_NAME
#>
$resourceGroup = $env:PPSG_AZURE_RESOURCE_GROUP
$appName = $env:PPSG_AZURE_APPNAME
$imageName = $env:PPSG_AZURE_DOCKER_IMAGE_NAME

# === Dockerビルドとプッシュ ===
docker build -t $imageName .
docker push $imageName

# === Azure Web App のコンテナイメージを更新 ===
az webapp config container set `
  --name $appName `
  --resource-group $resourceGroup `
  --docker-custom-image-name $imageName `
  --docker-registry-server-url https://index.docker.io

# === 必要に応じて再起動（イメージキャッシュのクリアを兼ねて） ===
az webapp restart --name $appName --resource-group $resourceGroup