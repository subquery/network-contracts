import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {METADATA_HASH, DEPLOYMENT_ID, deploymentIds, metadatas, VERSION} from './constants';
import {IndexerRegistry, RewardsPool, RewardsDistributer, EraManager, SQToken, Staking, StateChannel} from '../src';
import {constants, registerIndexer, startNewEra, time, delay, etherParse} from './helper';
import {utils, Wallet, BigNumberish, BytesLike, BigNumber} from 'ethers';
import { MockProvider } from 'ethereum-waffle';


describe('StateChannel Workflow Tests', () => {
    const mockProvider = waffle.provider;
    const deploymentId = deploymentIds[0];
    let wallet_0, indexer, indexer2, consumer, consumer2;
    let channelId, channelId2, channelId3, channelId4;

    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let rewardsPool: RewardsPool;
    let stateChannel: StateChannel;

    const openChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        amount: BigNumber,
        price: BigNumber,
        expiration: number
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32', 'bytes'],
            [channelId, indexer.address, consumer.address, amount, price, expiration, deploymentId, '0x']
        );
        let payloadHash = ethers.utils.keccak256(msg);

        let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

        await stateChannel
            .connect(consumer)
            .open(
                channelId,
                indexer.address,
                consumer.address,
                amount,
                price,
                expiration,
                deploymentId,
                '0x',
                indexerSign,
                consumerSign
            );
    };

    const operateChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        spent: BigNumber,
        isFinal: boolean,
        mode: number //0: checkpoint; 1: terminate; 2: respond
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        const msg = abi.encode(['uint256', 'uint256', 'bool'], [channelId, spent, isFinal]);
        let payloadHash = ethers.utils.keccak256(msg);

        let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

        let query = {
            channelId: channelId,
            spent: spent,
            isFinal: isFinal,
            indexerSign: indexerSign,
            consumerSign: consumerSign,
        };

        if(mode == 0) {
            await stateChannel.checkpoint(query);
        }else if(mode == 1) {
            await stateChannel.connect(consumer).terminate(query);
        }else {
            await stateChannel.connect(indexer).respond(query);
        }
    };

    const extendChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        expiration: number
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        const state = await stateChannel.channel(channelId);
        const preExpirationAt = state.expiredAt;
        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256'],
            [channelId, indexer.address, consumer.address, preExpirationAt, expiration]
        );
        let payload = ethers.utils.keccak256(msg);
        let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payload));
        let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payload));

        await stateChannel.extend(channelId, preExpirationAt, expiration, indexerSign, consumerSign);
    }

    const fundChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        amount: BigNumber
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        let total = (await stateChannel.channel(channelId)).total;
        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
            [channelId, indexer.address, consumer.address, total, amount, '0x']
        );
        let payload = ethers.utils.keccak256(msg);
        let sign = await consumer.signMessage(ethers.utils.arrayify(payload));
        await stateChannel.fund(channelId, total, amount, '0x', sign);
    }

    beforeEach(async () => {
        [wallet_0, indexer, indexer2, consumer, consumer2] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, indexer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributer;
        rewardsPool = deployment.rewardsPool;
        eraManager = deployment.eraManager;
        stateChannel = deployment.stateChannel;

        await stateChannel.setTerminateExpiration(30); // 5s

        await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '2000');
        await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer2, '2000');
        await token.connect(wallet_0).transfer(consumer.address, etherParse('500'));
        await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('500'));
        await token.connect(wallet_0).transfer(consumer2.address, etherParse('500'));
        await token.connect(consumer2).increaseAllowance(stateChannel.address, etherParse('500'));

        await eraManager.connect(wallet_0).updateEraPeriod(time.duration.days(1).toString());
        await startNewEra(mockProvider,eraManager);

        //create statechannels
        channelId = ethers.utils.randomBytes(32);
        channelId2 = ethers.utils.randomBytes(32);
        channelId3 = ethers.utils.randomBytes(32);
        channelId4 = ethers.utils.randomBytes(32);
        await openChannel(channelId, indexer, consumer, etherParse('10'), etherParse('1'), 3000000000000000);
        await openChannel(channelId2, indexer, consumer2, etherParse('15'), etherParse('1'), 3000000000000000);
        await openChannel(channelId3, indexer2, consumer, etherParse('5'), etherParse('1'), 3000000000000000);
        await openChannel(channelId4, indexer2, consumer2, etherParse('8'), etherParse('1'), 3000000000000000);
    });

    it.only('check after checkpoint balance', async () => {
        //checkpoint channel
        await operateChannel(channelId, indexer, consumer, etherParse('1'), false, 0);
        expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('1'));

        await operateChannel(channelId2, indexer, consumer2, etherParse('3'), false, 0);
        expect((await stateChannel.channel(channelId2)).spent).to.equal(etherParse('3'));

        await operateChannel(channelId3, indexer2, consumer, etherParse('5'), false, 0);
        expect((await stateChannel.channel(channelId3)).spent).to.equal(etherParse('5'));

        await operateChannel(channelId4, indexer2, consumer2, etherParse('8'), false, 0);
        expect((await stateChannel.channel(channelId4)).spent).to.equal(etherParse('8'));

        expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('21'));
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('17'));

        // await startNewEra(mockProvider,eraManager);

        await operateChannel(channelId, indexer, consumer, etherParse('2'), false, 0);
        expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('2'));

        await operateChannel(channelId2, indexer, consumer2, etherParse('4'), false, 0);
        expect((await stateChannel.channel(channelId2)).spent).to.equal(etherParse('4'));

        expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('19'));
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('19'));

        //batchCollect at rewardpool
        rewardsPool.batchCollect(indexer);
        rewardsPool.batchCollect(indexer2);
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('0'));
        expect(await token.balanceOf(rewardsDistributor.address)).to.equal(etherParse('19'));


        // //fund channel
        // await fundChannel(channelId3, indexer2, consumer, etherParse('5'));
        // await fundChannel(channelId4, indexer2, consumer2, etherParse('5'));
        // expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('31'));

        // //checkpoint channel 
        // await operateChannel(channelId3, indexer2, consumer, etherParse('20'), false, 0);
        // expect((await stateChannel.channel(channelId3)).spent).to.equal(etherParse('10'));
        // expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('26'));

        // //extend channel 2
        // await extendChannel(channelId2, indexer, consumer2, 100);

        // //terminate channel
        // await operateChannel(channelId, indexer, consumer, etherParse('1'), false, 1);
        // const state = await stateChannel.channel(channelId);
        // expect(state.spent).to.equal(etherParse('0'));
        // expect(state.status).to.equal(2); // Terminate

        // await operateChannel(channelId2, indexer, consumer2, etherParse('4'), false, 1);
        // const state2 = await stateChannel.channel(channelId2);
        // expect(state.spent).to.equal(etherParse('0'));
        // expect(state.status).to.equal(2); // Terminate

        // //respond channel
        // await operateChannel(channelId2, indexer, consumer2, etherParse('4'), false, 2);
        
        // //time travel
        // await delay(60);
        // //consumer claim
        // // channel 1: not expired, terminated, claim 9 SQT, consumer spend 1, indexer reward 1
        // // channel 2: not expired, terminated, respond, claim 11 SQT, consumer spend 15, indexer reward 4
        // // channel 3: expired, not terminated, none to claim, consumer spend 10, indexer reward 10
        // // channel 4: not expired, not terminated, cannot claim, consumer spend 13, indexer reward 8
        // await stateChannel.claim(channelId);
        // await expect(stateChannel.claim(channelId2)).to.be.revertedWith('SC008');
        // await stateChannel.claim(channelId3);
        // await expect(stateChannel.claim(channelId4)).to.be.revertedWith('SC008');

        // // balance check 
        // expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('5'));
        // expect(await token.balanceOf(consumer.address)).to.equal(etherParse('489'));
        // expect(await token.balanceOf(consumer2.address)).to.equal(etherParse('483'));
        // expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('23'));
    });












})