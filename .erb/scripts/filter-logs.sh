#!/bin/bash
# Filter out specific ONNX Runtime warnings only
"$@" 2>&1 | grep --line-buffered -v "\[W:onnxruntime:, graph\.cc:3490 CleanUnusedInitializersAndNodeArgs\]"
