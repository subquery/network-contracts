import {expect, use} from 'chai';
import {Signer} from 'ethers';
import {solidity} from 'ethereum-waffle';
import {SQToken, SQToken__factory} from '../src/typechain';
import setup from '../test/setup';
import {Provider} from '@ethersproject/providers';

use(solidity);

const sqtAddress = '0xe381a3D153293a81Dd26C3E6EAd18C74979e5Eb5';

describe('SubQuery Token e2e', () => {
    let testSigners: {[key: string]: Signer};
    let provider: Provider;
    let token: SQToken;

    before(async () => {
        const contents = await setup();
        testSigners = contents.testSigners;
        provider = contents.provider;
        token = await SQToken__factory.connect(sqtAddress, provider);
    });

    describe('ERC20 behaviour', () => {
        it('Query Balance', async () => {
            const walletAddress = await testSigners.alice.getAddress();
            const balance = await token.balanceOf(walletAddress);
            expect(balance.gt('1000000000000000000000000')).to.be.true;
        });
        it('can transfer', async () => {
            const testAmount = 1234567890;
            const charlie = await testSigners.charlie.getAddress();
            const balanceBefore = await token.balanceOf(charlie);
            const tx = await token.connect(testSigners.bob).transfer(charlie, testAmount);
            await tx.wait();
            const balanceAfter = await token.balanceOf(charlie);
            expect(balanceAfter.sub(balanceBefore).toNumber()).to.equal(testAmount);
        });
    });
});
