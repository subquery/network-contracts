import * as dotenv from 'dotenv';
import util from 'util';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import {HardhatUserConfig, task} from 'hardhat/config';
import 'solidity-coverage';
import 'solidity-docgen';
import 'tsconfig-paths/register';
import {constants, utils} from "ethers";
import contractConfig from './scripts/config/contracts.config';

const exec = util.promisify(require('child_process').exec);

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
    .setAction(async ({files}, hre) => {
        let flattened = await hre.run('flatten:get-flattened-sources', {files});

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

task('publishRoot', "verify and publish contracts on etherscan")
    .addParam("deployment", "Deployment file path")
    .addParam('networkpair','testnet|kepler|mainnet')
    .setAction(async (taskArgs, hre) => {
        const deployment = require(taskArgs.deployment);
        const configNetwork = taskArgs.networkpair;

        try {
            await hre.run("verify:verify", {
                address: deployment.root.ProxyAdmin.address,
                constructorArguments: [],
            });
            // InflationController
            await hre.run("verify:verify", {
                address: deployment.root.InflationController.address,
                constructorArguments: [deployment.root.InflationController.innerAddress, deployment.root.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.root.InflationController.innerAddress,
                constructorArguments: [],
            });

            // SQToken
            await hre.run("verify:verify", {
                address: deployment.root.SQToken.address,
                constructorArguments: [constants.AddressZero, utils.parseEther("10000000000")],
            });

            //Vesting
            await hre.run("verify:verify", {
                address: deployment.root.Vesting.address,
                constructorArguments: [deployment.SQToken.address],
            });

            // EventSyncRootTunnel
            await hre.run("verify:verify", {
                address: deployment.root.EventSyncRootTunnel.address,
                constructorArguments: ['0x2890bA17EfE978480615e330ecB65333b880928e', '0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA'], // testnet
            });

            //VSQToken
            // await hre.run("verify:verify", {
            //     address: deployment.VSQToken.address,
            //     constructorArguments: [],
            // });

            // //Airdropper
            // await hre.run("verify:verify", {
            //     address: deployment.Airdropper.address,
            //     constructorArguments: ["0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C"],
            // });
            //
            //
            // //Staking
            // await hre.run("verify:verify", {
            //     address: deployment.Staking.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //StakingManager
            // await hre.run("verify:verify", {
            //     address: deployment.StakingManager.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //EraManager
            // await hre.run("verify:verify", {
            //     address: deployment.EraManager.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //IndexerRegistry
            // await hre.run("verify:verify", {
            //     address: deployment.IndexerRegistry.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //ProjectRegistry
            // await hre.run("verify:verify", {
            //     address: deployment.ProjectRegistry.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //PlanManager
            // await hre.run("verify:verify", {
            //     address: deployment.PlanManager.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //PurchaseOfferMarket
            // await hre.run("verify:verify", {
            //     address: deployment.PurchaseOfferMarket.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //ServiceAgreementRegistry
            // await hre.run("verify:verify", {
            //     address: deployment.ServiceAgreementRegistry.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //RewardsDistributer
            // await hre.run("verify:verify", {
            //     address: deployment.RewardsDistributer.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //RewardsPool
            // await hre.run("verify:verify", {
            //     address: deployment.RewardsPool.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //RewardsStaking
            // await hre.run("verify:verify", {
            //     address: deployment.RewardsStaking.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //RewardsHelper
            // await hre.run("verify:verify", {
            //     address: deployment.RewardsHelper.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //StateChannel
            // await hre.run("verify:verify", {
            //     address: deployment.StateChannel.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //PermissionedExchange
            // await hre.run("verify:verify", {
            //     address: deployment.PermissionedExchange.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //ConsumerHost
            // await hre.run("verify:verify", {
            //     address: deployment.ConsumerHost.innerAddress,
            //     constructorArguments: [],
            // });
            //
            // //DisputeManager
            // await hre.run("verify:verify", {
            //     address: deployment.DisputeManager.innerAddress,
            //     constructorArguments: [],
            // });

        } catch (err) {
            console.log(err);
        }
    });

task('publishChild', "verify and publish contracts on etherscan")
    .addParam("deployment", "Deployment file path")
    .addParam('networkpair','')
    .setAction(async (taskArgs, hre) => {
        const deployment = require(taskArgs.deployment);
        const configNetwork = taskArgs.networkpair;

        try {
            // SQToken
            await hre.run("verify:verify", {
                address: deployment.child.ChildERC20.address,
                constructorArguments: [...contractConfig[configNetwork].ChildERC20],
            });


        } catch (err) {
            console.log(err);
        }
    });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

task("compile", async (taskArguments: Object, {run}, runSuper) => {
    // Run the original compile task's logic
    await runSuper({...taskArguments});
    // Sync Proxy ABI
    // await exec('scripts/syncProxyABI.sh');
    // Run Typechain
    // TODO: not an elegant way to call `typechain` cmd
    // await exec('rm -rf ./artifacts/contracts/**/*.dbg.json && rm -rf ./artifacts/contracts/**/**/*.dbg.json');
    // await exec('npx typechain --target ethers-v5 --out-dir src/typechain --input-dir "./artifacts/@maticnetwork/fx-portal" "./artifacts/contracts/**/*.json"');
    // Run the script to generate the typechain
    await exec('scripts/build.sh');
    // Generate ABI
    await exec('ts-node --transpileOnly scripts/abi.ts');
});

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {version: '0.6.6', settings: {}},
            {version: '0.8.15', settings: {}},
        ],
    },
    networks: {
        hardhat: {},
        testnet: {
            url: "https://rpc.ankr.com/polygon_mumbai",
            chainId: 80001,
        },
        goerli: {
            url: "https://rpc.ankr.com/eth_goerli",
            chainId: 5,
        },
        kepler: {
            url: "https://polygon-rpc.com",
            chainId: 137,
        },
        mainnet: {
            url: "https://polygon-rpc.com",
            chainId: 137,
        }
    },
    gasReporter: {
        currency: 'USD',
        gasPrice: 21,
    },
    etherscan: {
        apiKey: {
            testnet: process.env.POLYGONSCAN_API_KEY,
            goerli: process.env.ETHERSCAN_API_KEY,
            kepler: process.env.POLYGONSCAN_API_KEY,
            mainnet: process.env.POLYGONSCAN_API_KEY,
            "mainnet-root": process.env.ETHERSCAN_API_KEY,
        },
    },
    typechain: {
        outDir: 'src/typechain',
        target: 'ethers-v5',
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