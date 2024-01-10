// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './Constants.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IRewardsDistributer.sol';
import "./interfaces/IRewardsBooster.sol";
import "./interfaces/IProjectRegistry.sol";
import './utils/FixedMath.sol';
import './utils/MathUtil.sol';
import './utils/StakingUtil.sol';

/**
 * @title Rewards for running
 * @notice ### Overview
 * The RewardsRunning using the Cobb-Douglas production function for staking & running
 */
contract RewardsBooster is Initializable, OwnableUpgradeable, IRewardsBooster {
    using ERC165CheckerUpgradeable for address;
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    uint256 private constant FIXED_POINT_SCALING_FACTOR = 1e18;

    // --------- configs

    /// @dev ### STATES
    /// @notice Settings info
    ISettings public settings;

    /// @notice Allowlist reporters
    mapping(address => bool) public reporters;

    /// @notice the numerator of Percentage of the stake and labor (1-alpha) in the total
    int32 public alphaNumerator;
    /// @notice the denominator of the alpha
    int32 public alphaDenominator;
    // @notice token issued for indexer rewards per block
    uint256 public issuancePerBlock;
    uint256 public minimumDeploymentBooster;

    // --------- configs end

    // --------- booster

    uint256 public accSQTPerStake;
    uint256 public totalBoosterPoint;
    mapping(bytes32 => DeploymentPool) public deploymentPools;

    uint256 public accRewardsPerBooster;
    uint256 public accRewardsPerBoosterLastBlockUpdated;
    // @notice projectType => rate (per_mill)
    mapping(ProjectType => uint256) public boosterQueryRewardRate;
    // --------- booster end

    // --------- allocation
    // TODO: can be replaced to address to make it disperse
    uint256 public nextAllocationId;
    mapping(uint256 => Allocation) public allocations;
    // permill, max: 1e6 (100%)
    mapping(address => uint256) public indexerAllocated;
    // --------- allocation end

    /// @dev ### EVENTS
    /// @notice Emitted when update the alpha for cobb-douglas function
    event Alpha(int32 alphaNumerator, int32 alphaDenominator);
    event DeploymentBoosterAdded(bytes32 deploymentId, address account, uint256 amount);
    event DeploymentBoosterRemoved(bytes32 deploymentId, address account, uint256 amount);
    /// @notice Emitted when add Labor(reward) for current era pool
    event MissedLabor(bytes32 deploymentId, address indexer, uint256 labor);
    event StakeAllocated(uint256 allocationId, bytes32 deploymentId, address indexer, uint256 amount);
//    /// @notice Emitted when collect reward (stake) from era pool
//    event Collect(uint256 era, uint256 projectId, address indexer, uint256 reward);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract, setup the alphaNumerator, alphaDenominator
     * @param _settings settings contract address
     */
    function initialize(ISettings _settings, uint256 _issuancePerBlock, uint256 _minimumDeploymentBooster) external initializer {
        __Ownable_init();

        alphaNumerator = 1;
        alphaDenominator = 3;
        settings = _settings;
        issuancePerBlock = _issuancePerBlock;
        minimumDeploymentBooster = _minimumDeploymentBooster;
        nextAllocationId = 1;
    }

    /**
     * @notice update the settings
     * @param _settings settings contract address
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function setBoosterQueryRewardRate(ProjectType _type, uint256 _rate) external onlyOwner {
        require(_rate < PER_MILL, "invalid boosterQueryRewardRate");
        boosterQueryRewardRate[_type] = _rate;
    }

    /**
     * @notice add booster deployment staking
     * modify eraPool and deployment map
     * @param _deploymentId the deployment id
     * @param _amount the added amount
     */
    function boostDeployment(bytes32 _deploymentId, uint256 _amount) external {
        DeploymentPool storage deploymentPool = deploymentPools[_deploymentId];
        onDeploymentBoosterUpdate(_deploymentId);
        deploymentPool.boosterPoint += _amount;
        deploymentPool.accountBooster[msg.sender] += _amount;
        deploymentPool.accRewardsPerBooster = accRewardsPerBooster;
        // totalBoosterPoints
        totalBoosterPoint += _amount;

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(msg.sender, address(this), _amount);
        emit DeploymentBoosterAdded(_deploymentId, msg.sender, _amount);
    }

    /**
     * @notice remove booster from deployment
     * @param deployment deploymentId
     * @param amount the added amount
     */
    function removeBoosterDeployment(bytes32 deployment, uint256 amount) external {
        DeploymentPool storage deploymentPool = deploymentPools[deployment];
        require(deploymentPool.accountBooster[msg.sender] >= amount, "not enough");

        onDeploymentBoosterUpdate(deployment);
        // TODO: reset free query
        uint256 reward = _pullReward(deployment, deploymentPool.accRewardsPerBooster, accRewardsPerBooster);
        deploymentPool.boosterPoint -= amount;
        deploymentPool.accountBooster[msg.sender] -= amount;
        deploymentPool.accRewardsPerBooster = accRewardsPerBooster;
        // totalBoosterPoints
        totalBoosterPoint -= amount;

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(msg.sender, amount);
        emit DeploymentBoosterRemoved(deployment, msg.sender, amount);
    }

    function getIndexerDeploymentBooster(bytes32 _deploymentId, address _indexer) public view returns (uint256) {
        return deploymentPools[_deploymentId].accountBooster[_indexer];
    }

    function _pullReward(bytes32 _deploymentId, uint256 previousAccRewards, uint256 newAccRewards) internal returns (uint256) {
        return 0;
    }

    function getCapacity(address _indexer) view public returns (uint256)  {
        IStakingManager staking = IStakingManager(settings.getContractAddress(SQContracts.StakingManager));
        return MathUtil.diffOrZero(staking.getTotalStakingAmount(_indexer), indexerAllocated[_indexer]);
    }

    function allocate(bytes32 _deployment, address _indexer, uint256 _amount) external {
        require(msg.sender == _indexer, "not indexer");
        uint256 capacity = getCapacity(_indexer);
        require(capacity >= _amount, "not enough capacity");
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        uint256 era = eraManager.safeUpdateAndGetEra();
        DeploymentPool storage deploymentPool = deploymentPools[_deployment];
        uint256 allocationId = deploymentPool.indexerAllocations[_indexer];

        if (allocationId == 0) {
            allocations[nextAllocationId] = Allocation({
                indexer: _indexer,
                deploymentId: _deployment,
                amount: 0,
                missedLabor: 0,
                accRewardsPerToken: onAllocationUpdate(_deployment),
                startEra: era,
                startTime: block.timestamp,
                lastClaimedAt: block.number
            });
            allocationId = nextAllocationId;
            deploymentPool.indexerAllocations[_indexer] = allocationId;
            nextAllocationId += 1;
        } else {
            // Add allocation
            // FIXME
            _collectAllocationReward(_deployment, _indexer);
        }
        emit StakeAllocated(allocationId, _deployment, _indexer, _amount);
        // collect reward
//        _collectReward(indexer, allocations[allocationId].accRewardsPerToken, accRewardsPerToken);
        deploymentPool.totalAllocatedToken += _amount;
        allocations[allocationId].amount += _amount;
    }

    // FIXME
    function removeAllocation(uint256 _allocationId, uint256 _amount) external {
        Allocation storage allocation = allocations[_allocationId];
        require(allocation.startTime > 0, "allocation not exist");
        require(allocation.amount >= _amount, "not enough allocation");
        DeploymentPool storage deploymentPool = deploymentPools[allocation.deploymentId];
        // collect rewards
        deploymentPool.totalAllocatedToken -= _amount;
        allocation.amount -= _amount;
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
     * @notice Update the alpha for cobb-douglas function
     * @param _alphaNumerator the numerator of the alpha
     * @param _alphaDenominator the denominator of the alpha
     */
    function setAlpha(int32 _alphaNumerator, int32 _alphaDenominator) public onlyOwner {
        require(_alphaNumerator > 0 && _alphaDenominator > 0, 'RR001');
        alphaNumerator = _alphaNumerator;
        alphaDenominator = _alphaDenominator;

        emit Alpha(alphaNumerator, alphaDenominator);
    }

//
//    /**
//     * @notice get the Pool reward by projectId, era and indexer. returns my labor and total reward
//     * @param era era number
//     * @param projectId project id
//     * @param indexer indexer address
//     */
//    function getReward(uint256 era, uint256 allocationId) public view returns (uint256, uint256) {
////        EraPool storage eraPool = eraPools[era];
////        ProjectPool storage pool = eraPool.pools[projectId];
//
////        uint256 totalReward = pool.extraReward + eraPool.basicInflationReward * basicProjectShares[projectId] / 100;
//
//        return (pool.labor[indexer], totalReward);
//    }

    /**
     * @notice Calculate current rewards for a given allocation on demand.
     *         rewards after over_allocation block are ignored
     * @param _deploymentId _deploymentId
     * @param _indexer _indexer
     * @return Rewards amount for an allocation
     * @return Rewards burnt due to missedLabor
     */
    function getRewards(bytes32 _deploymentId, address _indexer) external view override returns (uint256, uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];
        uint256 _allocationId = deployment.indexerAllocations[_indexer];
        Allocation memory alloc = allocations[_allocationId];

        (uint256 accRewardsPerAllocatedToken,) = getAccRewardsPerAllocatedToken(
            alloc.deploymentId
        );

        uint256 totalRewards = _calcRewards(
            alloc.amount,
            alloc.accRewardsPerToken,
            accRewardsPerAllocatedToken
        );
        return _fixRewardsWithMissedLabor(totalRewards, alloc);
    }

    /**
     * @notice Fix reward considering missed labor
     * @param _reward reward before fix
     * @param _alloc allocation
     * @return Rewards amount for an allocation
     * @return Rewards burnt due to missedLabor
     */
    function _fixRewardsWithMissedLabor(uint256 _reward, Allocation memory _alloc) internal view returns (uint256, uint256)  {
        uint256 rewardPeriod = block.number - _alloc.lastClaimedAt;
        if (_reward == 0) {
            return (0, 0);
        }
        if (rewardPeriod == 0) {
            return (0, 0);
        }
        uint256 fixedReward = MathUtil.mulDiv(_reward, rewardPeriod - _alloc.missedLabor, rewardPeriod);
        return (fixedReward, _reward - fixedReward);
    }

    /**
     * @dev Calculate current rewards for a given allocation.
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
        return MathUtil.mulDiv(newAccrued,_tokens,FIXED_POINT_SCALING_FACTOR);
    }

    /**
     * @dev Gets the issuance of rewards per signal since last updated.
     *
     * Linear formula: `x = r * t`
     *
     * Notation:
     * t: time steps are in blocks since last updated
     * x: newly accrued rewards tokens for the period `t`
     *
     * @return newly accrued rewards per signal since last update, scaled by FIXED_POINT_SCALING_FACTOR
     */
    function getNewRewardsPerBooster() public view override returns (uint256) {
        // Calculate time steps
        uint256 t = block.number.sub(accRewardsPerBoosterLastBlockUpdated);
        // Optimization to skip calculations if zero time steps elapsed
        if (t == 0) {
            return 0;
        }
        // ...or if issuance is zero
        if (issuancePerBlock == 0) {
            return 0;
        }

        if (totalBoosterPoint == 0) {
            return 0;
        }

        uint256 x = issuancePerBlock * t;

        // Get the new issuance per booster token
        // We multiply the decimals to keep the precision as fixed-point number
        return MathUtil.mulDiv(x, FIXED_POINT_SCALING_FACTOR, totalBoosterPoint);
    }

    /**
     * @dev Gets the currently accumulated rewards per signal.
     * @return Currently accumulated rewards per signal
     */
    function getAccRewardsPerBooster() public view override returns (uint256) {
        return accRewardsPerBooster + getNewRewardsPerBooster();
    }

    /**
     * @notice Updates the accumulated rewards per booster and save checkpoint block number.
     * Must be called before `issuancePerBlock` or `total signalled GRT` changes
     * Called from the Curation contract on mint() and burn()
     * @return Accumulated rewards per signal
     */
    function updateAccRewardsPerBooster() public override returns (uint256) {
        accRewardsPerBooster = getAccRewardsPerBooster();
        accRewardsPerBoosterLastBlockUpdated = block.number;
        return accRewardsPerBooster;
    }

    /**
     * @dev Gets the accumulated rewards for the deployment. including query rewards and allocation rewards
     * @param _deploymentId deployment
     * @return Accumulated rewards for deployment
     */
    function getAccRewardsForDeployment(bytes32 _deploymentId)
    public
    view
    override
    returns (uint256)
    {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        // Only accrue rewards if over a threshold
        uint256 newRewards = (deployment.boosterPoint >= minimumDeploymentBooster) // Accrue new rewards since last snapshot
            ? MathUtil.mulDiv(getAccRewardsPerBooster() - deployment.accRewardsPerBoosterSnapshot
                , deployment.boosterPoint
                , FIXED_POINT_SCALING_FACTOR)
            : 0;
        return deployment.accRewardsForDeployment + newRewards;
    }

    /**
     * @dev Triggers an update of rewards for a deployment.
     * Must be called before booster changes.
     * @param _deploymentId deployment
     * @return Accumulated rewards for deployment
     */
    function onDeploymentBoosterUpdate(bytes32 _deploymentId)
    public
    override
    returns (uint256)
    {
        // Called since `total boosted token` will change
        updateAccRewardsPerBooster();

        // Updates the accumulated rewards
        DeploymentPool storage deployment = deploymentPools[_deploymentId];
        deployment.accRewardsForDeployment = getAccRewardsForDeployment(_deploymentId);
        deployment.accRewardsPerBoosterSnapshot = accRewardsPerBooster;
        // FIXME
        deployment.accQueryRewardsPerBooster = getAccQueryRewardsPerBooster(_deploymentId);

        return deployment.accRewardsForDeployment;
    }

    /**
     * @dev Triggers an update of rewards for a deployment.
     * Must be called before allocation on a subgraph changes.
     * NOTE: Hook called from the Staking contract on allocate() and close()
     *
     * @param _deploymentId deployment
     * @return Accumulated rewards per allocated token for a deployment
     */
    function onAllocationUpdate(bytes32 _deploymentId)
    public
    override
    returns (uint256)
    {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];
        (
            uint256 accRewardsPerAllocatedToken,
            uint256 accRewardsForDeployment
        ) = getAccRewardsPerAllocatedToken(_deploymentId);
        deployment.accRewardsPerAllocatedToken = accRewardsPerAllocatedToken;
        deployment.accRewardsForDeploymentSnapshot = accRewardsForDeployment;
        return deployment.accRewardsPerAllocatedToken;
    }

    /**
    * @dev Gets the accumulated rewards per allocated token for the deployment.
     * @param _deploymentId deployment
     * @return Accumulated rewards per allocated token for the deployment
     * @return Accumulated allocation rewards for deployment
     */
    function getAccRewardsPerAllocatedToken(bytes32 _deploymentId)
    public
    view
    override
    returns (uint256, uint256)
    {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        uint256 accRewardsForDeployment = getAccRewardsForDeployment(_deploymentId);

        uint256 newRewardsForDeployment = MathUtil.diffOrZero(
            accRewardsForDeployment,
            deployment.accRewardsForDeploymentSnapshot
        );

        uint256 deploymentAllocatedTokens = deployment.totalAllocatedToken;
        if (deploymentAllocatedTokens == 0) {
            return (0, accRewardsForDeployment);
        }

        ProjectType projectType = IProjectRegistry(settings.getContractAddress(SQContracts.ProjectRegistry)).getDeploymentProjectType(_deploymentId);
        uint256 allocateRewardRate = PER_MILL - boosterQueryRewardRate[projectType];
        uint256 newAllocRewardsForDeployment = MathUtil.mulDiv(newRewardsForDeployment, allocateRewardRate, PER_MILL);

        uint256 newRewardsPerAllocatedToken = MathUtil.mulDiv(newAllocRewardsForDeployment
            , FIXED_POINT_SCALING_FACTOR
            , deploymentAllocatedTokens);

        return (
            deployment.accRewardsPerAllocatedToken + newRewardsPerAllocatedToken,
            accRewardsForDeployment
        );
    }

    /**
     * @notice Add Labor(online status) for current era project pool
     * @param _deploymentIds deployment id
     * @param _indexers all indexer addresses
     * @param _missedLabors all missed blocks
     */
    function setMissedLabor(bytes32[] calldata _deploymentIds, address[] calldata _indexers, uint256[] calldata _missedLabors) external {
        require(reporters[msg.sender], 'RR007');

        for (uint256 i = 0; i < _indexers.length; i++) {
            DeploymentPool storage deployment = deploymentPools[_deploymentIds[i]];
            uint256 allocationId = deployment.indexerAllocations[_indexers[i]];
            Allocation storage allocation = allocations[allocationId];
            allocation.missedLabor = _missedLabors[i];
            emit MissedLabor(_deploymentIds[i], _indexers[i], _missedLabors[i]);
        }

    }

//    /**
//    * @dev Gets the accumulated rewards per allocated token for the subgraph.
//     * @param _deploymentId deployment
//     * @return Accumulated rewards per allocated token for the deployment
//     * @return Accumulated rewards for deployment
//     */
//    function getAccQueryRewardsPerBoostedToken(bytes32 _deploymentId)
//    public view override returns (uint256, uint256)
//    {
//        DeploymentPool storage deployment = deploymentPools[_deploymentId];
//
//        uint256 accRewardsForDeployment = getAccRewardsForDeployment(_deploymentId);
//        uint256 newRewardsForDeployment = MathUtil.diffOrZero(
//            accRewardsForDeployment,
//            deployment.accRewardsForDeploymentSnapshot
//        );
//
//        uint256 deploymentBoostedToken = deployment.boosterPoint;
//        if (deploymentBoostedToken == 0) {
//            return (0, accRewardsForDeployment);
//        }
//
//        // calc the slice of newRewardsForDeployment for allocation reward
//        ProjectType projectType = IProjectRegistry(settings.getContractAddress(SQContracts.ProjectRegistry)).getDeploymentProjectType(_deploymentId);
//        uint256 allocateRewardRate = PER_MILL - boosterQueryRewardRate[projectType];
//        uint256 newAllocRewardsForDeployment = MathUtil.mulDiv(newRewardsForDeployment, allocateRewardRate, PER_MILL);
//
//        uint256 newRewardsPerAllocatedToken = MathUtil.mulDiv(newAllocRewardsForDeployment
//            , FIXED_POINT_SCALING_FACTOR
//            , deploymentAllocatedTokens);
//        return (
//            deployment.accRewardsPerAllocatedToken + newRewardsPerAllocatedToken,
//            newAllocRewardsForDeployment
//        );
//    }

    // for test purpose
    function collectAllocationReward(bytes32 _deploymentId, address _indexer) external {
        require(msg.sender == _indexer, "not allowed");
        _collectAllocationReward(_deploymentId, _indexer);
    }

    function _collectAllocationReward(bytes32 _deploymentId, address _indexer) internal {
        uint256 accRewardsPerAllocatedToken = onAllocationUpdate(
            _deploymentId
        );
        DeploymentPool storage deployment = deploymentPools[_deploymentId];
        uint256 _allocationId = deployment.indexerAllocations[_indexer];
        Allocation storage alloc = allocations[_allocationId];

        uint256 reward = _calcRewards(
            alloc.amount,
            alloc.accRewardsPerToken,
            accRewardsPerAllocatedToken
        );

        alloc.accRewardsPerToken = accRewardsPerAllocatedToken;
        uint256 burnt;
        (reward, burnt) = _fixRewardsWithMissedLabor(reward, alloc);

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(msg.sender, reward);
        if (burnt > 0) {
            address treasury = ISettings(settings).getContractAddress(SQContracts.Treasury);
            IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(treasury, burnt);
        }
    }

    function getAccQueryRewardsPerBooster(bytes32 _deploymentId) public view returns (uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        uint256 accRewardsForDeployment = getAccRewardsForDeployment(_deploymentId);
        uint256 newRewardsForDeployment = MathUtil.diffOrZero(
            accRewardsForDeployment,
            deployment.accRewardsForDeploymentSnapshot
        );

        uint256 deploymentBoostedToken = deployment.boosterPoint;
        if (deploymentBoostedToken == 0) {
            return 0;
        }

        ProjectType projectType = IProjectRegistry(settings.getContractAddress(SQContracts.ProjectRegistry)).getDeploymentProjectType(_deploymentId);
        uint256 newQueryRewardsForDeployment = MathUtil.mulDiv(newRewardsForDeployment, boosterQueryRewardRate[projectType], PER_MILL);

        uint256 newQueryRewardsPerBooster = MathUtil.mulDiv(newQueryRewardsForDeployment
            , FIXED_POINT_SCALING_FACTOR
            , deploymentBoostedToken);
        return deployment.accQueryRewardsPerBooster + newQueryRewardsPerBooster;
    }

    function getQueryRewards(bytes32 _deploymentId, address _account) external view returns (uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        uint256 accQueryRewardsPerBoostedToken = getAccQueryRewardsPerBooster(_deploymentId);

        return _calcRewards(
            deployment.accountBooster[_account],
            deployment.accQueryRewardsPerBooster,
            accQueryRewardsPerBoostedToken
        );
    }
}
