# SubQuery Contracts & sdk

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

#### send tx in acala (normal tx and eip72)

| rpc port | payload format | signing account | provider         | Note                                                   |
| -------- | -------------- | --------------- | ---------------- | ------------------------------------------------------ |
| 9944     | eth tx         | substrate       | acala's provider |                                                        |
| 9944     | eth tx         | ethereum        | acala's provider |                                                        |
| 9944     | eip712         | ethereum        | acala's provider |                                                        |
| 8545     | eth tx         | ethereum        | ethers or web3js | custom encoding in gasPrice, can not use with Metamask |
| 8545     | eip712         | ethereum        | ethers or web3js | unsupported transaction type 96 with ethers            |

#### Run Eth RPC Adapter

eth rpc adapter is the service who provide ethereum compatible rpc.
`git clone https://github.com/AcalaNetwork/bodhi.js`

```shell
# install rush
npm install -g @microsoft/rush
# build
rush update && rush build
# run subql
cd evm-subql
yarn
yarn codegen
yarn build
docker-compose pull
docker-compose -f macos-docker-compose.yml up
# run adapter
cd eth-rpc-adapter
yarn start
```

rush update && rush build

#### Existing issues

1. sign tx in normal way and send via ethers (not via metamask).
   Will receive tx hash not match error, though it actually succeeded. Acala will fix that.
2. can not send tx in metamask.
   Will be told no enough balance to pay for gas fee
3. can not send eip712 tx via ethers provider.
   will have an error `unsupported transaction type 96`. Workaround is
    1. send via 9944
    2. use `provider.perform("sendTransaction", { signedTransaction: hexTx })` to skip the verification

**Moonbeam**:

```sh
docker pull purestake/moonbeam:latest

docker run --rm --name moonbeam_development -p 9944:9944 -p 9933:9933 \
purestake/moonbeam:latest \
--dev --ws-external --rpc-external
```

You can config `Custome RPC` network on MetaMask to connect with the local Moonbeam node.
The specific fields for the config: `rpc_url=http://127.0.0.1:9933` and `chain_id=1281`

### deploy the contracts

Make sure the local node is running and the `.env` config correctly.
Run `yarn deploy`, will see the addresses of contracts output in the console.
Find the latest deployment file: `./publish/local.json`.

### internal testnet

`wss://node-6834800426104545280.jm.onfinality.io/ws?apikey=02d2de6a-8858-4b6b-85c9-457a794cd2c0`

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
