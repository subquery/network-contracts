import { SQToken } from './src/typechain/contracts/root/SQToken';
import * as dotenv from 'dotenv';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import {HardhatUserConfig, task} from 'hardhat/config';
import 'solidity-coverage';
import 'solidity-docgen';
import 'tsconfig-paths/register';
import {constants} from "ethers";
import contractsConfig from "./scripts/config/contracts.config";
import { l1StandardBridge } from "./scripts/L1StandardBridge";

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
        const deployment = require(taskArgs.deployment).root;
        const childDeployment = require(taskArgs.deployment).child;
        const config = contractsConfig[taskArgs.networkpair];

        try {
            console.log(`verify ProxyAdmin`);
            await hre.run("verify:verify", {
                address: deployment.ProxyAdmin.address,
                constructorArguments: [],
            });

            console.log(`verify InflationController`);
            // InflationController
            await hre.run("verify:verify", {
                address: deployment.InflationController.address,
                constructorArguments: [deployment.InflationController.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.InflationController.innerAddress,
                constructorArguments: [],
            });

            console.log(`verify SQToken`);
            // SQToken
            await hre.run("verify:verify", {
                address: deployment.SQToken.address,
                constructorArguments: [constants.AddressZero, ...config.SQToken],
            });

            //Vesting
            console.log(`verify Vesting`);
            await hre.run("verify:verify", {
                address: deployment.Vesting.address,
                constructorArguments: [deployment.SQToken.address],
            });
            //VTSQToken
            console.log(`verify VTSQToken`);
            await hre.run("verify:verify", {
                address: deployment.VTSQToken.address,
                contract: 'contracts/root/VTSQToken.sol:VTSQToken',
                constructorArguments: [constants.AddressZero],
            });
            //Settings
            console.log(`verify Settings`);
            await hre.run("verify:verify", {
                address: deployment.Settings.address,
                constructorArguments: [deployment.Settings.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.Settings.innerAddress,
                constructorArguments: [],
            });

            // OpDestination
            console.log(`verify OpDestination`);
            let l2bridge = l1StandardBridge[taskArgs.networkpair].address;
            await hre.run("verify:verify", {
                address: deployment.OpDestination.address,
                // TODO: better inject `L1TokenBridge` into the deployment
                constructorArguments: [deployment.SQToken.address, childDeployment.SQToken, l2bridge],
            });

        } catch (err) {
            console.log(err);
        }
    });

task('publishChild', "verify and publish contracts on etherscan")
    .addParam("deployment", "Deployment file path")
    .addParam('networkpair','')
    .setAction(async (taskArgs, hre) => {
        const deployment = require(taskArgs.deployment).child;

        try {
            await hre.run("verify:verify", {
                address: deployment.ProxyAdmin.address,
                constructorArguments: [],
            });
            //Settings
            await hre.run("verify:verify", {
                address: deployment.Settings.address,
                constructorArguments: [deployment.Settings.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.Settings.innerAddress,
                constructorArguments: [],
            });
            await hre.run("verify:verify", {
                address: deployment.L2SQToken.address,
                constructorArguments: contractsConfig[taskArgs.networkpair].L2SQToken,
                // contract: "contracts/l2/L2SQToken.sol:L2SQToken"
            });

            //VSQToken
            await hre.run("verify:verify", {
                address: deployment.VSQToken.address,
                constructorArguments: [deployment.VSQToken.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.VSQToken.innerAddress,
                constructorArguments: [],
            });

            //Staking
            await hre.run("verify:verify", {
                address: deployment.Staking.address,
                constructorArguments: [deployment.Staking.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.Staking.innerAddress,
                constructorArguments: [],
            });

            //StakingManager
            await hre.run("verify:verify", {
                address: deployment.StakingManager.address,
                constructorArguments: [deployment.StakingManager.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.StakingManager.innerAddress,
                constructorArguments: [],
            });

            //EraManager
            await hre.run("verify:verify", {
                address: deployment.EraManager.address,
                constructorArguments: [deployment.EraManager.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.EraManager.innerAddress,
                constructorArguments: [],
            });

            //IndexerRegistry
            await hre.run("verify:verify", {
                address: deployment.IndexerRegistry.address,
                constructorArguments: [deployment.IndexerRegistry.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.IndexerRegistry.innerAddress,
                constructorArguments: [],
            });

            //ProjectRegistry
            await hre.run("verify:verify", {
                address: deployment.ProjectRegistry.address,
                constructorArguments: [deployment.ProjectRegistry.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.ProjectRegistry.innerAddress,
                constructorArguments: [],
            });

            //PlanManager
            await hre.run("verify:verify", {
                address: deployment.PlanManager.address,
                constructorArguments: [deployment.PlanManager.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.PlanManager.innerAddress,
                constructorArguments: [],
            });

            //PurchaseOfferMarket
            await hre.run("verify:verify", {
                address: deployment.PurchaseOfferMarket.address,
                constructorArguments: [deployment.PurchaseOfferMarket.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.PurchaseOfferMarket.innerAddress,
                constructorArguments: [],
            });

            //ServiceAgreementRegistry
            await hre.run("verify:verify", {
                address: deployment.ServiceAgreementRegistry.address,
                constructorArguments: [deployment.ServiceAgreementRegistry.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.ServiceAgreementRegistry.innerAddress,
                constructorArguments: [],
            });

            //RewardsDistributor
            await hre.run("verify:verify", {
                address: deployment.RewardsDistributor.address,
                constructorArguments: [deployment.RewardsDistributor.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.RewardsDistributor.innerAddress,
                constructorArguments: [],
            });

            //RewardsPool
            await hre.run("verify:verify", {
                address: deployment.RewardsPool.address,
                constructorArguments: [deployment.RewardsPool.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.RewardsPool.innerAddress,
                constructorArguments: [],
            });

            //RewardsStaking
            await hre.run("verify:verify", {
                address: deployment.RewardsStaking.address,
                constructorArguments: [deployment.RewardsStaking.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.RewardsStaking.innerAddress,
                constructorArguments: [],
            });

            //RewardsHelper
            await hre.run("verify:verify", {
                address: deployment.RewardsHelper.address,
                constructorArguments: [deployment.RewardsHelper.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.RewardsHelper.innerAddress,
                constructorArguments: [],
            });

            //StateChannel
            await hre.run("verify:verify", {
                address: deployment.StateChannel.address,
                constructorArguments: [deployment.StateChannel.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.StateChannel.innerAddress,
                constructorArguments: [],
            });
            //ConsumerHost
            await hre.run("verify:verify", {
                address: deployment.ConsumerHost.address,
                constructorArguments: [deployment.ConsumerHost.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.ConsumerHost.innerAddress,
                constructorArguments: [],
            });

            //DisputeManager
            await hre.run("verify:verify", {
                address: deployment.DisputeManager.address,
                constructorArguments: [deployment.DisputeManager.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.DisputeManager.innerAddress,
                constructorArguments: [],
            });

            //ConsumerRegistry
            await hre.run("verify:verify", {
                address: deployment.ConsumerRegistry.address,
                constructorArguments: [deployment.ConsumerRegistry.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.ConsumerRegistry.innerAddress,
                constructorArguments: [],
            });

            //PriceOracle
            await hre.run("verify:verify", {
                address: deployment.PriceOracle.address,
                constructorArguments: [deployment.PriceOracle.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.PriceOracle.innerAddress,
                constructorArguments: [],
            });
            //TokenExchange
            await hre.run("verify:verify", {
                address: deployment.TokenExchange.address,
                constructorArguments: [],
            });
            //SQTGift
            await hre.run("verify:verify", {
                address: deployment.SQTGift.address,
                constructorArguments: [deployment.SQTGift.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.SQTGift.innerAddress,
                constructorArguments: [],
            });
            //RedeemGift
            await hre.run("verify:verify", {
                address: deployment.SQTRedeem.address,
                constructorArguments: [deployment.SQTRedeem.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.SQTRedeem.innerAddress,
                constructorArguments: [],
            });
            //RewardsBooster
            await hre.run("verify:verify", {
                address: deployment.RewardsBooster.address,
                constructorArguments: [deployment.RewardsBooster.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.RewardsBooster.innerAddress,
                constructorArguments: [],
            });
            //StakingAllocation
            await hre.run("verify:verify", {
                address: deployment.StakingAllocation.address,
                constructorArguments: [deployment.StakingAllocation.innerAddress, deployment.ProxyAdmin.address, []],
            });
            await hre.run("verify:verify", {
                address: deployment.StakingAllocation.innerAddress,
                constructorArguments: [],
            });

        } catch (err) {
            console.log(err);
        }
    });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {version: '0.8.15', settings: {
                optimizer: {
                    enabled: true,
                },
            }},
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
        sepolia: {
            url: "https://rpc.sepolia.org",
            chainId: 11155111,
        },
        'base-sepolia': {
            url: "https://sepolia.base.org",
            chainId: 84532,
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
            polygonMumbai: process.env.POLYGONSCAN_API_KEY,
            goerli: process.env.ETHERSCAN_API_KEY,
            sepolia: process.env.ETHERSCAN_API_KEY,
            'base-sepolia': process.env.BASESCAN_API_KEY,
            polygon: process.env.POLYGONSCAN_API_KEY,
        },
        customChains: [
            {
                network: "base-sepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org"
                }
            }
        ]
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