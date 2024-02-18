# SubQuery Contracts

The SubQuery is an indexing tool for querying blockchains data. Anyone can build indexing service with SubQuery, and provide the api to making blockchain data easily accessible.

The SubQuery Network Smart Contracts are a set of Solidity contracts that power the decentralised SubQuery Network. The contracts enable a decentralized network that welcomes indexers running query projects and provides queries to consumers. Consumers pay for queries with the SubQuery Token (SQT).

This repository includes contracts, js-sdk and rust-sdk.

## Local development

### Config

We use dotenv to load env variable from `.env` file, copy `.env_template` to `.env`, and update the `ENDPOINT` and `SEED`.

### Build

-   `yarn install` install dependencies
-   `yarn build` build the contracts and js-sdk

### Test

-   `yarn test`

### Deploy

Make sure the local node is running and the `.env` config correctly.

Run `yarn deploy`, will see the addresses of contracts output in the console.

For example deploying the contracts to Testnet

```
yarn deploy --testnet
```

You can also continue deploying the contracts from the last step with `--history` parameter:

```
yarn deploy --testnet --history
```

Find the latest deployment file: `./publish/local.json`.

## Testnet

Testnet contracts are deployed on the `Polygon Mumbai`.
Find the latest deployment file: `./publish/testnet.json`.
Get configuration from js-sdk `networks['testnet']` or rust-sdk `Network::Testnet`.

kUSDC on Mumbai: https://mumbai.polygonscan.com/token/0x7E65A71046170A5b1AaB5C5cC64242EDF95CaBEA

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

-   `yarn deploy --testnet --history`

To verify the contracts deployment, run the following cmd to verify specific type:

-   `yarn verify --testnet --initialisation`
-   `yarn verify --testnet --configuration`
-   `yarn verify --testnet --ownership`
-   `yarn verify --testnet --all`

### test

Single Test
`yarn test ./test/SQToken.test.ts`

Note: After contract upgrade, should run below again.

```
    yarn build
    yarn test:all
    yarn mocha test/Staking.test.ts
    ...
```

### Upgrade Contract

`yarn upgrade <args> <matcher>`

| Position | arg                            | desc                                                                                                       |
| -------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1        | --testnet                      | use config for testnet ./scripts/config/contracts.config.ts                                                |
| 1        | --kepler                       | use config for kepler                                                                                      |
| 1        | --mainnet                      | use config for mainnet                                                                                     |
| 2        | --check-only                   | dry run                                                                                                    |
| 2        | --implementation-only          | deploy implementation contract without calling proxyAdmin to upgrade to, used for kepler & mainnet upgrade |
| last     | <contract name prefix matcher> | used when only want to upgrade specific contract                                                           |

Example

```shell
yarn upgrade --network testnet --check-only=false --target child
yarn upgrade --network testnet --check-only=false --target root
```

### Verify Contract on Polygonscan / etherscan

```
# set up ETHERSCAN_API_KEY in .env
yarn hardhat publishChild --deployment publish/testnet.json --network testnet --networkpair testnet
yarn hardhat publishRoot --deployment publish/testnet.json --network goerli --networkpair testnet
```

### Debug Script

```shell
node --inspect-brk -r ts-node/register -r tsconfig-paths/register scripts/...
```

### Fuzz Test

##### Install Echidna

-   Building using Nix
    `$ nix-env -i -f https://github.com/crytic/echidna/tarball/master`

##### Run Echidna Tests

-   Install solc 0.6.12:
    `$ nix-env -f https://github.com/dapphub/dapptools/archive/master.tar.gz -iA solc-versions.solc_0_6_12`

-   Run Echidna Tests:
    `$ echidna-test test-fuzz/PermissionedExchangeEchidnaTest.sol --contract PermissionedExchangeEchidnaTest --config echidna.config.yml`

### code flatten

`yarn hardhat flat contracts/PermissionedExchange.sol > Flattened.sol`

### revert code

You can find all revert code details at `./public/revertcode.json`

### Bridge Token Between L1 & L2

```
https://wiki.polygon.technology/docs/pos/design/bridge/ethereum-polygon/getting-started/
```

Deposit usually takes more than 20 min
Withdraw takes more than 40 min

### Withdraw token

For some rpcs, eth_getRootHash is not available, in that case, we should use withdrawExitFaster

### TODOs

to support L1&L2 token pair mode, we can not burn token in l2 (bridge layer) according to the standard-bridge doc.
Instead, we either can avoid burn token but switch to taking a fee to treasury, or we need to call cross chain transfer for burn token.
