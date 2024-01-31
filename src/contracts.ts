// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import Airdropper from './artifacts/contracts/Airdropper.sol/Airdropper.json';
import ConsumerHost from './artifacts/contracts/ConsumerHost.sol/ConsumerHost.json';
import ConsumerRegistry from './artifacts/contracts/ConsumerRegistry.sol/ConsumerRegistry.json';
import DisputeManager from './artifacts/contracts/DisputeManager.sol/DisputeManager.json';
import EraManager from './artifacts/contracts/l2/EraManager.sol/EraManager.json';
import IndexerRegistry from './artifacts/contracts/IndexerRegistry.sol/IndexerRegistry.json';
import InflationController from './artifacts/contracts/root/InflationController.sol/InflationController.json';
import PermissionedExchange from './artifacts/contracts/PermissionedExchange.sol/PermissionedExchange.json';
import TokenExchange from './artifacts/contracts/TokenExchange.sol/TokenExchange.json';
import PlanManager from './artifacts/contracts/PlanManager.sol/PlanManager.json';
import PriceOracle from './artifacts/contracts/PriceOracle.sol/PriceOracle.json';
import ProjectRegistry from './artifacts/contracts/ProjectRegistry.sol/ProjectRegistry.json';
import ProxyAdmin from './artifacts/@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol/ProxyAdmin.json';
import PurchaseOfferMarket from './artifacts/contracts/PurchaseOfferMarket.sol/PurchaseOfferMarket.json';
import RewardsDistributor from './artifacts/contracts/RewardsDistributor.sol/RewardsDistributor.json';
import RewardsHelper from './artifacts/contracts/RewardsHelper.sol/RewardsHelper.json';
import RewardsPool from './artifacts/contracts/RewardsPool.sol/RewardsPool.json';
import RewardsStaking from './artifacts/contracts/RewardsStaking.sol/RewardsStaking.json';
import RewardsBooster from './artifacts/contracts/RewardsBooster.sol/RewardsBooster.json';
import SQToken from './artifacts/contracts/root/SQToken.sol/SQToken.json';
import ServiceAgreementRegistry from './artifacts/contracts/ServiceAgreementRegistry.sol/ServiceAgreementRegistry.json';
import Settings from './artifacts/contracts/Settings.sol/Settings.json';
import Staking from './artifacts/contracts/Staking.sol/Staking.json';
import StakingManager from './artifacts/contracts/StakingManager.sol/StakingManager.json';
import StakingAllocation from './artifacts/contracts/StakingAllocation.sol/StakingAllocation.json';
import StateChannel from './artifacts/contracts/StateChannel.sol/StateChannel.json';
import VSQToken from './artifacts/contracts/VSQToken.sol/VSQToken.json';
import Vesting from './artifacts/contracts/root/Vesting.sol/Vesting.json';
import VTSQToken from './artifacts/contracts/root/VTSQToken.sol/VTSQToken.json';
import OpDestination from './artifacts/contracts/root/OpDestination.sol/OpDestination.json';
import SQTGift from './artifacts/contracts/SQTGift.sol/SQTGift.json';
import SQTRedeem from './artifacts/contracts/SQTRedeem.sol/SQTRedeem.json';
import L2SQToken from './artifacts/contracts/l2/L2SQToken.sol/L2SQToken.json';

export default {
    Settings,
    SQToken,
    VSQToken,
    Staking,
    StakingManager,
    StakingAllocation,
    IndexerRegistry,
    ProjectRegistry,
    InflationController,
    ServiceAgreementRegistry,
    PlanManager,
    PurchaseOfferMarket,
    EraManager,
    RewardsDistributor,
    RewardsPool,
    RewardsStaking,
    RewardsHelper,
    RewardsBooster,
    ProxyAdmin,
    StateChannel,
    Airdropper,
    PermissionedExchange,
    TokenExchange,
    Vesting,
    VTSQToken,
    ConsumerHost,
    DisputeManager,
    PriceOracle,
    ConsumerRegistry,
    OpDestination,
    SQTGift,
    SQTRedeem,
    L2SQToken,
};
