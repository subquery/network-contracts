#!/usr/bin/env bash

set -e

mkdir -p build/build/publish
cp -r src/* build/
cp -r publish build/
cp -r artifacts build/
cp package.json build/build/
cp tsconfig-build.json build/tsconfig.json

cd build || exit

tsc -b

sed -i -e '/"prepare"/d' build/package.json

if [ -e publish/testnet.json ]
  then cp publish/testnet.json build/publish/
fi

if [ -e publish/mainnet.json ]
  then cp publish/mainnet.json build/publish/
fi
