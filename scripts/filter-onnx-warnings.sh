#!/bin/bash
# Filter known cosmetic noise from test/dev output:
#   - ONNX graph optimization warnings (harmless, see onnxruntime#14694)
#   - Browserslist stale-data advisory (suppressed via env; filter catches stragglers)
#   - vitest arrow-function mock advisory (informational only, not actionable here)
#   - JSDOM HTMLCanvasElement.getContext() not-implemented notice
grep -v 'CleanUnusedInitializersAndNodeArgs\|\[W:onnxruntime:\|Browserslist: browsers data\|npx update-browserslist-db\|Why you should do it regularly\|vi\.fn() mock did not use\|Not implemented: HTMLCanvasElement'
