#!/bin/bash

# deploy.sh - Netlifyへの自動デプロイスクリプト

echo "🚀 Starting deployment to Netlify..."

# 環境変数チェック
if [ -z "$DISCORD_WEBHOOK_URL" ]; then
  echo "⚠️  Warning: DISCORD_WEBHOOK_URL not set"
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "⚠️  Warning: GITHUB_TOKEN not set"
fi

# 依存関係のインストール
echo "📦 Installing dependencies..."
npm install

# ビルド（必要に応じて）
echo "🔨 Building project..."
npm run build

# Netlifyへデプロイ
echo "🌐 Deploying to Netlify..."
netlify deploy --prod

# 完了メッセージ
if [ $? -eq 0 ]; then
  echo "✅ Deployment successful!"
  echo "🎉 Your site is live at: https://your-site.netlify.app"
else
  echo "❌ Deployment failed!"
  exit 1
fi