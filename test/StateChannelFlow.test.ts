import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { deployContracts } from './setup';
import { deploymentIds } from './constants';
import {
    IndexerRegistry,
    RewardsPool,
    RewardsDistributor,
    EraManager,
    ERC20,
    Staking,
    StateChannel,
    StakingManager,
    RewardsHelper,
} from '../src';
import { registerRunner, startNewEra, time, etherParse } from './helper';
import { Wallet, BigNumber } from 'ethers';

describe('StateChannel Workflow Tests', () => {
    let wallet_0, runner, runner2, consumer, consumer2;
    let channelId, channelId2, channelId3, channelId4, channelId5, channelId7;

    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributor;
    let rewardsPool: RewardsPool;
    let rewardsHelper: RewardsHelper;
    let stateChannel: StateChannel;
    let stakingManager: StakingManager;

    const openChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        amount: BigNumber,
        price: BigNumber,
        expiration: number,
        deploymentId: string
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32', 'bytes'],
            [channelId, indexer.address, consumer.address, amount, price, expiration, deploymentId, '0x']
        );
        const payloadHash = ethers.utils.keccak256(msg);

        const indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        const consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

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
        const payloadHash = ethers.utils.keccak256(msg);

        const indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        const consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

        const query = {
            channelId: channelId,
            spent: spent,
            isFinal: isFinal,
            indexerSign: indexerSign,
            consumerSign: consumerSign,
        };

        if (mode == 0) {
            await stateChannel.checkpoint(query);
        } else if (mode == 1) {
            await stateChannel.connect(consumer).terminate(query);
        } else {
            await stateChannel.connect(indexer).respond(query);
        }
    };

    const deployer = () => deployContracts(wallet_0, runner);
    before(async () => {
        [wallet_0, runner, runner2, consumer, consumer2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributor;
        rewardsPool = deployment.rewardsPool;
        rewardsHelper = deployment.rewardsHelper;
        eraManager = deployment.eraManager;
        stateChannel = deployment.stateChannel;
        stakingManager = deployment.stakingManager;

        await stateChannel.setTerminateExpiration(30); // 5s

        await registerRunner(token, indexerRegistry, staking, wallet_0, runner, etherParse('2000'));
        await registerRunner(token, indexerRegistry, staking, wallet_0, runner2, etherParse('2000'));
        await token.connect(wallet_0).transfer(consumer.address, etherParse('500'));
        await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('500'));
        await token.connect(wallet_0).transfer(consumer2.address, etherParse('500'));
        await token.connect(consumer2).increaseAllowance(stateChannel.address, etherParse('500'));

        await eraManager.connect(wallet_0).updateEraPeriod(time.duration.days(1).toString());
        await startNewEra(eraManager);

        //create statechannels
        channelId = ethers.utils.randomBytes(32);
        channelId2 = ethers.utils.randomBytes(32);
        channelId3 = ethers.utils.randomBytes(32);
        channelId4 = ethers.utils.randomBytes(32);
        channelId5 = ethers.utils.randomBytes(32);
        channelId7 = ethers.utils.randomBytes(32);
        await openChannel(
            channelId,
            runner,
            consumer,
            etherParse('10'),
            etherParse('1'),
            3000000000000000,
            deploymentIds[0]
        );
        await openChannel(
            channelId2,
            runner,
            consumer2,
            etherParse('10'),
            etherParse('1'),
            3000000000000000,
            deploymentIds[1]
        );
        await openChannel(
            channelId3,
            runner2,
            consumer,
            etherParse('10'),
            etherParse('1'),
            3000000000000000,
            deploymentIds[0]
        );
        await openChannel(
            channelId4,
            runner2,
            consumer2,
            etherParse('10'),
            etherParse('1'),
            3000000000000000,
            deploymentIds[1]
        );
        await openChannel(
            channelId5,
            runner,
            consumer,
            etherParse('10'),
            etherParse('1'),
            3000000000000000,
            deploymentIds[0]
        );
        await openChannel(
            channelId7,
            runner2,
            consumer,
            etherParse('10'),
            etherParse('1'),
            3000000000000000,
            deploymentIds[0]
        );
    });

    it('check balance when one indexer with no staking', async () => {
        //checkpoint channel
        await operateChannel(channelId, runner, consumer, etherParse('1'), false, 0);
        expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('1'));

        await operateChannel(channelId, runner, consumer, etherParse('3'), false, 0);
        expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('3'));

        expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('57'));
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('3'));

        await startNewEra(eraManager);

        //batchCollect at rewardpool
        await rewardsPool.batchCollect(runner.address);
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('0'));
        expect(await token.balanceOf(rewardsDistributor.address)).to.equal(etherParse('3'));
        expect(
            await rewardsDistributor.getRewardAddTable(runner.address, (await eraManager.eraNumber()).sub(1))
        ).to.equal(etherParse('3'));
    });

    it('check balance when two indexer with staking', async () => {
        //indexer:
        //stakeRatio = 1/4
        //feeRatio = 1/5
        //stakeRatio > feeRatio
        //indexer2:
        //stakeRatio = 3/4
        //feeRatio = 4/5
        //feeRatio > stakeRatio
        //delegator apply staking
        await token.increaseAllowance(staking.address, etherParse('100'));
        await stakingManager.delegate(runner.address, etherParse('1'));
        await stakingManager.delegate(runner2.address, etherParse('3'));

        //checkpoint channel
        await operateChannel(channelId, runner, consumer, etherParse('1'), false, 0);
        expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('1'));

        await operateChannel(channelId3, runner2, consumer, etherParse('4'), false, 0);
        expect((await stateChannel.channel(channelId3)).spent).to.equal(etherParse('4'));

        expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('55'));
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('5'));

        // era 3 -> era 4
        await startNewEra(eraManager);

        //batchCollect at rewardpool
        await rewardsPool.batchCollect(runner.address);
        await rewardsPool.batchCollect(runner2.address);
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('0.233966512466940628'));
        expect(await token.balanceOf(rewardsDistributor.address)).to.equal(etherParse('4.766033487533059372'));
        expect(
            await rewardsDistributor.getRewardAddTable(runner.address, (await eraManager.eraNumber()).sub(1))
        ).to.equal(etherParse('1.842015749320193294'));
        expect(
            await rewardsDistributor.getRewardAddTable(runner2.address, (await eraManager.eraNumber()).sub(1))
        ).to.equal(etherParse('2.924017738212866078'));

        await rewardsDistributor.collectAndDistributeRewards(runner.address);
        await rewardsDistributor.collectAndDistributeRewards(runner2.address);

        await rewardsDistributor.claimFrom(runner.address, runner.address);
        await rewardsDistributor.claimFrom(runner2.address, runner2.address);

        // precision adjustment
        expect(await token.balanceOf(rewardsDistributor.address)).to.equal(etherParse('0.000000001533059372'));

        //checkpoint channel
        await operateChannel(channelId5, runner, consumer, etherParse('1'), false, 0);
        expect((await stateChannel.channel(channelId5)).spent).to.equal(etherParse('1'));

        await operateChannel(channelId7, runner2, consumer, etherParse('4'), false, 0);
        expect((await stateChannel.channel(channelId7)).spent).to.equal(etherParse('4'));

        expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('50'));
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('5.233966512466940628'));

        // multi era
        await startNewEra(eraManager);
        await startNewEra(eraManager);
        await startNewEra(eraManager);

        // catchup before batchCollect
        await rewardsHelper.indexerCatchup(runner.address);
        await rewardsHelper.indexerCatchup(runner2.address);

        //batchCollect at rewardpool
        await rewardsPool.batchCollect(runner.address);
        await rewardsPool.batchCollect(runner2.address);
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('0.244537549581081481'));
        expect(await token.balanceOf(rewardsDistributor.address)).to.equal(etherParse('4.989428964418918519'));
        expect(
            await rewardsDistributor.getRewardAddTable(runner.address, (await eraManager.eraNumber()).sub(1))
        ).to.equal(etherParse('0'));
        expect(
            await rewardsDistributor.getRewardAddTable(runner2.address, (await eraManager.eraNumber()).sub(1))
        ).to.equal(etherParse('0'));

        await rewardsDistributor.claimFrom(runner.address, runner.address);
        await rewardsDistributor.claimFrom(runner2.address, runner2.address);

        // precision adjustment
        expect(await token.balanceOf(rewardsDistributor.address)).to.equal(etherParse('0.005549218418918519'));
    });

    it('check balance when two indexer with staking and deploymentIds', async () => {
        await token.increaseAllowance(staking.address, etherParse('100'));
        await stakingManager.delegate(runner.address, etherParse('1'));
        await stakingManager.delegate(runner2.address, etherParse('3'));

        //checkpoint channel
        await operateChannel(channelId, runner, consumer, etherParse('1'), false, 0);
        expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('1'));
        await operateChannel(channelId2, runner, consumer2, etherParse('2'), false, 0);
        expect((await stateChannel.channel(channelId2)).spent).to.equal(etherParse('2'));

        await operateChannel(channelId3, runner2, consumer, etherParse('4'), false, 0);
        expect((await stateChannel.channel(channelId3)).spent).to.equal(etherParse('4'));
        await operateChannel(channelId4, runner2, consumer2, etherParse('3'), false, 0);
        expect((await stateChannel.channel(channelId4)).spent).to.equal(etherParse('3'));

        expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('50'));
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('10'));

        await startNewEra(eraManager);

        //batchCollect at rewardpool
        await rewardsPool.batchCollect(runner.address);
        await rewardsPool.batchCollect(runner2.address);
        expect(await token.balanceOf(rewardsPool.address)).to.equal(etherParse('0.256525672704023517'));
        expect(await token.balanceOf(rewardsDistributor.address)).to.equal(etherParse('9.743474327295976483'));
        expect(
            await rewardsDistributor.getRewardAddTable(runner.address, (await eraManager.eraNumber()).sub(1))
        ).to.equal(etherParse('4.162810166126582740'));
        expect(
            await rewardsDistributor.getRewardAddTable(runner2.address, (await eraManager.eraNumber()).sub(1))
        ).to.equal(etherParse('5.580664161169393743'));
    });
});
