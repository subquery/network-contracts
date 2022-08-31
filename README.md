# SubQuery Contracts & sdk

The Subquery is a indexing tool for querying blockchains data. Anyone can build indexing service with subquery, and provide the api to making blockchain data easily accessible.

The Subquery Network Smart Contracts are a set of Solidity contracts that are going to delpoy on Acala. The contracts enable a decentralized network that welcome indexers running query projects and provide queries to consumers. Consumers pay for queries with the Subquery Token (SQT).

The Subquery Network allows Delegators staking on Indxers to share their rewards, more delegation also help indxers are able to gain more rewards.

## Local Development

### config `.env` file

We use dotenv to load env variable from `.env` file, need to choose the specific env for `acala` or `moonbeam` in `.env_template`, copy the config to `.env`.

### run local node

**Acala**:

```sh
docker run --rm -p 9944:9944 acala/mandala-node:latest \
--dev --ws-external --rpc-methods=unsafe \
--instant-sealing  -levm=trace
```

Remove `--instant-sealing` if you want the chain producing blocks when no tx been committed.

**Moonbeam**:

```sh
docker pull purestake/moonbeam:latest

docker run --rm --name moonbeam_development -p 9944:9944 -p 9933:9933 \
purestake/moonbeam:latest \
--dev --ws-external --rpc-external
```

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

**Mandala TC7**:
```
ENDPOINT: https://acala-mandala-adapter.api.onfinality.io/public
WS_ENDPOINT: wss://acala-mandala-adapter.api.onfinality.io/public-ws
Chan ID: 595
Explorer: https://blockscout.mandala.acala.network/
```

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

-   `yarn deploy:mainnet`
-   `yarn deploy:testnet`

### test

`yarn test`

Note: After contract upgrade, should run below again.

```
    yarn build:contract
    yarn build:types
    yarn build:ts
    yarn test
    yarn mocha test/Staking.test.ts
    yarn mocha test/SQToken.test.ts
    yarn mocha test/QueryRegistry.test.ts
    yarn mocha test/IndexerRegistry.test.ts
    yarn mocha test/PlanManager.test.ts
    yarn mocha test/PurchaseOfferMarket.test.ts
    yarn mocha test/StateChannel.test.ts
```
### code flatten
`yarn hardhat flat contracts/PermissionedExchange.sol > Flattened.sol`
