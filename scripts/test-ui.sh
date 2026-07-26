#!/bin/bash
# Opens Vitest UI scoped to a single test file, auto-picking the matching
# config (backend for src/main/**, frontend otherwise) so electron mocking
# and jsdom setup line up the same way the npm test:* scripts do.
set -euo pipefail

FILE="${1:-}"
CONFIG="vitest.frontend.config.ts"
if [[ "$FILE" == src/main/* ]]; then
  CONFIG="vitest.backend.config.ts"
fi

node node_modules/vitest/vitest.mjs --ui --config "$CONFIG" ${FILE:+"$FILE"}
