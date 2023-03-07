import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';

import {deployContracts} from '../setup';
import {setupNetwork, SetupSdk} from '../../scripts/startup';
import {cidToBytes32} from '../helper';
import jsonConfig from 'scripts/config/startup.json';

describe('startup script', () => {
    let sdk: SetupSdk;
    let config: typeof jsonConfig;
    let wallet;

    before(async () => {
        // deploy contracts
        const mockProvider = waffle.provider;
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
        config = {...jsonConfig, setupConfig: {...jsonConfig.setupConfig}};
        await setupNetwork(sdk, mockProvider, config);
    });

    describe('startup', async () => {
        it('airdropper setups should work', async () => {
            expect(await sdk.airdropper.nextRoundId()).to.be.equal(1);
            expect((await sdk.airdropper.roundRecord(0)).tokenAddress).to.equal(sdk.sqToken.address);
            expect((await sdk.airdropper.roundRecord(0)).unclaimedAmount).to.equal(5100);

            const {setupConfig} = config;
            const {airdrops, amounts} = setupConfig;

            for (const [i, airdrop] of airdrops.entries()) {
                expect(await sdk.airdropper.airdropRecord(airdrop, 0)).to.equal(amounts[i]);
            }
        });

        it('planTemplate setups should work', async () => {
            expect(await sdk.planManager.nextTemplateId()).to.be.equal(5);
            const {setupConfig} = config;

            for (const [i, p] of setupConfig.planTemplates.entries()) {
                expect((await sdk.planManager.getPlanTemplate(i)).period).to.be.equal(p.period);
            }
        });

        it('dictionaries should be created', async () => {
            const {dictionaries} = config;
            for (const [i, d] of dictionaries.entries()) {
                const info = await sdk.queryRegistry.queryInfos(i);
                expect(info.latestDeploymentId).to.be.equal(cidToBytes32(d.deploymentId));
                expect(info.latestVersion).to.be.equal(cidToBytes32(d.versionCid));
                expect(info.metadata).to.be.equal(cidToBytes32(d.metadataCid));
            }
        });
    });
});
