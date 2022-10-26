use ethers::{abi::Abi, contract::Contract, providers::Middleware, types::Address};
use serde_json::Value;
use std::sync::Arc;

const TESTNET_ADDRESS: &str = include_str!("../publish/testnet.json");
const MOONBASE_ADDRESS: &str = include_str!("../publish/moonbase.json");

#[derive(Hash, Eq, PartialEq, Copy, Clone, Debug)]
pub enum Network {
    Testnet,
    Moonbase,
    Mainnet,
}

impl Network {
    fn address(&self) -> &str {
        match self {
            Network::Testnet => TESTNET_ADDRESS,
            Network::Moonbase => MOONBASE_ADDRESS,
            Network::Mainnet => TESTNET_ADDRESS,
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
