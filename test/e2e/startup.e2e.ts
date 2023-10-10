import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';

import {deployContracts} from '../setup';
import {createPlanTemplates, createProjects, airdrop, ownerTransfer, balanceTransfer} from '../../scripts/startup';
import {cidToBytes32} from '../helper';
import config from 'scripts/config/startup.testnet.json';

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
            projectRegistry: deployment.projectRegistry,
            permissionedExchange: deployment.permissionedExchange,
        };

        await createPlanTemplates(sdk, mockProvider);
        await createProjects(sdk, mockProvider);
        await airdrop(sdk, mockProvider);
    });

    describe('startup', async () => {

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
                const info = await sdk.projectRegistry.queryInfos(i);
                expect(info.latestDeploymentId).to.be.equal(cidToBytes32(d.deploymentId));
                expect(info.latestVersion).to.be.equal(cidToBytes32(d.versionCid));
                expect(info.metadata).to.be.equal(cidToBytes32(d.metadataCid));
            }
        });
    });
});
