// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {NetworkPair, SubqueryNetwork} from './types';

export const CURRENT_NETWORK = 'testnet';

export const networks: { [key in SubqueryNetwork]: NetworkPair } = {
    mainnet: {
        root: {
            chainId: '0x1',
            chainName: 'Ethereum Mainnet',
            rpcUrls: [
                'https://ethereum.publicnode.com'
            ],
            iconUrls: [],
            blockExplorerUrls: ['https://etherscan.io'],
            nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
            }
        },
        child: {
            chainId: '0x89',
            chainName: 'Polygon',
            rpcUrls: [
                'https://polygon-rpc.com/'
            ],
            iconUrls: [
                'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg'
            ],
            blockExplorerUrls: ['https://polygonscan.com/'],
            nativeCurrency: {
                name: 'Matic Token',
                symbol: 'MATIC',
                decimals: 18
            }
        }
    },
    testnet: {
        root: {
            chainId: '0x5',
            chainName: 'Goerli',
            rpcUrls: [
                'https://ethereum-goerli.publicnode.com',
                'https://rpc.ankr.com/eth_goerli'
            ],
            iconUrls: [],
            blockExplorerUrls: ['https://goerli.etherscan.io'],
            nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
            }
        },
        child: {
            chainId: '0x13881',
            chainName: 'Mumbai',
            rpcUrls: [
                'https://rpc-mumbai.maticvigil.com',
                'https://rpc.ankr.com/polygon_mumbai',
            ],
            iconUrls: [
                'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg'
            ],
            blockExplorerUrls: ['https://mumbai.polygonscan.com/'],
            nativeCurrency: {
                name: 'Matic Token',
                symbol: 'MATIC',
                decimals: 18
            }
        }
    },
    local: {
        root: {
            chainId: '0x7A69',
            chainName: 'Hardhat',
            rpcUrls: [
                'http://127.0.0.1:8545'
            ],
            iconUrls: [],
            blockExplorerUrls: [''],
            nativeCurrency: {
                name: '',
                symbol: '',
                decimals: 18
            }
        },
        child: {
            chainId: '0x7A69',
            chainName: 'Hardhat',
            rpcUrls: [
                'http://127.0.0.1:8545'
            ],
            iconUrls: [],
            blockExplorerUrls: [''],
            nativeCurrency: {
                name: '',
                symbol: '',
                decimals: 18
            }
        }
    }
}
