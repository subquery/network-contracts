#!/usr/bin/env bash

if [ -e publish/testnet.json ]
  then cp publish/testnet.json build/build/publish/
fi

if [ -e publish/mainnet.json ]
  then cp publish/mainnet.json build/build/publish/
fi
