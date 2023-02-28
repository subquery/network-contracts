# SubQuery Contracts & sdk

The Subquery is a indexing tool for querying blockchains data. Anyone can build indexing service with subquery, and provide the api to making blockchain data easily accessible.

The Subquery Network Smart Contracts are a set of Solidity contracts that are going to delpoy on EVM. The contracts enable a decentralized network that welcome indexers running query projects and provide queries to consumers. Consumers pay for queries with the Subquery Token (SQT).

The Subquery Network allows Delegators staking on Indxers to share their rewards, more delegation also help indxers are able to gain more rewards.

## Local Development

### config `.env` file

We use dotenv to load env variable from `.env` file, need to choose the specific env for `hardhat` or `moonbeam` in `.env_template`, copy the config to `.env`.

You can config `Custome RPC` network on MetaMask to connect with the local Moonbeam node.
The specific fields for the config: `rpc_url=http://127.0.0.1:9933` and `chain_id=1281`

### build
`yarn build`

### test
`yarn test`

### deploy the contracts

Make sure the local node is running and the `.env` config correctly.
Run `yarn deploy`, will see the addresses of contracts output in the console.
Find the latest deployment file: `./publish/local.json`.

## Testnet

### env

**Moonbase**:
```
ENDPOINT: https://moonbeam-alpha.api.onfinality.io/public
WS_ENDPOINT: wss://moonbeam-alpha.api.onfinality.io/public-ws
Chan ID: 1287
Explorer: https://moonbase.moonscan.io/
```
## kepler network

## Commands

### build

#### contract

`yarn build:contract`

#### typechain

`yarn build:types`

#### sdk

`yarn build:ts`

### deploy

To deploy on local network

-   `yarn deploy`

To deploy to mainnet and testnet

-   `yarn deploy --mainnet`
-   `yarn deploy --testnet`

### test

`yarn test`

Note: After contract upgrade, should run below again.

```
    yarn build:contract
    yarn build:types
    yarn build:ts
    yarn test
    yarn mocha test/Staking.test.ts
    ...
```

#### Fuzz Test

##### Install Echidna

- Building using Nix
  `$ nix-env -i -f https://github.com/crytic/echidna/tarball/master`

##### Run Echidna Tests

- Install solc 0.6.12:
  `$ nix-env -f https://github.com/dapphub/dapptools/archive/master.tar.gz -iA solc-versions.solc_0_6_12`

- Run Echidna Tests:
  `$ echidna-test test-fuzz/PermissionedExchangeEchidnaTest.sol --contract PermissionedExchangeEchidnaTest --config echidna.config.yml`

### code flatten
`yarn hardhat flat contracts/PermissionedExchange.sol > Flattened.sol`
