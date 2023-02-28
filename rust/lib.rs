use ethers::{abi::Abi, contract::Contract, providers::Middleware, types::Address};
use serde_json::Value;
use std::sync::Arc;

const MAINNET_ADDRESS: &str = include_str!("../publish/mainnet.json");
const KEPLER_ADDRESS: &str = include_str!("../publish/kepler.json");
const TESTNET_ADDRESS: &str = include_str!("../publish/testnet.json");

/// Default network that all services use now.
pub const CURRENT_NETWORK: Network = Network::Testnet;

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
            _ => Network::Testnet,
        }
    }

    /// Get the network config
    pub fn config(&self) -> NetworkConfig {
        match self {
            Network::Mainnet => {
                NetworkConfig {
                    chain_id: 137,
                    chain_name: "Polygon".to_owned(),
                    rpc_urls: vec![
                        "https://polygon.api.onfinality.io/rpc?apikey=e7acc294-c859-48ed-a742-5aadf0a084b9".to_owned(),
                        "https://polygon-rpc.com/".to_owned()
                    ],
                    icon_urls: vec![
                        "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg".to_owned()
                    ],
                    block_explorer_urls: vec![
                        "https://polygonscan.com/".to_owned()
                    ],
                    native_currency: NetworkCurrency {
                        name: "Matic Token".to_owned(),
                        symbol: "MATIC".to_owned(),
                        decimals: 18
                    }
                }
            }
            Network::Kepler => {
                NetworkConfig {
                    chain_id: 137,
                    chain_name: "Polygon".to_owned(),
                    rpc_urls: vec![
                        "https://polygon.api.onfinality.io/rpc?apikey=e7acc294-c859-48ed-a742-5aadf0a084b9".to_owned(),
                        "https://polygon-rpc.com/".to_owned()
                    ],
                    icon_urls: vec![
                        "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg".to_owned()
                    ],
                    block_explorer_urls: vec![
                        "https://polygonscan.com/".to_owned()
                    ],
                    native_currency: NetworkCurrency {
                        name: "Matic Token".to_owned(),
                        symbol: "MATIC".to_owned(),
                        decimals: 18
                    }
                }
            }
            Network::Testnet => {
                NetworkConfig {
                    chain_id: 80001,
                    chain_name: "Mumbai".to_owned(),
                    rpc_urls: vec![
                        "https://polygon-mumbai.api.onfinality.io/rpc?apikey=6b43efc3-a13c-4250-9203-e097fb9f239".to_owned(),
                        "https://rpc.ankr.com/polygon_mumbai".to_owned(),
                        "https://polygon-mumbai.infura.io/v3/4458cf4d1689497b9a38b1d6bbf05e78".to_owned()
                    ],
                    icon_urls: vec![
                        "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg".to_owned()
                    ],
                    block_explorer_urls: vec![
                        "https://mumbai.polygonscan.com/".to_owned()
                    ],
                    native_currency: NetworkCurrency {
                        name: "Matic Token".to_owned(),
                        symbol: "MATIC".to_owned(),
                        decimals: 18
                    }
                }
            }
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

    let abi_str = serde_json::from_str::<Value>(file).map_err(|_| ())?["abi"].to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;
    Ok((abi, contract_address))
}

macro_rules! contract {
    ($func_name:ident,$name:expr,$abi:expr) => {
        paste::item! {
            pub fn [< $func_name _parse >] (network: Network) -> Result<(Abi, Address), ()> {
                contract_parse($name, $abi, network)
            }

            pub fn $func_name<M: Middleware>(
                client: impl Into<Arc<M>>,
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
    include_str!("../artifacts/contracts/Settings.sol/Settings.json")
);

contract!(
    sqtoken,
    "SQToken",
    include_str!("../artifacts/contracts/SQToken.sol/SQToken.json")
);

contract!(
    vsqtoken,
    "VSQToken",
    include_str!("../artifacts/contracts/VSQToken.sol/VSQToken.json")
);

contract!(
    staking,
    "Staking",
    include_str!("../artifacts/contracts/Staking.sol/Staking.json")
);

contract!(
    staking_manager,
    "StakingManager",
    include_str!("../artifacts/contracts/StakingManager.sol/StakingManager.json")
);

contract!(
    indexer_registry,
    "IndexerRegistry",
    include_str!("../artifacts/contracts/IndexerRegistry.sol/IndexerRegistry.json")
);

contract!(
    query_registry,
    "QueryRegistry",
    include_str!("../artifacts/contracts/QueryRegistry.sol/QueryRegistry.json")
);

contract!(
    inflation_controller,
    "InflationController",
    include_str!("../artifacts/contracts/InflationController.sol/InflationController.json")
);

contract!(
    service_agreement_registry,
    "ServiceAgreementRegistry",
    include_str!(
        "../artifacts/contracts/ServiceAgreementRegistry.sol/ServiceAgreementRegistry.json"
    )
);

contract!(
    plan_manager,
    "PlanManager",
    include_str!("../artifacts/contracts/PlanManager.sol/PlanManager.json")
);

contract!(
    purchase_offer_market,
    "PurchaseOfferMarket",
    include_str!("../artifacts/contracts/PurchaseOfferMarket.sol/PurchaseOfferMarket.json")
);

contract!(
    era_manager,
    "EraManager",
    include_str!("../artifacts/contracts/EraManager.sol/EraManager.json")
);

contract!(
    rewards_distributer,
    "RewardsDistributer",
    include_str!("../artifacts/contracts/RewardsDistributer.sol/RewardsDistributer.json")
);

contract!(
    rewards_pool,
    "RewardsPool",
    include_str!("../artifacts/contracts/RewardsPool.sol/RewardsPool.json")
);

contract!(
    rewards_staking,
    "RewardsStaking",
    include_str!("../artifacts/contracts/RewardsStaking.sol/RewardsStaking.json")
);

contract!(
    rewards_helper,
    "RewardsHelper",
    include_str!("../artifacts/contracts/RewardsHelper.sol/RewardsHelper.json")
);

contract!(
    proxy_admin,
    "ProxyAdmin",
    include_str!("../artifacts/contracts/ProxyAdmin.sol/ProxyAdmin.json")
);

contract!(
    state_channel,
    "StateChannel",
    include_str!("../artifacts/contracts/StateChannel.sol/StateChannel.json")
);

contract!(
    airdropper,
    "Airdropper",
    include_str!("../artifacts/contracts/Airdropper.sol/Airdropper.json")
);

contract!(
    permissioned_exchange,
    "PermissionedExchange",
    include_str!("../artifacts/contracts/PermissionedExchange.sol/PermissionedExchange.json")
);

contract!(
    vesting,
    "Vesting",
    include_str!("../artifacts/contracts/Vesting.sol/Vesting.json")
);

contract!(
    consumer_host,
    "ConsumerHost",
    include_str!("../artifacts/contracts/ConsumerHost.sol/ConsumerHost.json")
);

contract!(
    dispute_manager,
    "DisputeManager",
    include_str!("../artifacts/contracts/DisputeManager.sol/DisputeManager.json")
);
