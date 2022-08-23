use serde_json::Value;
use web3::{api::Eth, contract::Contract, transports::Http};

const ADDRESS: &str = include_str!("../publish/testnet.json");

#[derive(Hash, Eq, PartialEq)]
pub enum Network {
    Testnet,
    Mainnet,
}

pub fn settings(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/Settings.sol/Settings.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["Settings"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn sqtoken(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/SQToken.sol/SQToken.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["SQToken"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn vsqtoken(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/VSQToken.sol/VSQToken.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["VSQToken"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn staking(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/Staking.sol/Staking.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["Staking"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn indexer_registry(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/IndexerRegistry.sol/IndexerRegistry.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["IndexerRegistry"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn query_registry(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/QueryRegistry.sol/QueryRegistry.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["QueryRegistry"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn inflation_controller(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/InflationController.sol/InflationController.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["InflationController"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn service_agreement_registry(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/ServiceAgreementRegistry.sol/ServiceAgreementRegistry.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["ServiceAgreementRegistry"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn plan_manager(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/PlanManager.sol/PlanManager.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["PlanManager"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn purchase_offer_market(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/PurchaseOfferMarket.sol/PurchaseOfferMarket.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["PurchaseOfferMarket"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn era_manager(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/EraManager.sol/EraManager.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["EraManager"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn rewards_distributer(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/RewardsDistributer.sol/RewardsDistributer.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["RewardsDistributer"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn rewards_pool(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/RewardsPool.sol/RewardsPool.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["RewardsPool"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn rewards_helper(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/RewardsHelper.sol/RewardsHelper.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["RewardsHelper"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn proxy_admin(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/ProxyAdmin.sol/ProxyAdmin.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["ProxyAdmin"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn state_channel(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/StateChannel.sol/StateChannel.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["StateChannel"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn airdropper(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/Airdropper.sol/Airdropper.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["Airdropper"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn permissioned_exchange(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/PermissionedExchange.sol/PermissionedExchange.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["PermissionedExchange"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}

pub fn vesting(eth: Eth<Http>, _network: Network) -> Result<Contract<Http>, ()> {
    let address: Value = serde_json::from_str(ADDRESS).map_err(|_| ())?;
    let abi = serde_json::to_vec(
        &serde_json::from_str::<Value>(include_str!(
            "../artifacts/contracts/Vesting.sol/Vesting.json"
        ))
        .map_err(|_| ())?["abi"],
    )
    .map_err(|_| ())?;
    Contract::from_json(
        eth,
        address["Vesting"]["address"]
            .as_str()
            .ok_or(())?
            .parse()
            .map_err(|_| ())?,
        &abi,
    )
    .map_err(|_| ())
}
