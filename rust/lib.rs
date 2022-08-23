use serde_json::Value;
use web3::{api::Eth, contract::Contract, transports::Http};

const ADDRESS: &str = include_str!("../publish/testnet.json");

#[derive(Hash, Eq, PartialEq)]
pub enum Network {
    Testnet,
    Mainnet,
}

pub fn settings(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/Settings.sol/Settings.json");
    Contract::from_json(
        eth,
        address["Settings"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn sqtoken(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/SQToken.sol/SQToken.json");
    Contract::from_json(
        eth,
        address["SQToken"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn vsqtoken(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/VSQToken.sol/VSQToken.json");
    Contract::from_json(
        eth,
        address["VSQToken"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn staking(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/Staking.sol/Staking.json");
    Contract::from_json(
        eth,
        address["Staking"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn indexer_registry(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/IndexerRegistry.sol/IndexerRegistry.json");
    Contract::from_json(
        eth,
        address["IndexerRegistry"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn query_registry(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/QueryRegistry.sol/QueryRegistry.json");
    Contract::from_json(
        eth,
        address["QueryRegistry"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn inflation_controller(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi =
        include_bytes!("../artifacts/contracts/InflationController.sol/InflationController.json");
    Contract::from_json(
        eth,
        address["InflationController"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn service_agreement_registry(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!(
        "../artifacts/contracts/ServiceAgreementRegistry.sol/ServiceAgreementRegistry.json"
    );
    Contract::from_json(
        eth,
        address["ServiceAgreementRegistry"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn plan_manager(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/PlanManager.sol/PlanManager.json");
    Contract::from_json(
        eth,
        address["PlanManager"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn purchase_offer_market(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi =
        include_bytes!("../artifacts/contracts/PurchaseOfferMarket.sol/PurchaseOfferMarket.json");
    Contract::from_json(
        eth,
        address["PurchaseOfferMarket"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn era_manager(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/EraManager.sol/EraManager.json");
    Contract::from_json(
        eth,
        address["EraManager"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn rewards_distributer(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi =
        include_bytes!("../artifacts/contracts/RewardsDistributer.sol/RewardsDistributer.json");
    Contract::from_json(
        eth,
        address["RewardsDistributer"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn rewards_pool(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/RewardsPool.sol/RewardsPool.json");
    Contract::from_json(
        eth,
        address["RewardsPool"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn rewards_helper(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/RewardsHelper.sol/RewardsHelper.json");
    Contract::from_json(
        eth,
        address["RewardsHelper"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn proxy_admin(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/ProxyAdmin.sol/ProxyAdmin.json");
    Contract::from_json(
        eth,
        address["ProxyAdmin"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn state_channel(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/StateChannel.sol/StateChannel.json");
    Contract::from_json(
        eth,
        address["StateChannel"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn airdropper(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/Airdropper.sol/Airdropper.json");
    Contract::from_json(
        eth,
        address["Airdropper"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn permissioned_exchange(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi =
        include_bytes!("../artifacts/contracts/PermissionedExchange.sol/PermissionedExchange.json");
    Contract::from_json(
        eth,
        address["PermissionedExchange"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}

pub fn vesting(eth: Eth<Http>, _network: Network) -> Contract<Http> {
    let address: Value = serde_json::from_str(ADDRESS).unwrap();
    let abi = include_bytes!("../artifacts/contracts/Vesting.sol/Vesting.json");
    Contract::from_json(
        eth,
        address["Vesting"]["address"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap(),
        abi,
    )
    .unwrap()
}
