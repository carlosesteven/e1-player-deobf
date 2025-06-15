#!/bin/bash

set -e  # Stop the script if any command fails

# Pull latest changes from the repository
git pull

# Install updated dependencies
npm install

# Run the Node.js sequence (nota: están en core/)
node core/download-input.js
node core/deobfuscate.js
node core/build-key.js

# Add all changes to git
git add .

# Commit with current date and time
git commit -m "Update: $(date '+%Y-%m-%d %H:%M:%S')"

# Push the changes
git push