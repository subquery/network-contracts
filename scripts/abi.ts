import {readFileSync, writeFileSync} from 'fs';

const main = async () => {
    try {
        const contracts = [
            'ProxyAdmin',
            'Settings',
            'InflationController',
            'SQToken',
            'VSQToken',
            'Staking',
            'StakingManager',
            'EraManager',
            'IndexerRegistry',
            'QueryRegistry',
            'PlanManager',
            'PurchaseOfferMarket',
            'ServiceAgreementRegistry',
            'RewardsDistributer',
            'RewardsPool',
            'RewardsStaking',
            'RewardsHelper',
            'StateChannel',
            'Airdropper',
            'PermissionedExchange',
            'Vesting',
            'ConsumerHost',
            'DisputeManager',
            'ConsumerRegistry',
        ];
        contracts.forEach(function (name) {
            const readPath = `${__dirname}/../artifacts/contracts/${name}.sol/${name}.json`;
            const contract = JSON.parse(readFileSync(readPath, 'utf8'));
            console.log(`Load contract: ${name}`);

            const savePath = `${__dirname}/../publish/ABI/${name}.json`;
            writeFileSync(savePath, JSON.stringify(contract.abi, null, 4));
            console.log(`Saved contract ${name}`);
        });
    } catch (e) {
        console.log(`e`, e);
    }
};

main();
