#!/bin/bash
# Setup Playwright browser symlinks
# This script creates necessary symlinks for Playwright browsers

PLAYWRIGHT_CACHE="/root/.cache/ms-playwright"
BROWSERS_PATH="/pw-browsers"

# Create cache directory if not exists
mkdir -p "$PLAYWRIGHT_CACHE"

# Create symlinks for all browsers
if [ -d "$BROWSERS_PATH" ]; then
    for browser in "$BROWSERS_PATH"/*; do
        if [ -d "$browser" ]; then
            browser_name=$(basename "$browser")
            if [ ! -e "$PLAYWRIGHT_CACHE/$browser_name" ]; then
                ln -sf "$browser" "$PLAYWRIGHT_CACHE/$browser_name"
                echo "Created symlink for $browser_name"
            fi
        fi
    done
fi

echo "Playwright browser symlinks setup complete"
