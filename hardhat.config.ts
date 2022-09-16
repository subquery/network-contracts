import * as dotenv from 'dotenv';

import {HardhatUserConfig, task} from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import 'tsconfig-paths/register';
import 'hardhat-contract-sizer';
import 'solidity-docgen';
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

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
    solidity: '0.8.15',
    gasReporter: {
        currency: 'USD',
        gasPrice: 21,
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    typechain: {
        outDir: 'src/typechain',
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
    },
};

export default config;
