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

pub fn settings<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["Settings"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/Settings.sol/Settings.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn sqtoken<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["SQToken"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/SQToken.sol/SQToken.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn vsqtoken<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["VSQToken"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/VSQToken.sol/VSQToken.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn staking<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["Staking"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/Staking.sol/Staking.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn indexer_registry<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["IndexerRegistry"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/IndexerRegistry.sol/IndexerRegistry.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn query_registry<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["QueryRegistry"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/QueryRegistry.sol/QueryRegistry.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn inflation_controller<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["InflationController"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/InflationController.sol/InflationController.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn service_agreement_registry<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["ServiceAgreementRegistry"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/ServiceAgreementRegistry.sol/ServiceAgreementRegistry.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn plan_manager<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["PlanManager"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/PlanManager.sol/PlanManager.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn purchase_offer_market<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["PurchaseOfferMarket"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/PurchaseOfferMarket.sol/PurchaseOfferMarket.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn era_manager<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["EraManager"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/EraManager.sol/EraManager.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn rewards_distributer<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["RewardsDistributer"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/RewardsDistributer.sol/RewardsDistributer.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn rewards_pool<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["RewardsPool"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/RewardsPool.sol/RewardsPool.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn rewards_staking<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["RewardsStaking"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/RewardsStaking.sol/RewardsStaking.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn rewards_helper<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["RewardsHelper"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/RewardsHelper.sol/RewardsHelper.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn proxy_admin<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["ProxyAdmin"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/ProxyAdmin.sol/ProxyAdmin.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn state_channel<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["StateChannel"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/StateChannel.sol/StateChannel.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn airdropper<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["Airdropper"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/Airdropper.sol/Airdropper.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn permissioned_exchange<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["PermissionedExchange"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/PermissionedExchange.sol/PermissionedExchange.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}

pub fn vesting<M: Middleware>(
    client: impl Into<Arc<M>>,
    network: Network,
) -> Result<Contract<M>, ()> {
    let address: Value = serde_json::from_str(network.address()).map_err(|_| ())?;
    let contract_address: Address = address["Vesting"]["address"]
        .as_str()
        .ok_or(())?
        .parse()
        .map_err(|_| ())?;

    let abi_str = serde_json::from_str::<Value>(include_str!(
        "../artifacts/contracts/Vesting.sol/Vesting.json"
    ))
    .map_err(|_| ())?["abi"]
        .to_string();
    let abi: Abi = serde_json::from_str(&abi_str).map_err(|_| ())?;

    Ok(Contract::new(contract_address, abi, client))
}
