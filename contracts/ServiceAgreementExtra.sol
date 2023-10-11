// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './interfaces/IServiceAgreementRegistry.sol';
import './interfaces/IServiceAgreementExtra.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/IProjectRegistry.sol';
import './interfaces/ISettings.sol';
import './utils/MathUtil.sol';
import './Constants.sol';

/**
 * @title Indexer Service Agreement Contract
 * @notice ### Overview
 * This contract tracks all service Agreements for Indexers.
 */
contract ServiceAgreementExtra is Initializable, OwnableUpgradeable, IServiceAgreementExtra, Constants {
    using MathUtil for uint256;

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;

    /// @notice second in a day
    uint256 private constant SECONDS_IN_DAY = 86400;

    /// @notice Multipler used to calculate Indexer reward limit
    uint256 public threshold;

    /// @notice serviceAgreement address: Indexer address => index number => serviceAgreement address
    mapping(address => mapping(uint256 => uint256)) private closedServiceAgreementIds;

    /// @notice number of service agreements: Indexer address =>  number of service agreements
    mapping(address => uint256) private saLength;

    /// @notice number of service agreements: Indexer address => DeploymentId => number of service agreements
    mapping(address => mapping(bytes32 => uint256)) public deploymentSaLength;

    /// @notice calculated sum daily reward: Indexer address => sumDailyReward
    mapping(address => uint256) public sumDailyReward;

    /**
     * @dev Emitted when expired closed service agreement removed.
     */
    event ClosedAgreementRemoved(
        address indexed consumer,
        address indexed indexer,
        bytes32 indexed deploymentId,
        uint256 serviceAgreementId
    );

    /**
     * @dev Initialize this contract. Load establisherWhitelist.
     */
    function initialize(ISettings _settings, uint256 _threshold) external initializer {
        __Ownable_init();

        settings = _settings;
        threshold = _threshold;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @dev We adjust the ratio of Indexer‘s totalStakedAmount and sumDailyRewards by
     * setting the value of threshold.
     * A smaller threshold value means that the Indexer can get higher sumDailyRewards with
     * a smaller totalStakedAmount，vice versa.
     * If the threshold is less than PER_MILL, we will not limit the indexer's sumDailyRewards.
     */
    function setThreshold(uint256 _threshold) external onlyOwner {
        threshold = _threshold >= PER_MILL ? _threshold : 0;
    }

    function periodInDay(uint256 period) private pure returns (uint256) {
        return period > SECONDS_IN_DAY ? period / SECONDS_IN_DAY : 1;
    }

    function addAgreement(uint256 agreementId, ClosedServiceAgreementInfo memory agreement, bool checkThreshold) external {
        require(msg.sender == settings.getServiceAgreementRegistry(), 'ISA001');
        require(
            IProjectRegistry(settings.getProjectRegistry()).isServiceAvailable(agreement.deploymentId, agreement.indexer),
            'SA005'
        );

        address indexer = agreement.indexer;
        uint256 lockedAmount = agreement.lockedAmount;
        uint256 period = periodInDay(agreement.period);
        sumDailyReward[indexer] += lockedAmount / period;

        IStakingManager stakingManager = IStakingManager(settings.getStakingManager());
        uint256 totalStake = stakingManager.getTotalStakingAmount(agreement.indexer);
        require(
            !checkThreshold || totalStake >= MathUtil.mulDiv(sumDailyReward[indexer], threshold, PER_MILL),
            'SA006'
        );

        closedServiceAgreementIds[indexer][saLength[indexer]] = agreementId;
        saLength[indexer] += 1;
        deploymentSaLength[indexer][agreement.deploymentId] += 1;
    }

    function clearEndedAgreement(address indexer, uint256 id) external {
        IServiceAgreementRegistry sar = IServiceAgreementRegistry(settings.getServiceAgreementRegistry());
        require(id < saLength[indexer], 'SA001');

        uint256 agreementId = closedServiceAgreementIds[indexer][id];
        ClosedServiceAgreementInfo memory agreement = sar.getClosedServiceAgreement(agreementId);
        require(agreement.consumer != address(0), 'SA001');
        require(block.timestamp > (agreement.startDate + agreement.period), 'SA010');

        _removeEndedAgreement(id, agreement);

        emit ClosedAgreementRemoved(agreement.consumer, agreement.indexer, agreement.deploymentId, agreementId);
    }

    function clearAllEndedAgreements(address indexer) external {
        require(saLength[indexer]>0, 'SA001');
        IServiceAgreementRegistry sar = IServiceAgreementRegistry(settings.getServiceAgreementRegistry());
        uint256 count = 0;
        for (uint256 i = saLength[indexer]; i > 0; i--) {
            uint256 agreementId = closedServiceAgreementIds[indexer][i - 1];
            ClosedServiceAgreementInfo memory agreement = sar.getClosedServiceAgreement(agreementId);
            require(agreement.consumer != address(0), 'SA001');
            if (block.timestamp > (agreement.startDate + agreement.period)) {
                _removeEndedAgreement(i - 1, agreement);
                emit ClosedAgreementRemoved(agreement.consumer, agreement.indexer, agreement.deploymentId, agreementId);
                count++;
                if (count >= 10) {
                    break;
                }
            }
        }
    }

    function _removeEndedAgreement(uint256 id, ClosedServiceAgreementInfo memory agreement) private {
        address indexer = agreement.indexer;
        uint256 lockedAmount = agreement.lockedAmount;
        uint256 period = periodInDay(agreement.period);
        sumDailyReward[indexer] = MathUtil.sub(sumDailyReward[indexer], (lockedAmount / period));

        closedServiceAgreementIds[indexer][id] = closedServiceAgreementIds[indexer][saLength[indexer] - 1];
        delete closedServiceAgreementIds[indexer][saLength[indexer] - 1];
        saLength[indexer] -= 1;
        deploymentSaLength[indexer][agreement.deploymentId] -= 1;
    }

    function getServiceAgreementLength(address indexer) external view returns (uint256) {
        return saLength[indexer];
    }

    function getServiceAgreementId(address indexer, uint256 id) external view returns (uint256) {
        return closedServiceAgreementIds[indexer][id];
    }

    function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool) {
        return deploymentSaLength[indexer][deploymentId] > 0;
    }
}
