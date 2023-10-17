import * as dotenv from 'dotenv';

import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import { HardhatUserConfig, task } from 'hardhat/config';
import 'solidity-coverage';
import 'solidity-docgen';
import 'tsconfig-paths/register';
require('solidity-coverage');


dotenv.config();

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

task('flat', 'Flattens and prints contracts and their dependencies (Resolves licenses)')
    .addOptionalVariadicPositionalParam('files', 'The files to flatten', undefined)
    .setAction(async ({ files }, hre) => {
        let flattened = await hre.run('flatten:get-flattened-sources', { files });

        // Remove every line started with "// SPDX-License-Identifier:"
        flattened = flattened.replace(/SPDX-License-Identifier:/gm, 'License-Identifier:');
        flattened = `// SPDX-License-Identifier: MIXED\n\n${flattened}`;

        // Remove every line started with "pragma experimental ABIEncoderV2;" except the first one
        flattened = flattened.replace(
            /pragma experimental ABIEncoderV2;\n/gm,
            (
                (i) => (m) =>
                    !i++ ? m : ''
            )(0)
        );
        console.log(flattened);
    });

task('publish', "verify and publish contracts on etherscan")
    .addParam("deployment", "Deployment file path")
    .setAction(async (taskArgs, hre) => {
        const deployment = require(taskArgs.deployment);

        try {
            //InflationController
            // await hre.run("verify:verify", {
            //     address: deployment.InflationController.innerAddress,
            //     constructorArguments: [],
            // });

            //SQToken
            // await hre.run("verify:verify", {
            //     address: deployment.SQToken.address,
            //     constructorArguments: [deployment.InflationController.address, etherParse("25000000")],
            // });

            //VSQToken
            // await hre.run("verify:verify", {
            //     address: deployment.VSQToken.address,
            //     constructorArguments: [],
            // });

            //Airdropper
            await hre.run("verify:verify", {
                address: deployment.Airdropper.address,
                constructorArguments: ["0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C"],
            });

            //Vesting
            await hre.run("verify:verify", {
                address: deployment.Vesting.address,
                constructorArguments: [deployment.SQToken.address],
            });

            //Staking
            await hre.run("verify:verify", {
                address: deployment.Staking.innerAddress,
                constructorArguments: [],
            });

            //StakingManager
            await hre.run("verify:verify", {
                address: deployment.StakingManager.innerAddress,
                constructorArguments: [],
            });

            //EraManager
            await hre.run("verify:verify", {
                address: deployment.EraManager.innerAddress,
                constructorArguments: [],
            });

            //IndexerRegistry
            await hre.run("verify:verify", {
                address: deployment.IndexerRegistry.innerAddress,
                constructorArguments: [],
            });

            //ProjectRegistry
            await hre.run("verify:verify", {
                address: deployment.ProjectRegistry.innerAddress,
                constructorArguments: [],
            });

            //PlanManager
            await hre.run("verify:verify", {
                address: deployment.PlanManager.innerAddress,
                constructorArguments: [],
            });

            //PurchaseOfferMarket
            await hre.run("verify:verify", {
                address: deployment.PurchaseOfferMarket.innerAddress,
                constructorArguments: [],
            });

            //ServiceAgreementRegistry
            await hre.run("verify:verify", {
                address: deployment.ServiceAgreementRegistry.innerAddress,
                constructorArguments: [],
            });

            //RewardsDistributer
            await hre.run("verify:verify", {
                address: deployment.RewardsDistributer.innerAddress,
                constructorArguments: [],
            });

            //RewardsPool
            await hre.run("verify:verify", {
                address: deployment.RewardsPool.innerAddress,
                constructorArguments: [],
            });

            //RewardsStaking
            await hre.run("verify:verify", {
                address: deployment.RewardsStaking.innerAddress,
                constructorArguments: [],
            });

            //RewardsHelper
            await hre.run("verify:verify", {
                address: deployment.RewardsHelper.innerAddress,
                constructorArguments: [],
            });

            //StateChannel
            await hre.run("verify:verify", {
                address: deployment.StateChannel.innerAddress,
                constructorArguments: [],
            });

            //PermissionedExchange
            await hre.run("verify:verify", {
                address: deployment.PermissionedExchange.innerAddress,
                constructorArguments: [],
            });

            //ConsumerHost
            await hre.run("verify:verify", {
                address: deployment.ConsumerHost.innerAddress,
                constructorArguments: [],
            });

            //DisputeManager
            await hre.run("verify:verify", {
                address: deployment.DisputeManager.innerAddress,
                constructorArguments: [],
            });

        } catch (err) {
            console.log(err);
        }
    });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
    solidity: '0.8.15',
    networks: {
        hardhat: {},
        testnet: {
            url: "https://rpc.ankr.com/polygon_mumbai",
        },
        kepler: {
            url: "https://polygon-rpc.com",
        },
        mainnet: {
            url: "https://polygon-rpc.com",
        }
    },
    gasReporter: {
        currency: 'USD',
        gasPrice: 21,
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    typechain: {
        outDir: 'src/typechain',
        target: 'ethers-v5',
        externalArtifacts: [
            // This ensures TypeChain includes OpenZeppelin artifacts
            'node_modules/@openzeppelin/contracts/build/contracts/*.json', 
            'node_modules/@openzeppelin/contracts-upgradeable/build/contracts/*.json',
        ],
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: true,
        disambiguatePaths: false,
    },
    mocha: {
        timeout: 100000000,
    },
    docgen: {
        outputDir: 'docs/contracts',
        pages: 'files',
        exclude: ['interfaces', 'utils'],
        templates: 'docs/themes/markdown',
    },
};

export default config;