#!/usr/bin/env bash

# Script para publicar com projectId específico
# Uso: ./scripts/publish-with-project.sh [PROJECT_ID]

PROJECT_ID=$1

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Project ID não fornecido"
    echo "   Uso: $0 [PROJECT_ID]"
    echo "   Exemplo: $0 codus-infra-prod"
    exit 1
fi

echo "🚀 Publicando com Project ID: $PROJECT_ID"

# Renovar token com projectId
source scripts/refresh-token.sh "$PROJECT_ID"

# Configurar .npmrc temporário para autenticação
echo "🔑 Configurando autenticação..."
# Substituir a variável no .npmrc
sed -i.bak "s/\${GAR_PROJECT_ID}/$PROJECT_ID/g" .npmrc
echo "//us-central1-npm.pkg.dev/$PROJECT_ID/codus-pkg/:_authToken=$NPM_TOKEN" >> .npmrc

# Build e publicar
yarn prepack && npm publish --registry=https://us-central1-npm.pkg.dev/$PROJECT_ID/codus-pkg/ --access public

# Limpar .npmrc (remover linha de autenticação e restaurar variável)
echo "🧹 Limpando configuração..."
sed -i.bak '/_authToken/d' .npmrc
sed -i.bak "s/$PROJECT_ID/\${GAR_PROJECT_ID}/g" .npmrc

echo "✅ Publicação concluída!"
