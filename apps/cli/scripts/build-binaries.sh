#!/bin/bash
# Gera binários standalone (não precisa de Node.js instalado)

pnpm add -g pkg

# Build para todas plataformas
pkg . \
  --targets node18-linux-x64,node18-macos-x64,node18-win-x64 \
  --output dist/codus

echo "✅ Binários criados em dist/"
echo "  - dist/codus-linux"
echo "  - dist/codus-macos"  
echo "  - dist/codus-win.exe"
