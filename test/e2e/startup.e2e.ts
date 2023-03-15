import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';

import {deployContracts} from '../setup';
import {qrStartup, pmStartup, airdropStartup, ownerTransfer, balanceTransfer} from '../../scripts/startup';
import {cidToBytes32} from '../helper';
import config from 'scripts/config/startup.json';

describe('startup script', () => {
    let sdk;
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

        await qrStartup(sdk);
        await pmStartup(sdk);
        await airdropStartup(sdk);
        await ownerTransfer(sdk);
        await balanceTransfer(sdk, wallet);


    });

    describe('startup', async () => {
        it('airdropper setups should work', async () => {
            expect(await sdk.airdropper.nextRoundId()).to.be.equal(1);
            expect((await sdk.airdropper.roundRecord(0)).tokenAddress).to.equal(sdk.sqToken.address);
            expect((await sdk.airdropper.roundRecord(0)).unclaimedAmount).to.equal(5100);

            const {airdrops, amounts} = config;

            for (const [i, airdrop] of airdrops.entries()) {
                expect(await sdk.airdropper.airdropRecord(airdrop, 0)).to.equal(amounts[i]);
            }
        });

        it('planTemplate setups should work', async () => {
            expect(await sdk.planManager.nextTemplateId()).to.be.equal(5);
            const {planTemplates} = config;

            for (const [i, p] of planTemplates.entries()) {
                expect((await sdk.planManager.getPlanTemplate(i)).period).to.be.equal(p.period);
            }
        });

        it('dictionaries should be created', async () => {
            const {projects} = config;
            for (const [i, d] of projects.entries()) {
                const info = await sdk.queryRegistry.queryInfos(i);
                expect(info.latestDeploymentId).to.be.equal(cidToBytes32(d.deploymentId));
                expect(info.latestVersion).to.be.equal(cidToBytes32(d.versionCid));
                expect(info.metadata).to.be.equal(cidToBytes32(d.metadataCid));
            }
        });
    });
});
