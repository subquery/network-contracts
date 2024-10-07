// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;
//import "hardhat/console.sol";

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './Constants.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IStakingAllocation.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/IConsumerRegistry.sol';
import './interfaces/ISettings.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IRewardsDistributor.sol';
import './interfaces/IRewardsBooster.sol';
import './interfaces/IProjectRegistry.sol';
import './utils/FixedMath.sol';
import './utils/MathUtil.sol';
import './utils/StakingUtil.sol';
import './utils/SQParameter.sol';

/**
 * @title Rewards for running
 * @notice ### Overview
 * The RewardsRunning using the Cobb-Douglas production function for staking & running
 */
contract RewardsBooster is Initializable, OwnableUpgradeable, IRewardsBooster, SQParameter {
    using ERC165CheckerUpgradeable for address;
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    uint256 private constant FIXED_POINT_SCALING_FACTOR = 1e18;

    // --------- configs

    /// @notice ### STATES
    /// @notice Settings info
    ISettings public settings;

    /// @notice Allowlist reporters
    mapping(address => bool) public reporters;

    // @notice token issued for runner rewards per block
    uint256 public issuancePerBlock;
    uint256 public minimumDeploymentBooster;

    // --------- configs end

    // --------- booster
    // @deprecated
    uint256 public accSQTPerStake;
    // @deprecated
    uint256 public totalBoosterPoint;
    // @deprecated
    mapping(bytes32 => DeploymentPool) public deploymentPools;
    // @deprecated
    uint256 public accRewardsPerBooster;
    // @deprecated
    uint256 public accRewardsPerBoosterLastBlockUpdated;
    // @notice projectType => rate (per_mill)
    mapping(ProjectType => uint256) public boosterQueryRewardRate;
    // --------- booster end

    // --------- separated boost pool
    mapping(ProjectType => uint256) public issuancePerBlockByType;
    mapping(ProjectType => uint256) public totalBoosterPointByType;
    mapping(bytes32 => DeploymentPool) public deploymentPoolsByType;
    mapping(ProjectType => uint256) public accRewardsPerBoosterByType;
    mapping(ProjectType => uint256) public accRewardsPerBoosterLastBlockUpdatedByType;
    // --------- separated boost end

    /// @notice ### EVENTS
    event ParameterUpdated(string param, uint256 value);
    // Booster changes
    event DeploymentBoosterAdded(
        bytes32 indexed deploymentId,
        address indexed account,
        uint256 amount
    );
    event DeploymentBoosterRemoved(
        bytes32 indexed deploymentId,
        address indexed account,
        uint256 amount
    );
    /// @notice Emitted when add Labor(reward) for current era pool
    event MissedLabor(bytes32 indexed deploymentId, address indexed runner, uint256 labor);
    event AllocationRewardsGiven(
        bytes32 indexed deploymentId,
        address indexed runner,
        uint256 amount
    );
    event AllocationRewardsBurnt(
        bytes32 indexed deploymentId,
        address indexed runner,
        uint256 amount
    );
    event QueryRewardsSpent(
        bytes32 indexed deploymentId,
        address indexed spender,
        uint256 amount,
        bytes data
    );
    event QueryRewardsRefunded(
        bytes32 indexed deploymentId,
        address indexed spender,
        uint256 amount,
        bytes data
    );
    event DeploymentBoostMigrated(
        bytes32 indexed deploymentId,
        address indexed account,
        uint256 amount
    );

    /// @dev MODIFIER
    /// @notice only consumer or its controller can call
    modifier consumerAuthorised(address consumer) {
        if (msg.sender != consumer) {
            bool isController = IConsumerRegistry(
                settings.getContractAddress(SQContracts.ConsumerRegistry)
            ).isController(consumer, msg.sender);
            require(isController, 'RB014');
        }

        _;
    }

    /**
     * @notice ### FUNCTIONS
     * @notice Initialize the contract
     * @param _settings settings contract address
     */
    function initialize(
        ISettings _settings,
        uint256 _issuancePerBlock,
        uint256 _minimumDeploymentBooster
    ) external initializer {
        __Ownable_init();

        settings = _settings;
        issuancePerBlock = _issuancePerBlock;
        minimumDeploymentBooster = _minimumDeploymentBooster;
        emit Parameter('issuancePerBlock', abi.encodePacked(issuancePerBlock));
        emit Parameter('minimumDeploymentBooster', abi.encodePacked(minimumDeploymentBooster));
    }

    /**
     * @notice update the settings
     * @param _settings settings contract address
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function setBoosterQueryRewardRate(ProjectType _type, uint256 _rate) external onlyOwner {
        require(_rate < PER_MILL, 'RB002');
        boosterQueryRewardRate[_type] = _rate;
        emit Parameter('boosterQueryRewardRate', abi.encodePacked(_type, _rate));
    }

    function setMinimumDeploymentBooster(uint256 _minimumDeploymentBooster) external onlyOwner {
        minimumDeploymentBooster = _minimumDeploymentBooster;
        emit Parameter('minimumDeploymentBooster', abi.encodePacked(minimumDeploymentBooster));
    }

    /**
     * @notice Sets the token issuance per block.
     * The issuance is defined as a fixed amount of rewards per block in SQT.
     * Whenever this function is called in child chain, the inflation rate also need to update from root chain
     * @param _issuancePerBlock Issuance expressed in SQT per block (scaled by 1e18)
     */
    function setIssuancePerBlockByType(
        ProjectType _type,
        uint256 _issuancePerBlock
    ) external onlyOwner {
        // Called since `issuance per block` will change
        _updateAccRewardsPerBooster(_type);

        issuancePerBlockByType[_type] = _issuancePerBlock;
        // Assuming enum fits in 8 bits, shift the uint256 by 8 bits and then add the enum value
        emit ParameterUpdated(
            'issuancePerBlockByType',
            (uint256(_issuancePerBlock) << 8) | uint256(uint8(_type))
        );
    }

    /**
     * @notice update the reporter status
     * @param reporter reporter address
     * @param allow reporter allow or not
     */
    function setReporter(address reporter, bool allow) external onlyOwner {
        reporters[reporter] = allow;
    }

    /**
     * @notice
     * @param deploymentId project deployment id
     */
    modifier onlyRegisteredDeployment(bytes32 deploymentId) {
        require(
            IProjectRegistry(settings.getContractAddress(SQContracts.ProjectRegistry))
                .isDeploymentRegistered(deploymentId),
            'RB008'
        );
        _;
    }

    /**
     * @notice add booster to a deployment
     * @param _deploymentId the deployment id
     * @param _amount the added amount
     */
    function boostDeployment(
        bytes32 _deploymentId,
        uint256 _amount
    ) external onlyRegisteredDeployment(_deploymentId) {
        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);

        _addBoosterDeployment(projectType, _deploymentId, msg.sender, _amount);

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
    }

    /**
     * @notice add booster to a deployment for a different user
     * @param _deploymentId the deployment id
     * @param _amount the added amount
     * @param _for on behalf of the account boost was added
     */
    function boostDeploymentFor(
        bytes32 _deploymentId,
        uint256 _amount,
        address _for
    ) external consumerAuthorised(_for) onlyRegisteredDeployment(_deploymentId) {
        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);

        _addBoosterDeployment(projectType, _deploymentId, _for, _amount);

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
    }

    /**
     * @notice remove booster from deployment
     * @param _deploymentId deploymentId
     * @param _amount the added amount
     */
    function removeBoosterDeployment(bytes32 _deploymentId, uint256 _amount) external {
        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);
        require(
            deploymentPoolsByType[_deploymentId].accountBooster[msg.sender] >= _amount,
            'RB003'
        );

        _removeBoosterDeployment(projectType, _deploymentId, msg.sender, _amount);
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(msg.sender, _amount);
    }

    /**
     * @notice swap booster from one deployment to another
     * @param account the account booster the deployments
     * @param from from deploymentId
     * @param to  to deploymentId
     * @param amount the amount to swap
     */
    function swapBoosterDeployment(
        address account,
        bytes32 from,
        bytes32 to,
        uint256 amount
    ) external onlyRegisteredDeployment(to) consumerAuthorised(account) {
        require(from != to, 'RB013');

        ProjectType projectTypeFrom = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(from);
        require(deploymentPoolsByType[from].accountBooster[account] >= amount, 'RB003');
        _removeBoosterDeployment(projectTypeFrom, from, account, amount);

        ProjectType projectTypeTo = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(to);
        _addBoosterDeployment(projectTypeTo, to, account, amount);
    }

    function getRunnerDeploymentBooster(
        bytes32 _deploymentId,
        address _runner
    ) external view returns (uint256) {
        return deploymentPoolsByType[_deploymentId].accountBooster[_runner];
    }

    /**
     * @notice Calculate current rewards for a given allocation on demand.
     *         rewards after over_allocation block are ignored
     * @param _deploymentId _deploymentId
     * @param _runner _runner
     * @return Rewards amount for an allocation
     * @return Rewards burnt due to missedLabor
     */
    function getAllocationRewards(
        bytes32 _deploymentId,
        address _runner
    ) external view returns (uint256, uint256) {
        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];
        IStakingAllocation sa = IStakingAllocation(
            settings.getContractAddress(SQContracts.StakingAllocation)
        );
        uint256 runnerAllocAmount = sa.allocatedTokens(_runner, _deploymentId);

        RunnerDeploymentReward memory runnerDeplReward = deployment.runnerAllocationRewards[
            _runner
        ];

        (uint256 accRewardsPerAllocatedToken, ) = _getAccRewardsPerAllocatedToken(
            projectType,
            _deploymentId
        );

        uint256 totalRewards = _calcRewards(
            runnerAllocAmount,
            runnerDeplReward.accRewardsPerToken,
            accRewardsPerAllocatedToken
        );

        return
            _fixRewardsWithMissedLaborAndOverflow(
                totalRewards,
                runnerDeplReward,
                sa.overAllocationTime(_runner)
            );
    }

    /**
     * @notice Add booster deployment staking
     * @param _deploymentId the deployment id
     * @param _account the booster account
     * @param _amount the added amount
     */
    function _addBoosterDeployment(
        ProjectType _projectType,
        bytes32 _deploymentId,
        address _account,
        uint256 _amount
    ) internal {
        DeploymentPool storage deploymentPool = deploymentPoolsByType[_deploymentId];
        _onDeploymentBoosterUpdate(_projectType, _deploymentId, _account);
        deploymentPool.boosterPoint += _amount;
        deploymentPool.accountBooster[_account] += _amount;
        require(deploymentPool.accountBooster[_account] >= minimumDeploymentBooster, 'RB015');

        deploymentPool.accRewardsPerBooster = accRewardsPerBoosterByType[_projectType];
        totalBoosterPointByType[_projectType] += _amount;

        emit DeploymentBoosterAdded(_deploymentId, _account, _amount);
    }

    /**
     * @notice Remove booster from deployment
     * @param _deploymentId deploymentId
     * @param _account the booster account
     * @param _amount the added amount
     */
    function _removeBoosterDeployment(
        ProjectType _projectType,
        bytes32 _deploymentId,
        address _account,
        uint256 _amount
    ) internal {
        DeploymentPool storage deploymentPool = deploymentPoolsByType[_deploymentId];
        _onDeploymentBoosterUpdate(_projectType, _deploymentId, _account);
        deploymentPool.boosterPoint -= _amount;
        deploymentPool.accountBooster[_account] -= _amount;
        deploymentPool.accRewardsPerBooster = accRewardsPerBoosterByType[_projectType];
        totalBoosterPointByType[_projectType] -= _amount;

        require(
            deploymentPool.accountBooster[_account] >= minimumDeploymentBooster ||
                deploymentPool.accountBooster[_account] == 0,
            'RB016'
        );

        emit DeploymentBoosterRemoved(_deploymentId, _account, _amount);
    }

    /**
     * @notice Fix reward considering missed labor
     * @param _reward reward before fix
     * @param _runnerDepReward RunnerDeploymentReward
     * @return Rewards amount for an allocation
     * @return Rewards burnt due to missedLabor
     */
    function _fixRewardsWithMissedLaborAndOverflow(
        uint256 _reward,
        RunnerDeploymentReward memory _runnerDepReward,
        uint256 _totalOverAllocatedTime
    ) internal view returns (uint256, uint256) {
        uint256 rewardPeriod = block.timestamp - _runnerDepReward.lastClaimedAt;
        if (_reward == 0) {
            return (0, 0);
        }
        if (rewardPeriod == 0) {
            return (0, 0);
        }
        uint256 overAllocatedTime = _totalOverAllocatedTime - _runnerDepReward.overflowTimeSnapshot;

        uint256 fixedRewardByMissedLabor = MathUtil.mulDiv(
            _reward,
            rewardPeriod - _getMissedLabor(_runnerDepReward),
            rewardPeriod
        );
        uint256 fixedReward = MathUtil.mulDiv(
            fixedRewardByMissedLabor,
            rewardPeriod - overAllocatedTime,
            rewardPeriod
        );
        return (fixedReward, _reward - fixedReward);
    }

    /**
     * @notice Calculate current rewards for a given allocation.
     * @param _tokens Tokens allocated
     * @param _startAccRewardsPerAllocatedToken Allocation start accumulated rewards
     * @param _endAccRewardsPerAllocatedToken Allocation end accumulated rewards
     * @return Rewards amount
     */
    function _calcRewards(
        uint256 _tokens,
        uint256 _startAccRewardsPerAllocatedToken,
        uint256 _endAccRewardsPerAllocatedToken
    ) private pure returns (uint256) {
        uint256 newAccrued = _endAccRewardsPerAllocatedToken - _startAccRewardsPerAllocatedToken;
        return MathUtil.mulDiv(newAccrued, _tokens, FIXED_POINT_SCALING_FACTOR);
    }

    /**
     * @notice Gets the issuance of rewards per signal since last updated.
     *
     * Linear formula: `x = r * t`
     *
     * Notation:
     * t: time steps are in blocks since last updated
     * x: newly accrued rewards tokens for the period `t`
     *
     * @return newly accrued rewards per signal since last update, scaled by FIXED_POINT_SCALING_FACTOR
     */
    function getNewRewardsPerBoosterByType(ProjectType _type) public view returns (uint256) {
        // Calculate time steps
        uint256 t = block.number.sub(accRewardsPerBoosterLastBlockUpdatedByType[_type]);
        // Optimization to skip calculations if zero time steps elapsed or issuancePerBlock is zero or totalBoosterPoint is zero
        if (t == 0 || issuancePerBlockByType[_type] == 0 || totalBoosterPointByType[_type] == 0) {
            return 0;
        }

        uint256 x = issuancePerBlockByType[_type] * t;

        // Get the new issuance per booster token
        // We multiply the decimals to keep the precision as fixed-point number
        return MathUtil.mulDiv(x, FIXED_POINT_SCALING_FACTOR, totalBoosterPointByType[_type]);
    }

    /**
     * @notice Gets the currently accumulated rewards per signal.
     * @return Currently accumulated rewards per signal
     */

    function getAccRewardsPerBooster(ProjectType _projectType) public view returns (uint256) {
        return
            accRewardsPerBoosterByType[_projectType] + getNewRewardsPerBoosterByType(_projectType);
    }

    /**
     * @notice Updates the accumulated rewards per booster and save checkpoint block number.
     * Must be called before `issuancePerBlock` or `total booster` changes
     * @return Accumulated rewards per boosted token
     */
    function _updateAccRewardsPerBooster(ProjectType _projectType) internal returns (uint256) {
        accRewardsPerBoosterByType[_projectType] = getAccRewardsPerBooster(_projectType);
        accRewardsPerBoosterLastBlockUpdatedByType[_projectType] = block.number;
        return accRewardsPerBoosterByType[_projectType];
    }

    /**
     * @notice Gets the accumulated rewards for the deployment. including query rewards and allocation rewards
     * @param _deploymentId deployment
     * @return Accumulated rewards for deployment
     */
    function getAccRewardsForDeployment(bytes32 _deploymentId) external view returns (uint256) {
        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);

        return _getAccRewardsForDeployment(projectType, _deploymentId);
    }

    /**
     * @notice Gets the accumulated rewards for the deployment. including query rewards and allocation rewards
     * @param _deploymentId deployment
     * @return Accumulated rewards for deployment
     */
    function _getAccRewardsForDeployment(bytes32 _deploymentId) internal view returns (uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        // Only accrue rewards if over a threshold
        // Accrue new rewards since last snapshot
        uint256 newRewards = 0;
        return deployment.accRewardsForDeployment + newRewards;
    }

    /**
     * @notice Gets the accumulated rewards for the deployment. including query rewards and allocation rewards
     * @param _projectType project type, caller should make sure project type match the deployment
     * @param _deploymentId deployment
     * @return Accumulated rewards for deployment
     */
    function _getAccRewardsForDeployment(
        ProjectType _projectType,
        bytes32 _deploymentId
    ) internal view returns (uint256) {
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];

        // Only accrue rewards if over a threshold
        // Accrue new rewards since last snapshot
        uint256 newRewards = MathUtil.mulDiv(
            getAccRewardsPerBooster(_projectType) - deployment.accRewardsPerBoosterSnapshot,
            deployment.boosterPoint,
            FIXED_POINT_SCALING_FACTOR
        );
        return deployment.accRewardsForDeployment + newRewards;
    }

    /**
     * @notice Triggers an update of rewards for a deployment.
     * Must be called before booster changes.
     * must use old boost storages
     * @param _deploymentId deployment
     * @return Accumulated rewards for deployment
     */
    function _onDeploymentBoosterUpdate(
        ProjectType _projectType,
        bytes32 _deploymentId,
        address _account
    ) internal returns (uint256) {
        // Called since `total boosted token` will change
        _updateAccRewardsPerBooster(_projectType);

        // Updates the accumulated rewards
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];
        deployment.accRewardsForDeployment = _getAccRewardsForDeployment(
            _projectType,
            _deploymentId
        );
        deployment.accRewardsPerBoosterSnapshot = accRewardsPerBoosterByType[_projectType];

        // update accQueryRewards
        BoosterQueryReward storage boosterQueryReward = deployment.boosterQueryRewards[_account];
        (
            uint256 accQueryRewardsPerBooster,
            uint256 accRewardsForDeploymentSnapshot
        ) = _getAccQueryRewardsPerBooster(_projectType, _deploymentId);
        boosterQueryReward.accQueryRewards = _getAccQueryRewardsByType(
            _projectType,
            _deploymentId,
            _account
        );
        boosterQueryReward.accQueryRewardsPerBoosterSnapshot = accQueryRewardsPerBooster;
        deployment.accQueryRewardsPerBooster = accQueryRewardsPerBooster;

        // also update perAllocatedToken
        (uint256 accRewardsPerAllocatedToken, ) = _getAccRewardsPerAllocatedToken(
            _projectType,
            _deploymentId
        );
        deployment.accRewardsPerAllocatedToken = accRewardsPerAllocatedToken;
        deployment.accRewardsForDeploymentSnapshot = accRewardsForDeploymentSnapshot;

        return deployment.accRewardsForDeployment;
    }

    /**
     * @notice Triggers an update of rewards for a deployment.
     * Must be called before allocation on a deployment changes.
     *
     * @param _deploymentId deployment
     * @return Accumulated rewards per allocated token for a deployment
     */
    function _onAllocationUpdate(
        ProjectType _projectType,
        bytes32 _deploymentId
    ) internal returns (uint256) {
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];
        (
            uint256 accRewardsPerAllocatedToken,
            uint256 accRewardsForDeployment
        ) = _getAccRewardsPerAllocatedToken(_projectType, _deploymentId);
        deployment.accRewardsPerAllocatedToken = accRewardsPerAllocatedToken;
        // also update for booster
        (uint256 accQueryRewardsPerBooster, ) = _getAccQueryRewardsPerBooster(
            _projectType,
            _deploymentId
        );
        deployment.accQueryRewardsPerBooster = accQueryRewardsPerBooster;
        deployment.accRewardsForDeploymentSnapshot = accRewardsForDeployment;

        return deployment.accRewardsPerAllocatedToken;
    }

    /**
     * @notice Gets the accumulated rewards per allocated token for the deployment.
     * @param _deploymentId deployment
     * @return Accumulated rewards per allocated token for the deployment
     * @return Accumulated allocation rewards for deployment
     */
    function getAccRewardsPerAllocatedToken(
        bytes32 _deploymentId
    ) external view returns (uint256, uint256) {
        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);
        return _getAccRewardsPerAllocatedToken(projectType, _deploymentId);
    }

    function _getAccRewardsPerAllocatedToken(
        ProjectType _projectType,
        bytes32 _deploymentId
    ) internal view returns (uint256, uint256) {
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];

        uint256 accRewardsForDeployment = _getAccRewardsForDeployment(_projectType, _deploymentId);

        uint256 newRewardsForDeployment = MathUtil.diffOrZero(
            accRewardsForDeployment,
            deployment.accRewardsForDeploymentSnapshot
        );

        IStakingAllocation sa = IStakingAllocation(
            settings.getContractAddress(SQContracts.StakingAllocation)
        );
        uint256 deploymentAllocatedTokens = sa.deploymentAllocations(_deploymentId);
        if (deploymentAllocatedTokens == 0) {
            // newRewardsPerAllocatedToken is zero
            return (deployment.accRewardsPerAllocatedToken, accRewardsForDeployment);
        }

        uint256 allocateRewardRate = PER_MILL - boosterQueryRewardRate[_projectType];
        uint256 newAllocRewardsForDeployment = MathUtil.mulDiv(
            newRewardsForDeployment,
            allocateRewardRate,
            PER_MILL
        );

        uint256 newRewardsPerAllocatedToken = MathUtil.mulDiv(
            newAllocRewardsForDeployment,
            FIXED_POINT_SCALING_FACTOR,
            deploymentAllocatedTokens
        );

        return (
            deployment.accRewardsPerAllocatedToken + newRewardsPerAllocatedToken,
            accRewardsForDeployment
        );
    }

    /**
     * @notice Add Labor(online status) for current era project pool
     * @param _deploymentIds deployment id
     * @param _runners all runner addresses
     * @param _disableds whether runner is disabled for reward
     * @param _missedLaborChanges all missed labor within the current report period
     */
    function setMissedLabor(
        bytes32[] calldata _deploymentIds,
        address[] calldata _runners,
        bool[] calldata _disableds,
        uint256[] calldata _missedLaborChanges,
        uint256 _reportAt
    ) external {
        require(reporters[msg.sender], 'RB004');
        require(
            _deploymentIds.length == _runners.length &&
                _deploymentIds.length == _disableds.length &&
                _deploymentIds.length == _missedLaborChanges.length,
            'RB012'
        );

        for (uint256 i = 0; i < _runners.length; i++) {
            // skip set miss labor on old reward pool
            RunnerDeploymentReward storage runnerDeplReward = deploymentPoolsByType[
                _deploymentIds[i]
            ].runnerAllocationRewards[_runners[i]];
            require(
                _reportAt > runnerDeplReward.lastMissedLaborReportAt &&
                    _reportAt <= block.timestamp,
                'RB010'
            );

            // scenario#1: if `disabled` changes from any -> false, by default we consider between lastReportMissedLabor and block.timestamp no misslabor
            // unless specified in _missedLaborChanges
            // scenario#2: if `disabled` changes from any -> true, by default we consider between lastReportMissedLabor and block.timestamp is all misslabored
            // unless specified in _missedLaborChanges
            uint256 missedLaborAdd;
            if (_disableds[i]) {
                missedLaborAdd = _reportAt - runnerDeplReward.lastMissedLaborReportAt;
            }
            if (_missedLaborChanges[i] > 0) {
                require(
                    _missedLaborChanges[i] <= _reportAt - runnerDeplReward.lastMissedLaborReportAt,
                    'RB011'
                );
                missedLaborAdd = _missedLaborChanges[i];
            }
            runnerDeplReward.missedLaborTime += missedLaborAdd;
            runnerDeplReward.disabled = _disableds[i];
            runnerDeplReward.lastMissedLaborReportAt = _reportAt;

            uint256 rewardPeriod = _reportAt - runnerDeplReward.lastClaimedAt;
            require(runnerDeplReward.missedLaborTime <= rewardPeriod, 'RB009');

            if (missedLaborAdd > 0) {
                emit MissedLabor(_deploymentIds[i], _runners[i], missedLaborAdd);
            }
        }
    }

    function getMissedLabor(
        bytes32 _deploymentId,
        address _runner
    ) external view returns (uint256) {
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];
        RunnerDeploymentReward memory runnerDeplReward = deployment.runnerAllocationRewards[
            _runner
        ];
        return _getMissedLabor(runnerDeplReward);
    }

    function _getMissedLabor(
        RunnerDeploymentReward memory _runnerDepReward
    ) internal view returns (uint256) {
        uint256 missedLabor = _runnerDepReward.missedLaborTime;
        if (_runnerDepReward.disabled) {
            missedLabor += block.timestamp - _runnerDepReward.lastMissedLaborReportAt;
        }
        return missedLabor;
    }

    function collectAllocationReward(bytes32 _deploymentId, address _runner) external override {
        IIndexerRegistry indexerRegistry = IIndexerRegistry(
            ISettings(settings).getContractAddress(SQContracts.IndexerRegistry)
        );
        address controller = indexerRegistry.getController(_runner);
        address stakingAllocation = settings.getContractAddress(SQContracts.StakingAllocation);
        require(
            msg.sender == _runner || msg.sender == controller || msg.sender == stakingAllocation,
            'RB005'
        );

        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);
        _collectAllocationReward(projectType, _deploymentId, _runner);
    }

    function _collectAllocationReward(
        ProjectType _projectType,
        bytes32 _deploymentId,
        address _runner
    ) internal {
        uint256 accRewardsPerAllocatedToken = _onAllocationUpdate(_projectType, _deploymentId);
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];
        IStakingAllocation sa = IStakingAllocation(
            settings.getContractAddress(SQContracts.StakingAllocation)
        );
        uint256 runnerAllocAmount = sa.allocatedTokens(_runner, _deploymentId);
        RunnerDeploymentReward storage runnerDeplReward = deployment.runnerAllocationRewards[
            _runner
        ];
        uint256 reward = _calcRewards(
            runnerAllocAmount,
            runnerDeplReward.accRewardsPerToken,
            accRewardsPerAllocatedToken
        );

        runnerDeplReward.accRewardsPerToken = accRewardsPerAllocatedToken;
        uint256 burnt;
        uint256 totalOverflowTime = sa.overAllocationTime(_runner);
        (reward, burnt) = _fixRewardsWithMissedLaborAndOverflow(
            reward,
            runnerDeplReward,
            totalOverflowTime
        );

        // clean missedlabor
        runnerDeplReward.lastClaimedAt = block.timestamp;
        runnerDeplReward.missedLaborTime = 0;
        runnerDeplReward.lastMissedLaborReportAt = block.timestamp;
        runnerDeplReward.overflowTimeSnapshot = totalOverflowTime;

        if (reward > 0) {
            address treasury = ISettings(settings).getContractAddress(SQContracts.Treasury);
            IRewardsDistributor rewardsDistributor = IRewardsDistributor(
                ISettings(settings).getContractAddress(SQContracts.RewardsDistributor)
            );
            IEraManager eraManager = IEraManager(
                ISettings(settings).getContractAddress(SQContracts.EraManager)
            );
            IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
            sqToken.safeTransferFrom(treasury, address(this), reward);
            sqToken.safeIncreaseAllowance(address(rewardsDistributor), reward);
            rewardsDistributor.addInstantRewards(
                _runner,
                address(this),
                reward,
                eraManager.safeUpdateAndGetEra()
            );
            emit AllocationRewardsGiven(_deploymentId, _runner, reward);
        }
        if (burnt > 0) {
            // since rewards is pulled from treasury, and burn returns rewards to treasury, we don't need to do anything here
            emit AllocationRewardsBurnt(_deploymentId, _runner, burnt);
        }
    }

    function getAccQueryRewardsPerBooster(
        bytes32 _deploymentId
    ) public view returns (uint256, uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        uint256 accRewardsForDeployment = _getAccRewardsForDeployment(_deploymentId);
        uint256 newRewardsForDeployment = MathUtil.diffOrZero(
            accRewardsForDeployment,
            deployment.accRewardsForDeploymentSnapshot
        );

        uint256 deploymentBoostedToken = deployment.boosterPoint;
        if (deploymentBoostedToken == 0) {
            return (deployment.accQueryRewardsPerBooster, accRewardsForDeployment);
        }

        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);
        uint256 newQueryRewardsForDeployment = MathUtil.mulDiv(
            newRewardsForDeployment,
            boosterQueryRewardRate[projectType],
            PER_MILL
        );

        uint256 newQueryRewardsPerBooster = MathUtil.mulDiv(
            newQueryRewardsForDeployment,
            FIXED_POINT_SCALING_FACTOR,
            deploymentBoostedToken
        );

        return (
            deployment.accQueryRewardsPerBooster + newQueryRewardsPerBooster,
            accRewardsForDeployment
        );
    }
    function _getAccQueryRewardsPerBooster(
        ProjectType _projectType,
        bytes32 _deploymentId
    ) internal view returns (uint256, uint256) {
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];

        uint256 accRewardsForDeployment = _getAccRewardsForDeployment(_projectType, _deploymentId);
        uint256 newRewardsForDeployment = MathUtil.diffOrZero(
            accRewardsForDeployment,
            deployment.accRewardsForDeploymentSnapshot
        );

        uint256 deploymentBoostedToken = deployment.boosterPoint;
        if (deploymentBoostedToken == 0) {
            return (deployment.accQueryRewardsPerBooster, accRewardsForDeployment);
        }

        uint256 newQueryRewardsForDeployment = MathUtil.mulDiv(
            newRewardsForDeployment,
            boosterQueryRewardRate[_projectType],
            PER_MILL
        );

        uint256 newQueryRewardsPerBooster = MathUtil.mulDiv(
            newQueryRewardsForDeployment,
            FIXED_POINT_SCALING_FACTOR,
            deploymentBoostedToken
        );

        return (
            deployment.accQueryRewardsPerBooster + newQueryRewardsPerBooster,
            accRewardsForDeployment
        );
    }

    function getQueryRewards(
        bytes32 _deploymentId,
        address _account
    ) external view returns (uint256) {
        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);
        return
            _getQueryRewards(_deploymentId, _account) +
            _getQueryRewards(projectType, _deploymentId, _account);
    }

    function _getQueryRewards(
        bytes32 _deploymentId,
        address _account
    ) internal view returns (uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        (uint256 accQueryRewardsPerBoostedToken, ) = getAccQueryRewardsPerBooster(_deploymentId);

        uint256 newRewards = _calcRewards(
            deployment.accountBooster[_account],
            deployment.boosterQueryRewards[_account].accQueryRewardsPerBoosterSnapshot,
            accQueryRewardsPerBoostedToken
        );
        BoosterQueryReward memory boosterQueryRewards = deployment.boosterQueryRewards[_account];
        return
            boosterQueryRewards.accQueryRewards +
            newRewards -
            boosterQueryRewards.spentQueryRewards;
    }

    function _getQueryRewards(
        ProjectType _projectType,
        bytes32 _deploymentId,
        address _account
    ) internal view returns (uint256) {
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];

        (uint256 accQueryRewardsPerBoostedToken, ) = _getAccQueryRewardsPerBooster(
            _projectType,
            _deploymentId
        );

        uint256 newRewards = _calcRewards(
            deployment.accountBooster[_account],
            deployment.boosterQueryRewards[_account].accQueryRewardsPerBoosterSnapshot,
            accQueryRewardsPerBoostedToken
        );
        BoosterQueryReward memory boosterQueryRewards = deployment.boosterQueryRewards[_account];
        return
            boosterQueryRewards.accQueryRewards +
            newRewards -
            boosterQueryRewards.spentQueryRewards;
    }

    function getAccQueryRewards(
        bytes32 _deploymentId,
        address _account
    ) public view returns (uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        (uint256 accQueryRewardsPerBoostedToken, ) = getAccQueryRewardsPerBooster(_deploymentId);
        BoosterQueryReward memory boosterQueryRewards = deployment.boosterQueryRewards[_account];

        uint256 newRewards = _calcRewards(
            deployment.accountBooster[_account],
            boosterQueryRewards.accQueryRewardsPerBoosterSnapshot,
            accQueryRewardsPerBoostedToken
        );
        return boosterQueryRewards.accQueryRewards + newRewards;
    }

    function getAccQueryRewardsByType(
        bytes32 _deploymentId,
        address _account
    ) external view returns (uint256) {
        ProjectType projectType = IProjectRegistry(
            settings.getContractAddress(SQContracts.ProjectRegistry)
        ).getDeploymentProjectType(_deploymentId);
        return _getAccQueryRewardsByType(projectType, _deploymentId, _account);
    }

    function _getAccQueryRewardsByType(
        ProjectType _projectType,
        bytes32 _deploymentId,
        address _account
    ) internal view returns (uint256) {
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];

        (uint256 accQueryRewardsPerBoostedToken, ) = _getAccQueryRewardsPerBooster(
            _projectType,
            _deploymentId
        );
        BoosterQueryReward memory boosterQueryRewards = deployment.boosterQueryRewards[_account];

        uint256 newRewards = _calcRewards(
            deployment.accountBooster[_account],
            boosterQueryRewards.accQueryRewardsPerBoosterSnapshot,
            accQueryRewardsPerBoostedToken
        );
        return boosterQueryRewards.accQueryRewards + newRewards;
    }

    function getBoosterQueryRewards(
        bytes32 _deploymentId,
        address _account
    ) external view returns (BoosterQueryReward memory) {
        return deploymentPoolsByType[_deploymentId].boosterQueryRewards[_account];
    }

    function getRunnerDeploymentRewards(
        bytes32 _deploymentId,
        address _account
    ) external view returns (RunnerDeploymentReward memory) {
        return deploymentPoolsByType[_deploymentId].runnerAllocationRewards[_account];
    }

    function spendQueryRewards(
        bytes32 _deploymentId,
        address _spender,
        uint256 _amount,
        bytes calldata _data
    ) external override returns (uint256) {
        require(msg.sender == settings.getContractAddress(SQContracts.StateChannel), 'RB006');

        uint256 spend1 = _spendQueryRewards(_deploymentId, _spender, _amount, _data);
        if (_amount > spend1) {
            ProjectType projectType = IProjectRegistry(
                settings.getContractAddress(SQContracts.ProjectRegistry)
            ).getDeploymentProjectType(_deploymentId);
            uint256 spend2 = _spendQueryRewards(
                projectType,
                _deploymentId,
                _spender,
                _amount - spend1,
                _data
            );
            return spend1 + spend2;
        } else {
            return spend1;
        }
    }

    function _spendQueryRewards(
        bytes32 _deploymentId,
        address _spender,
        uint256 _amount,
        bytes calldata _data
    ) internal returns (uint256) {
        uint256 queryRewards = _getQueryRewards(_deploymentId, _spender);

        if (queryRewards < _amount) {
            _amount = queryRewards;
        }
        DeploymentPool storage deployment = deploymentPools[_deploymentId];
        BoosterQueryReward storage boosterQueryRewards = deployment.boosterQueryRewards[_spender];
        boosterQueryRewards.spentQueryRewards += _amount;
        if (_amount > 0) {
            // pull rewards
            IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
            sqToken.safeTransferFrom(
                ISettings(settings).getContractAddress(SQContracts.Treasury),
                address(this),
                _amount
            );
            // Allowance
            IERC20(settings.getContractAddress(SQContracts.SQToken)).approve(msg.sender, _amount);

            emit QueryRewardsSpent(_deploymentId, _spender, _amount, _data);
        }
        return _amount;
    }

    function _spendQueryRewards(
        ProjectType _projectType,
        bytes32 _deploymentId,
        address _spender,
        uint256 _amount,
        bytes calldata _data
    ) internal returns (uint256) {
        uint256 queryRewards = _getQueryRewards(_projectType, _deploymentId, _spender);

        if (queryRewards < _amount) {
            _amount = queryRewards;
        }
        DeploymentPool storage deployment = deploymentPoolsByType[_deploymentId];
        BoosterQueryReward storage boosterQueryRewards = deployment.boosterQueryRewards[_spender];
        boosterQueryRewards.spentQueryRewards += _amount;

        // pull rewards
        if (_amount > 0) {
            IERC20 sqToken = IERC20(settings.getContractAddress(SQContracts.SQToken));
            sqToken.safeTransferFrom(
                ISettings(settings).getContractAddress(SQContracts.Treasury),
                address(this),
                _amount
            );
            // Allowance
            IERC20(settings.getContractAddress(SQContracts.SQToken)).approve(msg.sender, _amount);

            emit QueryRewardsSpent(_deploymentId, _spender, _amount, _data);
        }
        return _amount;
    }

    function refundQueryRewards(
        bytes32 _deploymentId,
        address _spender,
        uint256 _amount,
        bytes calldata _data
    ) external override {
        require(msg.sender == settings.getContractAddress(SQContracts.StateChannel), 'RB006');

        DeploymentPool storage deploymentByType = deploymentPoolsByType[_deploymentId];
        BoosterQueryReward storage boosterQueryRewardsByType = deploymentByType.boosterQueryRewards[
            _spender
        ];
        if (boosterQueryRewardsByType.spentQueryRewards >= _amount) {
            // refund to new pool
            boosterQueryRewardsByType.spentQueryRewards -= _amount;
        } else {
            // refund to old pool
            DeploymentPool storage deployment = deploymentPools[_deploymentId];
            BoosterQueryReward storage boosterQueryRewards = deployment.boosterQueryRewards[
                _spender
            ];
            require(boosterQueryRewards.spentQueryRewards >= _amount, 'RB007');
            boosterQueryRewards.spentQueryRewards -= _amount;
        }

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(
            ISettings(settings).getContractAddress(SQContracts.Treasury),
            _amount
        );

        emit QueryRewardsRefunded(_deploymentId, _spender, _amount, _data);
    }
}
