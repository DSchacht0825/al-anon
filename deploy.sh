#!/bin/bash

echo "Pushing to GitHub..."

# Add remote if it doesn't exist
git remote add origin https://github.com/DSchacht0825/al-anon.git 2>/dev/null || true

# Push to GitHub
git push -u origin main

echo "Code pushed to GitHub!"
echo "Now go to Railway and deploy from GitHub repo: DSchacht0825/al-anon"