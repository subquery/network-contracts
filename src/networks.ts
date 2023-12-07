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
                'https://rpc.ankr.com/polygon_mumbai',
                'https://polygon-mumbai.api.onfinality.io/rpc?apikey=6b43efc3-a13c-4250-9203-e097fb9f239',
                'https://polygon-mumbai.infura.io/v3/4458cf4d1689497b9a38b1d6bbf05e78'
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
    // 'goerli': {
    //     chainId: '0x5',
    //     chainName: 'Goerli',
    //     rpcUrls: [
    //         'https://rpc.ankr.com/eth_goerli'
    //     ],
    //     iconUrls: [],
    //     blockExplorerUrls: ['https://goerli.etherscan.io'],
    //     nativeCurrency: {
    //         name: 'ETH',
    //         symbol: 'ETH',
    //         decimals: 18
    //     }
    // },
    // local: {
    //     chainId: '0x7A69',
    //     chainName: 'Hardhat',
    //     rpcUrls: [
    //         'http://127.0.0.1:8545'
    //     ],
    //     iconUrls: [],
    //     blockExplorerUrls: [''],
    //     nativeCurrency: {
    //       name: '',
    //       symbol: '',
    //       decimals: 18
    //     }
    // }
}
