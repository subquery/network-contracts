#!/usr/bin/env bash

set -e

PROXY_ADMIN_PATH=artifacts/contracts/ProxyAdmin.sol
mkdir -p $PROXY_ADMIN_PATH
cp node_modules/@openzeppelin/contracts/build/contracts/ProxyAdmin.json $PROXY_ADMIN_PATH/ProxyAdmin.json

TRANSPARENT_UPGRADEABLE_PROXY_PATH=artifacts/contracts/TransparentUpgradeableProxy.sol
mkdir -p $TRANSPARENT_UPGRADEABLE_PROXY_PATH
cp node_modules/@openzeppelin/contracts/build/contracts/TransparentUpgradeableProxy.json $TRANSPARENT_UPGRADEABLE_PROXY_PATH/TransparentUpgradeableProxy.json
