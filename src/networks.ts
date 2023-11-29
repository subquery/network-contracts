import { Network, SubqueryNetwork } from './types';

type PlatformNetwork = 'ethereum' | 'ethereum-goerli' | 'polygon' | 'mumbai' | 'base-goerli' | 'local';

export const CURRENT_NETWORK = 'testnet';

export const networks: { [key in PlatformNetwork]: Network } = {
  ethereum: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    rpcUrls: [
      'https://cloudflare-eth.com/'
    ],
    iconUrls: [],
    blockExplorerUrls: ['https://etherscan.io/'],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  'ethereum-goerli': {
    chainId: '0x5',
    chainName: 'Goerli Ethereum',
    rpcUrls: [
      'https://rpc.goerli.mudit.blog/'
    ],
    iconUrls: [],
    blockExplorerUrls: ['https://goerli.etherscan.io/'],
    nativeCurrency: {
      name: 'Goerli Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  polygon: {
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
  },
  mumbai: {
    chainId: '0x13881',
    chainName: 'Mumbai',
    rpcUrls: [
      'https://rpc.ankr.com/polygon_mumbai',
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
  'base-goerli': {
    chainId: '0x14a33',
    chainName: 'Base Goerli',
    rpcUrls: [
      'https://base-goerli.publicnode.com\t'
    ],
    iconUrls: [],
    blockExplorerUrls: ['https://goerli.basescan.org/'],
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
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