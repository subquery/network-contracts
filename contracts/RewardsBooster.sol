// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './interfaces/IEraManager.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IRewardsDistributer.sol';
import "./interfaces/IRewardsBooster.sol";
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
    uint256 public totalBoosterPoints;
    mapping(bytes32 => DeploymentPool) public deploymentPools;

    uint256 public accRewardsPerBooster;
    uint256 public accRewardsPerBoosterLastBlockUpdated;
    // @notice projectType => rate (per_mill)
    mapping(uint8 => uint256) public boosterQueryRewardRate;
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
    /// @notice Emitted when add Labor(reward) for current era pool
    event MissedLabor(bytes32 deploymentId, address indexer, uint256 labor);
    event StakeAllocated(uint256 allocationId,bytes32 deploymentId, address indexer, uint256 amount);
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
    }

    /**
     * @notice update the settings
     * @param _settings settings contract address
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @notice add booster deployment staking
     * modify eraPool and deployment map
     * @param deployment the deployment id
     * @param amount the added amount
     */
    function boostDeployment(bytes32 deployment, uint256 amount) external {
        DeploymentPool storage deploymentPool = deploymentPools[deployment];
        uint256 accRewardsPerBooster = onDeploymentBoosterUpdate(deployment);
        // collect
        uint256 reward = _pullReward(deployment, deploymentPool.accRewardsPerBooster, accRewardsPerBooster);
        deploymentPool.boosterPoints += amount;
        deploymentPool.boosterMap[msg.sender] += amount;
        deploymentPool.accRewardsPerBooster = accRewardsPerBooster;
        // totalBoosterPoints
        totalBoosterPoints += amount;

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice remove booster from deployment
     * @param deployment deploymentId
     * @param amount the added amount
     */
    function removeBoosterDeployment(bytes32 deployment, uint256 amount) external {
        DeploymentPool storage deploymentPool = deploymentPools[deployment];
        require(deploymentPool.boosterMap[msg.sender] >= amount, "not enough");

        uint256 accRewardsPerBooster = onDeploymentBoosterUpdate(deployment);
        // collect
        uint256 reward = _pullReward(deployment, deploymentPool.accRewardsPerBooster, accRewardsPerBooster);
        deploymentPool.boosterPoints -= amount;
        deploymentPool.boosterMap[msg.sender] -= amount;
        deploymentPool.accRewardsPerBooster = accRewardsPerBooster;
        // totalBoosterPoints
        totalBoosterPoints -= amount;

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(msg.sender, amount);
    }

    function getIndexerDeploymentBooster(bytes32 _deploymentId, address _indexer) public view returns (uint256) {
        return deploymentPools[_deploymentId].boosterMap[_indexer];
    }

    function _pullReward(bytes32 _deploymentId, uint256 previousAccRewards, uint256 newAccRewards) internal returns (uint256) {
        return 0;
    }

    function getCapacity(address _indexer) view public returns (uint256)  {
        IStakingManager staking = IStakingManager(settings.getContractAddress(SQContracts.StakingManager));
        return MathUtil.diffOrZero(staking.getTotalStakingAmount(_indexer), indexerAllocated[_indexer]);
    }

    function allocate(bytes32 deployment, address indexer, uint256 amount) external {
        require(msg.sender == indexer, "not indexer");
        uint256 capacity = getCapacity(indexer);
        require(capacity >= amount, "not enough capacity");
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        uint256 era = eraManager.safeUpdateAndGetEra();
        DeploymentPool storage deploymentPool = deploymentPools[deployment];
        uint256 allocationId = deploymentPool.indexerAllocations[indexer];

        if (allocationId == 0) {
            allocations[nextAllocationId] = Allocation({
                indexer: indexer,
                deploymentId: deployment,
                amount: 0,
                missedLabor: 0,
                accRewardsPerToken: onAllocationUpdate(deployment),
                startEra: era,
                startTime: block.timestamp
            });
            allocationId = nextAllocationId;
            nextAllocationId += 1;
        }
        emit StakeAllocated(allocationId, deployment, indexer, amount);
        // collect reward
//        _collectReward(indexer, allocations[allocationId].accRewardsPerToken, accRewardsPerToken);
        deploymentPool.totalAllocatedToken += amount;
        allocations[allocationId].amount += amount;
    }

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
    * @dev Calculate current rewards for a given allocation on demand.
     * @param _allocationId Allocation
     * @return Rewards amount for an allocation
     */
    function getRewards(uint256 _allocationId) external view override returns (uint256) {

        Allocation memory alloc = allocations[_allocationId];

        (uint256 accRewardsPerAllocatedToken, ) = getAccRewardsPerAllocatedToken(
            alloc.deploymentId
        );
        return
            _calcRewards(
            alloc.amount,
            alloc.accRewardsPerToken,
            accRewardsPerAllocatedToken
        );
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

        if (totalBoosterPoints == 0) {
            return 0;
        }

        uint256 x = issuancePerBlock * t;

        // Get the new issuance per booster token
        // We multiply the decimals to keep the precision as fixed-point number
        return MathUtil.mulDiv(x, FIXED_POINT_SCALING_FACTOR, totalBoosterPoints);
    }

    /**
     * @dev Gets the currently accumulated rewards per signal.
     * @return Currently accumulated rewards per signal
     */
    function getAccRewardsPerBooster() public view override returns (uint256) {
        return accRewardsPerBooster + getNewRewardsPerBooster();
    }

    /**
     * @notice Updates the accumulated rewards per signal and save checkpoint block number.
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
     * @dev Gets the accumulated rewards for the subgraph.
     * @param _deploymentId deployment
     * @return Accumulated rewards for subgraph
     */
    function getAccRewardsForDeployment(bytes32 _deploymentId)
    public
    view
    override
    returns (uint256)
    {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        // Only accrue rewards if over a threshold
        uint256 newRewards = (deployment.boosterPoints >= minimumDeploymentBooster) // Accrue new rewards since last snapshot
            ? MathUtil.mulDiv(getAccRewardsPerBooster() - deployment.accRewardsPerBoosterSnapshot
                , deployment.boosterPoints
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

        // Updates the accumulated rewards for a subgraph
        DeploymentPool storage deployment = deploymentPools[_deploymentId];
        deployment.accRewardsForDeployment = getAccRewardsForDeployment(_deploymentId);
        deployment.accRewardsPerBoosterSnapshot = accRewardsPerBooster;
        return deployment.accRewardsForDeployment;
    }

    /**
     * @dev Triggers an update of rewards for a subgraph.
     * Must be called before allocation on a subgraph changes.
     * NOTE: Hook called from the Staking contract on allocate() and close()
     *
     * @param _deploymentId deployment
     * @return Accumulated rewards per allocated token for a subgraph
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
    * @dev Gets the accumulated rewards per allocated token for the subgraph.
     * @param _deploymentId deployment
     * @return Accumulated rewards per allocated token for the deployment
     * @return Accumulated rewards for deployment
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

        uint256 newRewardsPerAllocatedToken = MathUtil.mulDiv(newRewardsForDeployment
            , FIXED_POINT_SCALING_FACTOR
            , deploymentAllocatedTokens);
        return (
            deployment.accRewardsPerAllocatedToken + newRewardsPerAllocatedToken,
            newRewardsForDeployment
        );
    }

    /**
     * @notice Add Labor(online status) for current era project pool
     * @param _deploymentIds deployment id
     * @param _indexers all indexer addresses
     * @param _missedLabors all missed labor
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
//     * @notice Collect reward (stake) from previous era Pool
//     * @param projectId deployment id
//     * @param indexer indexer address
//     */
//    function collect(uint256 projectId, address indexer) external {
//        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
//        _collect(currentEra - 1, projectId, indexer);
//    }
//
//    /**
//     * @notice Collect reward (stake) from era pool
//     * @param era era number
//     * @param projectId deployment id
//     * @param indexer indexer address
//     */
//    function collectEra(uint256 era, uint256 projectId, address indexer) external {
//        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
//        require(currentEra > era, 'RR008');
//        _collect(era, projectId, indexer);
//    }
//
//    /**
//     * @notice Batch collect all deployments from previous era Pool
//     * @param indexer indexer address
//     */
//    function batchCollect(address indexer) external {
//        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
//        EraPool storage eraPool = pools[currentEra - 1];
//        IndexerProject storage indexerProject = eraPool.indexerUnclaimProjects[indexer];
//        uint lastIndex = indexerProject.unclaim;
//        for (uint i = lastIndex; i > 0; i--) {
//            uint256 projectId = indexerProject.projects[i];
//            _collect(currentEra - 1, projectId, indexer);
//        }
//    }
//
//    /**
//     * @notice Determine is the pool claimed on the era
//     * @param era era number
//     * @param indexer indexer address
//     * @return bool is claimed or not
//     */
//    function isClaimed(uint256 era, address indexer) external view returns (bool) {
//        return pools[era].indexerUnclaimProjects[indexer].unclaim == 0;
//    }
//
//    /**
//     * @notice Get unclaim deployments for the era
//     * @param era era number
//     * @param indexer indexer address
//     * @return uint256List list of projectIds
//     */
//    function getUnclaimDeployments(uint256 era, address indexer) external view returns (uint256[] memory) {
//        return pools[era].indexerUnclaimProjects[indexer].projects;
//    }
//
//    /// @notice work for collect() and collectEra()
//    function _collect(uint256 era, uint256 projectId, address indexer) private {
//        require(basicProjectShares[projectId] > 0 || boosterProjectStakings[projectId].amount > 0, 'RR015');
//
//        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
//
//        EraPool storage eraPool = pools[era];
//        ProjectPool storage pool = eraPool.pools[projectId];
//
//        // calc total reward for this project if it is first time to collect
//        if (pool.totalReward == 0) {
//            uint256 basicInflationReward = eraPool.basicInflationReward * basicProjectShares[projectId] / 100;
//            uint256 boosterInflationReward = eraPool.boosterInflationReward * boosterProjectStakings[projectId].amount / totalBoosterProjectStaking;
//            pool.totalReward = pool.extraReward + basicInflationReward + boosterInflationReward;
//            pool.unclaimReward = pool.totalReward;
//            eraPool.unactivedProject -= 1;
//        }
//
//        // check if all project share had been actived
//        if (eraPool.unactivedProject == 0) {
//            latestActivedEra += 1;
//        }
//
//        // this is to prevent duplicated collect
//        require(pool.totalStake > 0 && pool.totalReward > 0 && pool.labor[indexer] > 0, 'RR009');
//
//        uint256 amount = _cobbDouglas(pool.totalReward, pool.labor[indexer], pool.stake[indexer], pool.totalStake);
//
//        // reward send to distribute
//        address rewardDistributer = settings.getContractAddress(SQContracts.RewardsDistributer);
//        IRewardsDistributer distributer = IRewardsDistributer(rewardDistributer);
//        IERC20(settings.getContractAddress(SQContracts.SQToken)).approve(rewardDistributer, amount);
//        if (amount > 0) {
//            // reward send to CURRENT era
//            distributer.addInstantRewards(indexer, address(this), amount, currentEra);
//        }
//
//        // update indexer project list
//        IndexerProject storage indexerProject = eraPool.indexerUnclaimProjects[indexer];
//        uint index = indexerProject.index[projectId];
//        uint256 lastProject = indexerProject.projects[indexerProject.unclaim];
//        indexerProject.projects[index] = lastProject;
//        indexerProject.projects.pop();
//        indexerProject.index[lastProject] = index;
//        delete indexerProject.index[projectId];
//        indexerProject.unclaim -= 1;
//        if (indexerProject.unclaim == 0) {
//            delete eraPool.indexerUnclaimProjects[indexer];
//        }
//
//        pool.unclaimTotalLabor -= pool.labor[indexer];
//        pool.unclaimReward -= amount;
//        delete pool.labor[indexer];
//        delete pool.stake[indexer];
//
//        if (pool.unclaimTotalLabor == 0) {
//            // the remained send to current era
//            if (pool.unclaimReward > 0) {
//                EraPool storage nextEraPool = pools[currentEra];
//                ProjectPool storage nextPool = nextEraPool.pools[projectId];
//                nextPool.extraReward += pool.unclaimReward;
//            }
//
//            delete eraPool.pools[projectId];
//            eraPool.unclaimProject -= 1;
//
//            // if unclaimed pool == 0, delete the era
//            if (eraPool.unclaimProject == 0) {
//                delete pools[era];
//            }
//        }
//
//        emit Collect(era, projectId, indexer, amount);
//    }

    /// @notice The cobb-doublas function has the form:
    /// @notice `reward * feeRatio ^ alpha * stakeRatio ^ (1-alpha)`
    /// @notice This is equivalent to:
    /// @notice `reward * stakeRatio * e^(alpha * (ln(feeRatio / stakeRatio)))`
    /// @notice However, because `ln(x)` has the domain of `0 < x < 1`
    /// @notice and `exp(x)` has the domain of `x < 0`,
    /// @notice and fixed-point math easily overflows with multiplication,
    /// @notice we will choose the following if `stakeRatio > feeRatio`:
    /// @notice `reward * stakeRatio / e^(alpha * (ln(stakeRatio / feeRatio)))`
    function _cobbDouglas(uint256 reward, uint256 myLabor, uint256 myStake, uint256 totalStake) private view returns (uint256) {
        if (myStake == totalStake) {
            return reward;
        }

        int256 feeRatio = FixedMath.toFixed(myLabor, reward);
        int256 stakeRatio = FixedMath.toFixed(myStake, totalStake);
        if (feeRatio == 0 || stakeRatio == 0) {
            return 0;
        }

        // Compute
        // `e^(alpha * ln(feeRatio/stakeRatio))` if feeRatio <= stakeRatio
        // or
        // `e^(alpa * ln(stakeRatio/feeRatio))` if feeRatio > stakeRatio
        int256 n = feeRatio <= stakeRatio
            ? FixedMath.div(feeRatio, stakeRatio)
            : FixedMath.div(stakeRatio, feeRatio);
        n = FixedMath.exp(
            FixedMath.mulDiv(
                FixedMath.ln(n),
                int256(alphaNumerator),
                int256(alphaDenominator)
            )
        );
        // Compute
        // `reward * n` if feeRatio <= stakeRatio
        // or
        // `reward / n` if stakeRatio > feeRatio
        // depending on the choice we made earlier.
        n = feeRatio <= stakeRatio
            ? FixedMath.mul(stakeRatio, n)
            : FixedMath.div(stakeRatio, n);
        // Multiply the above with reward.
        return FixedMath.uintMul(n, reward);
    }
}
