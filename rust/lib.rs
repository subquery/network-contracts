use ethers::{abi::Abi, contract::Contract, providers::Middleware, types::Address};
use serde_json::Value;
use std::sync::Arc;

const MAINNET_ADDRESS: &str = include_str!("../publish/mainnet.json");
const KEPLER_ADDRESS: &str = include_str!("../publish/kepler.json");
const TESTNET_ADDRESS: &str = include_str!("../publish/testnet.json");

/// Default network that all services use now.
pub const CURRENT_NETWORK: Network = Network::Kepler;

const CHAIN_ICON_URL: &str = "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg";
const CHAIN_TOKEN_NAME: &str = "Matic Token";
const CHAIN_TOKEN_SYMBOL: &str = "MATIC";
const CHAIN_TOKEN_DECIMALS: i32 = 18;

const BLOCK_EXPLORER_MAINNET: &str = "";
const BLOCK_EXPLORER_KEPLER: &str = "https://polygonscan.com";
const BLOCK_EXPLORER_TESTNET: &str = "https://mumbai.polygonscan.com";

const CHAIN_ID_MAINNET: i32 = 137;
const CHAIN_ID_KEPLER: i32 = 137;
const CHAIN_ID_TESTNET: i32 = 80001;
const CHAIN_NAME_MAINNET: &str = "";
const CHAIN_NAME_KEPLER: &str = "Polygon";
const CHAIN_NAME_TESTNET: &str = "Polygon Mumbai";

const RPC_MAINNET1: &str = "";
const RPC_MAINNET2: &str = "";
const RPC_KEPLER1: &str = "https://polygon-rpc.com";
const RPC_KEPLER2: &str = "https://polygon.api.onfinality.io/rpc";
const RPC_TESTNET1: &str = "https://rpc.ankr.com/polygon_mumbai";
const RPC_TESTNET2: &str = "https://polygon-mumbai.api.onfinality.io/rpc";

const IPFS_MAINNET: &str = "";
const IPFS_KEPLER: &str = "https://unauthipfs.subquery.network/ipfs/api/v0";
const IPFS_TESTNET: &str = "https://unauthipfs.subquery.network/ipfs/api/v0";

const SUBQL_MAINNET: &str = "";
const SUBQL_KEPLER: &str = "https://api.subquery.network/sq/subquery/kepler-network";
const SUBQL_TESTNET: &str = "https://api.subquery.network/sq/subquery/kepler-testnet";

const EXPLORER_MAINNET: &str = "";
const EXPLORER_KEPLER: &str = "https://kepler.subquery.network";
const EXPLORER_TESTNET: &str = "https://kepler.thechaindata.com";

/// Network types
#[derive(Hash, Eq, PartialEq, Copy, Clone, Debug)]
pub enum Network {
    Mainnet,
    Kepler,
    Testnet,
}

/// Network native currency config
pub struct NetworkCurrency {
    /// Currency name
    pub name: String,
    /// Currency symbol
    pub symbol: String,
    /// Currency decimals
    pub decimals: i32,
}

/// Network config informato, use EIP-3085
pub struct NetworkConfig {
    /// Chain id
    pub chain_id: i32,
    /// Chain name
    pub chain_name: String,
    /// List of endpoints
    pub rpc_urls: Vec<String>,
    /// list of block explorer urls
    pub block_explorer_urls: Vec<String>,
    /// List of chain icon urls
    pub icon_urls: Vec<String>,
    /// Native currency config
    pub native_currency: NetworkCurrency,
    /// Subql network graphql endpoints
    pub subql_urls: Vec<String>,
    /// IPFS endpoints
    pub ipfs_urls: Vec<String>,
    /// Explorer endpoints
    pub explorer_urls: Vec<String>,
}

impl Network {
    fn address(&self) -> &str {
        match self {
            Network::Mainnet => MAINNET_ADDRESS,
            Network::Kepler => KEPLER_ADDRESS,
            Network::Testnet => TESTNET_ADDRESS,
        }
    }

    /// Get the network from lower-case string
    pub fn from_str(s: &str) -> Self {
        match s {
            "mainnet" => Network::Mainnet,
            "kepler" => Network::Kepler,
            "testnet" => Network::Testnet,
            _ => CURRENT_NETWORK,
        }
    }

    /// Get the network config
    pub fn config(&self) -> NetworkConfig {
        match self {
            Network::Mainnet => NetworkConfig {
                chain_id: CHAIN_ID_MAINNET,
                chain_name: CHAIN_NAME_MAINNET.to_owned(),
                rpc_urls: vec![RPC_MAINNET1.to_owned(), RPC_MAINNET2.to_owned()],
                icon_urls: vec![CHAIN_ICON_URL.to_owned()],
                block_explorer_urls: vec![BLOCK_EXPLORER_MAINNET.to_owned()],
                native_currency: NetworkCurrency {
                    name: CHAIN_TOKEN_NAME.to_owned(),
                    symbol: CHAIN_TOKEN_SYMBOL.to_owned(),
                    decimals: CHAIN_TOKEN_DECIMALS.to_owned(),
                },
                subql_urls: vec![SUBQL_MAINNET.to_owned()],
                ipfs_urls: vec![IPFS_MAINNET.to_owned()],
                explorer_urls: vec![EXPLORER_MAINNET.to_owned()],
            },
            Network::Kepler => NetworkConfig {
                chain_id: CHAIN_ID_KEPLER,
                chain_name: CHAIN_NAME_KEPLER.to_owned(),
                rpc_urls: vec![RPC_KEPLER1.to_owned(), RPC_KEPLER2.to_owned()],
                icon_urls: vec![CHAIN_ICON_URL.to_owned()],
                block_explorer_urls: vec![BLOCK_EXPLORER_KEPLER.to_owned()],
                native_currency: NetworkCurrency {
                    name: CHAIN_TOKEN_NAME.to_owned(),
                    symbol: CHAIN_TOKEN_SYMBOL.to_owned(),
                    decimals: CHAIN_TOKEN_DECIMALS.to_owned(),
                },
                subql_urls: vec![SUBQL_KEPLER.to_owned()],
                ipfs_urls: vec![IPFS_KEPLER.to_owned()],
                explorer_urls: vec![EXPLORER_KEPLER.to_owned()],
            },
            Network::Testnet => NetworkConfig {
                chain_id: CHAIN_ID_TESTNET,
                chain_name: CHAIN_NAME_TESTNET.to_owned(),
                rpc_urls: vec![RPC_TESTNET1.to_owned(), RPC_TESTNET2.to_owned()],
                icon_urls: vec![CHAIN_ICON_URL.to_owned()],
                block_explorer_urls: vec![BLOCK_EXPLORER_TESTNET.to_owned()],
                native_currency: NetworkCurrency {
                    name: CHAIN_TOKEN_NAME.to_owned(),
                    symbol: CHAIN_TOKEN_SYMBOL.to_owned(),
                    decimals: CHAIN_TOKEN_DECIMALS.to_owned(),
                },
                subql_urls: vec![SUBQL_TESTNET.to_owned()],
                ipfs_urls: vec![IPFS_TESTNET.to_owned()],
                explorer_urls: vec![EXPLORER_TESTNET.to_owned()],
            },
        }
    }
}

#[inline]
fn contract_parse(name: &str, file: &str, network: Network) -> Result<(Abi, Address), ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address[name]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi: Abi = serde_json::from_str(file).map_err(|_| ())?;
    Ok((abi, contract_address))
}

macro_rules! contract {
    ($func_name:ident,$name:expr,$abi:expr) => {
        paste::item! {
            pub fn [< $func_name _parse >] (network: Network) -> Result<(Abi, Address), ()> {
                contract_parse($name, $abi, network)
            }

            pub fn $func_name<M: Middleware>(
                client: Arc<M>,
                network: Network,
            ) -> Result<Contract<M>, ()> {
                let (abi, contract) = [< $func_name _parse >](network)?;
                Ok(Contract::new(contract, abi, client))
            }
        }
    };
}

contract!(
    settings,
    "Settings",
    include_str!("../publish/ABI/Settings.json")
);

contract!(
    sqtoken,
    "SQToken",
    include_str!("../publish/ABI/SQToken.json")
);

contract!(
    vsqtoken,
    "VSQToken",
    include_str!("../publish/ABI/VSQToken.json")
);

contract!(
    staking,
    "Staking",
    include_str!("../publish/ABI/Staking.json")
);

contract!(
    staking_manager,
    "StakingManager",
    include_str!("../publish/ABI/StakingManager.json")
);

contract!(
    indexer_registry,
    "IndexerRegistry",
    include_str!("../publish/ABI/IndexerRegistry.json")
);

contract!(
    query_registry,
    "QueryRegistry",
    include_str!("../publish/ABI/QueryRegistry.json")
);

contract!(
    inflation_controller,
    "InflationController",
    include_str!("../publish/ABI/InflationController.json")
);

contract!(
    service_agreement_registry,
    "ServiceAgreementRegistry",
    include_str!("../publish/ABI/ServiceAgreementRegistry.json")
);

contract!(
    plan_manager,
    "PlanManager",
    include_str!("../publish/ABI/PlanManager.json")
);

contract!(
    purchase_offer_market,
    "PurchaseOfferMarket",
    include_str!("../publish/ABI/PurchaseOfferMarket.json")
);

contract!(
    era_manager,
    "EraManager",
    include_str!("../publish/ABI/EraManager.json")
);

contract!(
    rewards_distributer,
    "RewardsDistributer",
    include_str!("../publish/ABI/RewardsDistributer.json")
);

contract!(
    rewards_pool,
    "RewardsPool",
    include_str!("../publish/ABI/RewardsPool.json")
);

contract!(
    rewards_staking,
    "RewardsStaking",
    include_str!("../publish/ABI/RewardsStaking.json")
);

contract!(
    rewards_helper,
    "RewardsHelper",
    include_str!("../publish/ABI/RewardsHelper.json")
);

contract!(
    proxy_admin,
    "ProxyAdmin",
    include_str!("../publish/ABI/ProxyAdmin.json")
);

contract!(
    state_channel,
    "StateChannel",
    include_str!("../publish/ABI/StateChannel.json")
);

contract!(
    airdropper,
    "Airdropper",
    include_str!("../publish/ABI/Airdropper.json")
);

contract!(
    permissioned_exchange,
    "PermissionedExchange",
    include_str!("../publish/ABI/PermissionedExchange.json")
);

contract!(
    vesting,
    "Vesting",
    include_str!("../publish/ABI/Vesting.json")
);

contract!(
    consumer_host,
    "ConsumerHost",
    include_str!("../publish/ABI/ConsumerHost.json")
);

contract!(
    dispute_manager,
    "DisputeManager",
    include_str!("../publish/ABI/DisputeManager.json")
);

contract!(
    consumer_registry,
    "ConsumerRegistry",
    include_str!("../publish/ABI/ConsumerRegistry.json")
);
