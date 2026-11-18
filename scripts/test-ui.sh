#!/bin/bash
# Opens Vitest UI scoped to a single test file, auto-picking the matching
# project (backend for src/main/**, frontend otherwise) so electron mocking
# and jsdom setup line up the same way the npm test:* scripts do.
set -euo pipefail

FILE="${1:-}"
PROJECT="frontend"
if [[ "$FILE" == src/main/* ]]; then
  PROJECT="backend"
fi

node node_modules/vitest/vitest.mjs --ui --project "$PROJECT" ${FILE:+"$FILE"}
