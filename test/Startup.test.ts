import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {setups} from '../scripts/startup';

describe('Purchase Offer Market Contract', () => {
    const mockProvider = waffle.provider;
    let wallet;
    let sdk;
    beforeEach(async () => {
        [wallet] = await ethers.getSigners();
        //contract deployed start at era 1
        sdk = await deployContracts(wallet, wallet);
    });
    describe('startup', async () => {
        it('airdropper setups should work', async () => {
            await setups(sdk);
            expect(await sdk.airdropper.nextRoundId()).to.be.equal(1);
            expect((await sdk.airdropper.roundRecord(0)).tokenAddress).to.be.equal(sdk.token.address);
            expect((await sdk.airdropper.roundRecord(0)).roundStartTime).to.be.equal(1665503050);
            expect((await sdk.airdropper.roundRecord(0)).roundDeadline).to.be.equal(1668180003);
            expect((await sdk.airdropper.roundRecord(0)).unclaimedAmount).to.be.equal(2100);
            expect(await sdk.airdropper.airdropRecord('0xEEd36C3DFEefB2D45372d72337CC48Bc97D119d4', 0)).to.be.equal(
                100
            );
            expect(await sdk.airdropper.airdropRecord('0x592C6A31df20DD24a7d33f5fe526730358337189', 0)).to.be.equal(
                200
            );
            expect(await sdk.airdropper.airdropRecord('0x9184cFF04fD32123db66329Ab50Bf176ece2e211', 0)).to.be.equal(
                300
            );
            expect(await sdk.airdropper.airdropRecord('0xFf60C1Efa7f0F10594229D8A68c312d7020E3478', 0)).to.be.equal(
                400
            );
            expect(await sdk.airdropper.airdropRecord('0xBDB9D4dC13c5E3E59B7fd69230c7F44f7170Ce02', 0)).to.be.equal(
                500
            );
            expect(await sdk.airdropper.airdropRecord('0x0421700EE1890d461353A54eAA481488f440A68f', 0)).to.be.equal(
                600
            );
        });
        it('planTemplate setups should work', async () => {
            await setups(sdk);
            expect(await sdk.planManager.planTemplateIds()).to.be.equal(5);
            expect((await sdk.planManager.planTemplates(0)).period).to.be.equal(10800);
            expect((await sdk.planManager.planTemplates(1)).period).to.be.equal(1000);
            expect((await sdk.planManager.planTemplates(2)).period).to.be.equal(5000);
            expect((await sdk.planManager.planTemplates(3)).period).to.be.equal(30000);
            expect((await sdk.planManager.planTemplates(4)).period).to.be.equal(5630);
        });
    });
});
