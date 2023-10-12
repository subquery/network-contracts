// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface ISettings {
    function setProjectAddresses(
        address _indexerRegistry,
        address _projectRegistry,
        address _eraManager,
        address _planManager,
        address _serviceAgreementRegistry,
        address _serviceAgreementExtra,
        address _disputeManager,
        address _stateChannel,
        address _consumerRegistry
    ) external;

    function setTokenAddresses(
        address _sqToken,
        address _staking,
        address _stakingManager,
        address _rewardsDistributer,
        address _rewardsPool,
        address _rewardsStaking,
        address _rewardsHelper,
        address _inflationController,
        address _vesting,
        address _permissionedExchange,
        address _priceOracle
    ) external;

    function setSQToken(address _sqToken) external;

    function getSQToken() external view returns (address);

    function setStaking(address _staking) external;

    function getStaking() external view returns (address);

    function setStakingManager(address _stakingManager) external;

    function getStakingManager() external view returns (address);

    function setIndexerRegistry(address _indexerRegistry) external;

    function getIndexerRegistry() external view returns (address);

    function setProjectRegistry(address _projectRegistry) external;

    function getProjectRegistry() external view returns (address);

    function setEraManager(address _eraManager) external;

    function getEraManager() external view returns (address);

    function setPlanManager(address _planManager) external;

    function getPlanManager() external view returns (address);

    function setServiceAgreementRegistry(address _serviceAgreementRegistry) external;

    function setServiceAgreementExtra(address _serviceAgreementExtra) external;

    function getServiceAgreementRegistry() external view returns (address);

    function getServiceAgreementExtra() external view returns (address);

    function setRewardsDistributer(address _rewardsDistributer) external;

    function getRewardsDistributer() external view returns (address);

    function setRewardsPool(address _rewardsPool) external;

    function getRewardsPool() external view returns (address);

    function setRewardsStaking(address _rewardsStaking) external;

    function getRewardsStaking() external view returns (address);

    function setRewardsHelper(address _rewardsHelper) external;

    function getRewardsHelper() external view returns (address);

    function setInflationController(address _inflationController) external;

    function getInflationController() external view returns (address);

    function setVesting(address _vesting) external;

    function getVesting() external view returns (address);

    function setPermissionedExchange(address _permissionedExchange) external;

    function getPermissionedExchange() external view returns (address);

    function setDisputeManager(address _disputeManager) external;

    function getDisputeManager() external view returns (address);

    function setStateChannel(address _stateChannel) external;

    function getStateChannel() external view returns (address);

    function setConsumerRegistry(address _consumerRegistry) external;

    function getConsumerRegistry() external view returns (address);

    function setPriceOracle(address _priceOracle) external;

    function getPriceOracle() external view returns (address);
}
