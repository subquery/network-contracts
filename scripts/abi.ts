import { readFileSync, writeFileSync } from 'fs';

const main = async () => {
    try {
        const contracts = [
            'Settings',
            'VSQToken',
            'SQTGift',
            'SQTRedeem',
            'Staking',
            'StakingManager',
            'StakingAllocation',
            'AllocationMananger',
            'IndexerRegistry',
            'ProjectRegistry',
            'PlanManager',
            'PurchaseOfferMarket',
            'ServiceAgreementRegistry',
            'RewardsDistributor',
            'RewardsPool',
            'RewardsStaking',
            'RewardsHelper',
            'RewardsBooster',
            'StateChannel',
            'Airdropper',
            'PermissionedExchange',
            'ConsumerHost',
            'DisputeManager',
            'ConsumerRegistry',
            'PriceOracle',
            'TokenExchange',
        ];
        const childContracts = ['L2SQToken', 'EraManager'];
        const rootContracts = ['SQToken', 'Vesting', 'VTSQToken', 'InflationController', 'OpDestination'];
        const proxyContracts = ['ProxyAdmin'];
        const run = (input: string[], rootDir) => {
            input.forEach(function (name) {
                const readPath = `${rootDir}/${name}.sol/${name}.json`;
                const contract = JSON.parse(readFileSync(readPath, 'utf8'));

                const savePath = `${__dirname}/../publish/ABI/${name}.json`;
                writeFileSync(savePath, JSON.stringify(contract.abi, null, 4));
            });
        };
        run(contracts, `${__dirname}/../artifacts/contracts`);
        run(rootContracts, `${__dirname}/../artifacts/contracts/root`);
        run(childContracts, `${__dirname}/../artifacts/contracts/l2`);
        run(proxyContracts, `${__dirname}/../artifacts/@openzeppelin/contracts/proxy/transparent`);
        console.log(`Generated ABI files completed`);
    } catch (e) {
        console.log(`e`, e);
    }
};

main();
