import { Network, SubqueryNetwork } from './types';

export const CURRENT_NETWORK = 'testnet';

export const networks: { [key in SubqueryNetwork]: Network } = {
    mainnet:{
        chainId: '0x89',
        chainName: 'Polygon',
        rpcUrls: [
            'https://polygon.api.onfinality.io/rpc?apikey=e7acc294-c859-48ed-a742-5aadf0a084b9',
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
    },
    kepler: {
        chainId: '0x89',
        chainName: 'Polygon',
        rpcUrls: [
            'https://polygon.api.onfinality.io/rpc?apikey=e7acc294-c859-48ed-a742-5aadf0a084b9',
            'https://polygon-rpc.com'
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
    },
    testnet: {
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
    },
    local: {
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