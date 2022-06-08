#!/usr/bin/env bash
if [[ ! -d "build/build" ]]; then
    echo "build folder not found"
fi
cd build/build
npm pack
