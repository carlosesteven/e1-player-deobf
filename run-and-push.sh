#!/bin/bash

set -e  # Hace que el script se detenga si hay un error

# Ejecuta la secuencia de Node.js
node download-input.js
node deobfuscate.js
node build-key.js

# Agrega todos los cambios a git
git add .

# Haz el commit con fecha y hora actual
git commit -m "Automated update: $(date '+%Y-%m-%d %H:%M:%S')"

# Sube los cambios
git push

echo "Todo listo: Secuencia ejecutada y cambios subidos a GitHub."