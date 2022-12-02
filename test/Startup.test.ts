import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';

import {deployContracts} from './setup';
import {setupNetwork, SetupSdk} from '../scripts/startup';
import {cidToBytes32, futureTimestamp} from './helper';
import jsonConfig from 'scripts/config/startup.json';

describe('startup script', () => {
    const mockProvider = waffle.provider;

    let sdk: SetupSdk;
    let config: typeof jsonConfig;
    let wallet;

    beforeEach(async () => {
        // deploy contracts
        [wallet] = await ethers.getSigners();
        const deployment = await deployContracts(wallet, wallet);
        sdk = {
            sqToken: deployment.token,
            airdropper: deployment.airdropper,
            planManager: deployment.planManager,
            queryRegistry: deployment.queryRegistry,
            permissionedExchange: deployment.permissionedExchange,
        };

        // setup network
        const startTime = await futureTimestamp(mockProvider, 60 * 60 * 2);
        const endTime = await futureTimestamp(mockProvider, 60 * 60 * 3);
        config = {...jsonConfig, setupConfig: {...jsonConfig.setupConfig, startTime, endTime}};
        await setupNetwork(sdk, config);
    });

    describe('startup', async () => {
        it('airdropper setups should work', async () => {
            expect(await sdk.airdropper.nextRoundId()).to.be.equal(1);
            expect((await sdk.airdropper.roundRecord(0)).tokenAddress).to.equal(sdk.sqToken.address);
            expect((await sdk.airdropper.roundRecord(0)).roundStartTime).to.equal(config.setupConfig.startTime);
            expect((await sdk.airdropper.roundRecord(0)).roundDeadline).to.equal(config.setupConfig.endTime);
            expect((await sdk.airdropper.roundRecord(0)).unclaimedAmount).to.equal(2100);

            const { setupConfig } = config;
            const { airdrops, amounts } = setupConfig;

            for (const [i, airdrop] of airdrops.entries()) {
                expect(await sdk.airdropper.airdropRecord(airdrop, 0)).to.equal(amounts[i]);
            }
        });

        it('planTemplate setups should work', async () => {
            expect(await sdk.planManager.planTemplateIds()).to.be.equal(5);
            const { setupConfig } = config;

            for (const [i, p] of setupConfig.planTemplates.entries()) {
                expect((await sdk.planManager.planTemplates(i)).period).to.be.equal(p.period);
            }
        });

        it('dictionaries should be created', async () => {
            const { dictionaries } = config;
            for (const [i, d] of dictionaries.entries()){
                const info = await sdk.queryRegistry.queryInfos(i);
                expect(info.latestDeploymentId).to.be.equal(cidToBytes32(d.deploymentId));
                expect(info.latestVersion).to.be.equal(cidToBytes32(d.versionCid));
                expect(info.metadata).to.be.equal(cidToBytes32(d.metadataCid));
            }
        });
    });
});
