# SubQuery Contracts

The Subquery is a indexing tool for querying blockchains data. Anyone can build indexing service with subquery, and provide the api to making blockchain data easily accessible.

The Subquery Network Smart Contracts are a set of Solidity contracts that are going to delpoy on EVM. The contracts enable a decentralized network that welcome indexers running query projects and provide queries to consumers. Consumers pay for queries with the Subquery Token (SQT).

The Subquery Network allows Delegators staking on Indxers to share their rewards, more delegation also help indxers are able to gain more rewards.

This repository includes contracts, js-sdk and rust-sdk.

## Local development

### Config
We use dotenv to load env variable from `.env` file, copy `.env_template` to `.env`, and update the `ENDPOINT` and `SEED`.

### Build
- `yarn install` install dependencies
- `yarn build` build the contracts and js-sdk

### Test
- `yarn test`

### Deploy
Make sure the local node is running and the `.env` config correctly.
Run `yarn deploy`, will see the addresses of contracts output in the console.
Find the latest deployment file: `./publish/local.json`.

## Testnet
Testnet contracts are deployed on the `Polygon Mumbai`.
Find the latest deployment file: `./publish/testnet.json`.
Get configuration from js-sdk `networks['testnet']` or rust-sdk `Network::Testnet`.

## Kepler
The Kepler network sits between a testnet and mainnet.
Kepler network contracts will be deployed on the `Polygon Mainnet`.
Find the latest deployment file: `./publish/kepler.json`.
Get configuration from js-sdk `networks['kepler']` or rust-sdk `Network::Kepler`.

## Commands

### build

#### contract

`yarn build:contract`

#### typechain

`yarn build:types`

#### js-sdk

`yarn build:ts`

#### rust-sdk
`cargo build` build with `debug` mode.

### deploy contracts

To deploy on local network

-   `yarn deploy`

To deploy to mainnet and testnet

-   `yarn deploy --mainnet`
-   `yarn deploy --kepler`
-   `yarn deploy --testnet`

If contracts deploy failed with unexpected errors, you can try to continue deploying the contracts from the last step:

- `yarn deploy --testnet --history`

To verify the contracts deployment, run the following cmd to verify specific type:

- `yarn verify --testnet --initialisation`
- `yarn verify --testnet --configuration`
- `yarn verify --testnet --ownership`
- `yarn verify --testnet --all`

### Verify on Etherscan
- `yarn hardhat publish --deployment ./publish/kepler.json --network kepler`

### test

`yarn test`

Note: After contract upgrade, should run below again.

```
    yarn build
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

### revert code
You can find all revert code details at `./public/revertcode.json`
