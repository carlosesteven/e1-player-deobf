#!/bin/bash

set -e  # Stop the script if any command fails

# Pull latest changes from the repository
git pull

# Run the Node.js sequence
node download-input.js
node deobfuscate.js
node build-key.js

# Add all changes to git
git add .

# Commit with current date and time
git commit -m "Automated update: $(date '+%Y-%m-%d %H:%M:%S')"

# Push the changes
git push

echo "All done: Sequence executed and changes pushed to GitHub."