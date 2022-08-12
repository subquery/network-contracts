// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/access/Ownable.sol';

import './interfaces/ISettings.sol';
import './Constants.sol';

contract Settings is ISettings, Ownable, Constants {
    address public sqToken;
    address public staking;
    address public indexerRegistry;
    address public queryRegistry;
    address public eraManager;
    address public planManager;
    address public serviceAgreementRegistry;
    address public rewardsDistributer;
    address public rewardsPool;
    address public rewardsHelper;
    address public inflationController;
    address public vesting;

    constructor() Ownable() {}

    function setProjectAddresses(
        address _indexerRegistry,
        address _queryRegistry,
        address _eraManager,
        address _planManager,
        address _serviceAgreementRegistry
    ) external override onlyOwner {
        require(_indexerRegistry != ZERO_ADDRESS);
        require(_queryRegistry != ZERO_ADDRESS);
        require(_eraManager != ZERO_ADDRESS);
        require(_planManager != ZERO_ADDRESS);
        require(_serviceAgreementRegistry != ZERO_ADDRESS);

        indexerRegistry = _indexerRegistry;
        queryRegistry = _queryRegistry;
        eraManager = _eraManager;
        planManager = _planManager;
        serviceAgreementRegistry = _serviceAgreementRegistry;
    }

    function setTokenAddresses(
        address _sqToken,
        address _staking,
        address _rewardsDistributer,
        address _rewardsPool,
        address _rewardsHelper,
        address _inflationController,
        address _vesting
    ) external override onlyOwner {
        require(_sqToken != ZERO_ADDRESS);
        require(_staking != ZERO_ADDRESS);
        require(_rewardsDistributer != ZERO_ADDRESS);
        require(_inflationController != ZERO_ADDRESS);
        require(_vesting != ZERO_ADDRESS);
        require(_rewardsHelper != ZERO_ADDRESS);
        require(_rewardsPool != ZERO_ADDRESS);

        sqToken = _sqToken;
        staking = _staking;
        rewardsDistributer = _rewardsDistributer;
        rewardsPool = _rewardsPool;
        rewardsHelper = _rewardsHelper;
        inflationController = _inflationController;
        vesting = _vesting;
    }

    function setSQToken(address _sqToken) external override onlyOwner {
        require(_sqToken != ZERO_ADDRESS);
        sqToken = _sqToken;
    }

    function getSQToken() external view override returns (address) {
        return sqToken;
    }

    function setStaking(address _staking) external override onlyOwner {
        require(_staking != ZERO_ADDRESS);
        staking = _staking;
    }

    function getStaking() external view override returns (address) {
        return staking;
    }

    function setIndexerRegistry(address _indexerRegistry) external override onlyOwner {
        require(_indexerRegistry != ZERO_ADDRESS);
        indexerRegistry = _indexerRegistry;
    }

    function getIndexerRegistry() external view override returns (address) {
        return indexerRegistry;
    }

    function setQueryRegistry(address _queryRegistry) external override onlyOwner {
        require(_queryRegistry != ZERO_ADDRESS);
        queryRegistry = _queryRegistry;
    }

    function getQueryRegistry() external view override returns (address) {
        return queryRegistry;
    }

    function setEraManager(address _eraManager) external override onlyOwner {
        require(_eraManager != ZERO_ADDRESS);
        eraManager = _eraManager;
    }

    function getEraManager() external view override returns (address) {
        return eraManager;
    }

    function setPlanManager(address _planManager) external override onlyOwner {
        require(_planManager != ZERO_ADDRESS);
        planManager = _planManager;
    }

    function getPlanManager() external view override returns (address) {
        return planManager;
    }

    function setServiceAgreementRegistry(address _serviceAgreementRegistry) external override onlyOwner {
        require(_serviceAgreementRegistry != ZERO_ADDRESS);
        serviceAgreementRegistry = _serviceAgreementRegistry;
    }

    function getServiceAgreementRegistry() external view override returns (address) {
        return serviceAgreementRegistry;
    }

    function setRewardsDistributer(address _rewardsDistributer) external override onlyOwner {
        require(_rewardsDistributer != ZERO_ADDRESS);
        rewardsDistributer = _rewardsDistributer;
    }

    function getRewardsDistributer() external view returns (address) {
        return rewardsDistributer;
    }

    function setRewardsPool(address _rewardsPool) external override onlyOwner {
        rewardsPool = _rewardsPool;
    }

    function getRewardsPool() external view returns (address) {
        return rewardsPool;
    }

    function setRewardsHelper(address _rewardsHelper) external override onlyOwner {
        rewardsHelper = _rewardsHelper;
    }

    function getRewardsHelper() external view returns (address) {
        return rewardsHelper;
    }

    function setInflationController(address _inflationController) external override onlyOwner {
        require(_inflationController != ZERO_ADDRESS);
        inflationController = _inflationController;
    }

    function getInflationController() external view returns (address) {
        return inflationController;
    }

    function setVesting(address _vesting) external override onlyOwner {
        vesting = _vesting;
    }

    function getVesting() external view returns (address) {
        return vesting;
    }
}
