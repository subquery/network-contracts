#!/usr/bin/env bash

set -e

PROXY_ADMIN_PATH=./artifacts/contracts/ProxyAdmin.sol
mkdir -p $PROXY_ADMIN_PATH
cp ./node_modules/@openzeppelin/contracts/build/contracts/ProxyAdmin.json $PROXY_ADMIN_PATH/ProxyAdmin.json

mkdir -p build/build/publish
cp -r src/* build/
cp -r publish build/

cp -r artifacts build/
cp package.json build/build/
cp tsconfig-build.json build/tsconfig.json

cd build || exit

tsc -b

sed -i -e '/"prepare"/d' build/package.json

cp publish/*.json build/publish/