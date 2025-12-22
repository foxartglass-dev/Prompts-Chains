#!/bin/bash
# Startup script for Railway - finds Chromium and starts the server

# Find Chromium executable
find_chromium() {
  # Check common Nix paths first
  local paths=(
    "/nix/var/nix/profiles/default/bin/chromium"
    "/root/.nix-profile/bin/chromium"
    "$(which chromium 2>/dev/null)"
    "$(which chromium-browser 2>/dev/null)"
    "$(which google-chrome 2>/dev/null)"
    "/usr/bin/chromium"
    "/usr/bin/chromium-browser"
    "/usr/bin/google-chrome"
  )

  for path in "${paths[@]}"; do
    if [ -n "$path" ] && [ -x "$path" ]; then
      echo "$path"
      return 0
    fi
  done

  # Search in Nix store as fallback
  local nix_chromium=$(find /nix/store -name "chromium" -type f -executable 2>/dev/null | head -1)
  if [ -n "$nix_chromium" ]; then
    echo "$nix_chromium"
    return 0
  fi

  return 1
}

# Export Chromium path for Puppeteer
CHROMIUM_PATH=$(find_chromium)
if [ -n "$CHROMIUM_PATH" ]; then
  export PUPPETEER_EXECUTABLE_PATH="$CHROMIUM_PATH"
  echo "Found Chromium at: $PUPPETEER_EXECUTABLE_PATH"
else
  echo "WARNING: Chromium not found. Screenshots will not work."
fi

# Start the Node.js server
exec node server/index.js
