// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
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

    /// @notice ### STATES
    /// @notice Settings info
    ISettings public settings;

    /// @notice Allowlist reporters
    mapping(address => bool) public reporters;

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
    // --------- allocation end

    /// @notice ### EVENTS
    event DeploymentBoosterAdded(bytes32 indexed deploymentId, address indexed account, uint256 amount);
    event DeploymentBoosterRemoved(bytes32 indexed deploymentId, address indexed account, uint256 amount);
    /// @notice Emitted when add Labor(reward) for current era pool
    event MissedLabor(bytes32 indexed deploymentId, address indexed indexer, uint256 labor);
//    event StakeAllocated(uint256 allocationId, bytes32 deploymentId, address indexer, uint256 amount);
    event AllocationRewardsGiven(bytes32 indexed deploymentId, address indexed indexer, uint256 amount);
    event AllocationRewardsBurnt(bytes32 indexed deploymentId, address indexed indexer, uint256 amount);
    /**
     * @notice ### FUNCTIONS
     * @notice Initialize the contract
     * @param _settings settings contract address
     */
    function initialize(ISettings _settings, uint256 _issuancePerBlock, uint256 _minimumDeploymentBooster) external initializer {
        __Ownable_init();

        settings = _settings;
        issuancePerBlock = _issuancePerBlock;
        minimumDeploymentBooster = _minimumDeploymentBooster;
    }

    function setTokenApproval() external onlyOwner {
        IERC20(settings.getContractAddress(SQContracts.SQToken))
            .approve(ISettings(settings).getContractAddress(SQContracts.RewardsDistributer), MAX_UINT256);
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
        address boosterAccount = msg.sender;
        DeploymentPool storage deploymentPool = deploymentPools[_deploymentId];
        onDeploymentBoosterUpdate(_deploymentId, boosterAccount);
        deploymentPool.boosterPoint += _amount;
        deploymentPool.accountBooster[boosterAccount] += _amount;
        deploymentPool.accRewardsPerBooster = accRewardsPerBooster;
        // totalBoosterPoints
        totalBoosterPoint += _amount;

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(boosterAccount, address(this), _amount);
        emit DeploymentBoosterAdded(_deploymentId, boosterAccount, _amount);
    }

    /**
     * @notice remove booster from deployment
     * @param deployment deploymentId
     * @param amount the added amount
     */
    function removeBoosterDeployment(bytes32 deployment, uint256 amount) external {
        DeploymentPool storage deploymentPool = deploymentPools[deployment];
        require(deploymentPool.accountBooster[msg.sender] >= amount, "not enough");

        onDeploymentBoosterUpdate(deployment, msg.sender);
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

    /**
     * @notice update the reporter status
     * @param reporter reporter address
     * @param allow reporter allow or not
     */
    function setReporter(address reporter, bool allow) external onlyOwner {
        reporters[reporter] = allow;
    }

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
        IStakingAllocation sa = IStakingAllocation(settings.getContractAddress(SQContracts.StakingAllocation));
        uint256 indexerAllocAmount = sa.allocation(_indexer, _deploymentId);

        IndexerDeploymentReward memory indexerDeplReward = deployment.indexerAllocationRewards[_indexer];

        (uint256 accRewardsPerAllocatedToken,) = getAccRewardsPerAllocatedToken(_deploymentId);

        uint256 totalRewards = _calcRewards(
            indexerAllocAmount,
            indexerDeplReward.accRewardsPerToken,
            accRewardsPerAllocatedToken
        );

        return _fixRewardsWithMissedLaborAndOverflow(totalRewards, indexerDeplReward, sa.overflowTime(_indexer));
    }

    /**
     * @notice Fix reward considering missed labor
     * @param _reward reward before fix
     * @param _indexerDepReward IndexerDeploymentReward
     * @return Rewards amount for an allocation
     * @return Rewards burnt due to missedLabor
     */
    function _fixRewardsWithMissedLaborAndOverflow(uint256 _reward, IndexerDeploymentReward memory _indexerDepReward, uint256 overflowTime) internal view returns (uint256, uint256)  {
        uint256 rewardPeriod = block.timestamp - _indexerDepReward.lastClaimedAt;
        if (_reward == 0) {
            return (0, 0);
        }
        if (rewardPeriod == 0) {
            return (0, 0);
        }

        uint256 fixedRewardByMissedLabor = MathUtil.mulDiv(_reward, rewardPeriod - _indexerDepReward.missedLaborTime, rewardPeriod);
        uint256 fixedReward = MathUtil.mulDiv(fixedRewardByMissedLabor, rewardPeriod - overflowTime, rewardPeriod);
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
     * @notice Gets the currently accumulated rewards per signal.
     * @return Currently accumulated rewards per signal
     */
    function getAccRewardsPerBooster() public view override returns (uint256) {
        return accRewardsPerBooster + getNewRewardsPerBooster();
    }

    /**
     * @notice Updates the accumulated rewards per booster and save checkpoint block number.
     * Must be called before `issuancePerBlock` or `total booster` changes
     * @return Accumulated rewards per boosted token
     */
    function updateAccRewardsPerBooster() public override returns (uint256) {
        accRewardsPerBooster = getAccRewardsPerBooster();
        accRewardsPerBoosterLastBlockUpdated = block.number;
        return accRewardsPerBooster;
    }

    /**
     * @notice Gets the accumulated rewards for the deployment. including query rewards and allocation rewards
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
     * @notice Triggers an update of rewards for a deployment.
     * Must be called before booster changes.
     * @param _deploymentId deployment
     * @return Accumulated rewards for deployment
     */
    function onDeploymentBoosterUpdate(bytes32 _deploymentId, address _account)
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

        // update accQueryRewards
        BoosterQueryReward storage boosterQueryReward = deployment.boosterQueryRewards[_account];
        (uint256 accQueryRewardsPerBooster, uint256 accRewardsForDeploymentSnapshot) = getAccQueryRewardsPerBooster(_deploymentId);
//        console.log(
//            "2)accQueryRewardsPerBooster %s",
//            accQueryRewardsPerBooster
//        );
        boosterQueryReward.accQueryRewards = getAccQueryRewards(_deploymentId, _account);// getAccQueryRewards(_deploymentId, _account);
        boosterQueryReward.accQueryRewardsPerBoosterSnapshot = accQueryRewardsPerBooster;
        deployment.accQueryRewardsPerBooster = accQueryRewardsPerBooster;
        deployment.accQueryRewardsForDeploymentSnapshot = accRewardsForDeploymentSnapshot;

        return deployment.accRewardsForDeployment;
    }

    /**
     * @notice Triggers an update of rewards for a deployment.
     * Must be called before allocation on a deployment changes.
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
    * @notice Gets the accumulated rewards per allocated token for the deployment.
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

        IStakingAllocation sa = IStakingAllocation(settings.getContractAddress(SQContracts.StakingAllocation));
        uint256 deploymentAllocatedTokens = sa.deploymentAllocations(_deploymentId);
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
     * @param _missedLabors all missed labor seconds
     */
    function setMissedLabor(bytes32[] calldata _deploymentIds, address[] calldata _indexers, uint256[] calldata _missedLabors) external {
        require(reporters[msg.sender], 'RR007');

        for (uint256 i = 0; i < _indexers.length; i++) {
            DeploymentPool storage deployment = deploymentPools[_deploymentIds[i]];
            IndexerDeploymentReward storage indexerDeplReward = deployment.indexerAllocationRewards[_indexers[i]];
            indexerDeplReward.missedLaborTime = _missedLabors[i];
            emit MissedLabor(_deploymentIds[i], _indexers[i], _missedLabors[i]);
        }

    }

    // for test purpose
    function collectAllocationReward(bytes32 _deploymentId, address _indexer) override external {
        require(msg.sender == _indexer || msg.sender == settings.getContractAddress(SQContracts.StakingAllocation), "not allowed");
        _collectAllocationReward(_deploymentId, _indexer);
    }

    function _collectAllocationReward(bytes32 _deploymentId, address _indexer) internal {
        uint256 accRewardsPerAllocatedToken = onAllocationUpdate(
            _deploymentId
        );
        DeploymentPool storage deployment = deploymentPools[_deploymentId];
        IStakingAllocation sa = IStakingAllocation(settings.getContractAddress(SQContracts.StakingAllocation));
        uint256 indexerAllocAmount = sa.allocation(_indexer, _deploymentId);
        IndexerDeploymentReward storage indexerDeplReward = deployment.indexerAllocationRewards[_indexer];
        uint256 reward = _calcRewards(
            indexerAllocAmount,
            indexerDeplReward.accRewardsPerToken,
            accRewardsPerAllocatedToken
        );

        indexerDeplReward.accRewardsPerToken = accRewardsPerAllocatedToken;
        uint256 burnt;
        (reward, burnt) = _fixRewardsWithMissedLaborAndOverflow(reward, indexerDeplReward, sa.overflowTime(_indexer));
        sa.overflowClear(_indexer, _deploymentId);
        indexerDeplReward.lastClaimedAt = block.timestamp;

        address treasury = ISettings(settings).getContractAddress(SQContracts.Treasury);
        IRewardsDistributer rewardsDistributer = IRewardsDistributer(ISettings(settings).getContractAddress(SQContracts.RewardsDistributer));
        IEraManager eraManager = IEraManager(ISettings(settings).getContractAddress(SQContracts.EraManager));
//        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(treasury, msg.sender, reward);
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(treasury, address(this), reward);
        rewardsDistributer.addInstantRewards(_indexer, address(this), reward, eraManager.safeUpdateAndGetEra());
        emit AllocationRewardsGiven(_deploymentId, _indexer, reward);
        if (burnt > 0) {
//            IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(treasury, treasury, burnt);
             emit AllocationRewardsBurnt(_deploymentId, _indexer, burnt);
        }
    }

    function getAccQueryRewardsPerBooster(bytes32 _deploymentId) public view returns (uint256, uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        uint256 accRewardsForDeployment = getAccRewardsForDeployment(_deploymentId);
//        console.log(
//            "3)accRewardsForDeployment %s",
//            accRewardsForDeployment
//        );
//        console.log(
//            "3)deployment.accQueryRewardsForDeploymentSnapshot %s",
//            deployment.accQueryRewardsForDeploymentSnapshot
//        );
        uint256 newRewardsForDeployment = MathUtil.diffOrZero(
            accRewardsForDeployment,
            deployment.accQueryRewardsForDeploymentSnapshot
        );
//        console.log(
//            "3)newRewardsForDeployment %s",
//            newRewardsForDeployment
//        );

        uint256 deploymentBoostedToken = deployment.boosterPoint;
        if (deploymentBoostedToken == 0) {
            return (0, accRewardsForDeployment);
        }

//        console.log(
//            "3)deploymentBoostedToken %s",
//            deploymentBoostedToken
//        );
        ProjectType projectType = IProjectRegistry(settings.getContractAddress(SQContracts.ProjectRegistry)).getDeploymentProjectType(_deploymentId);
        uint256 newQueryRewardsForDeployment = MathUtil.mulDiv(newRewardsForDeployment, boosterQueryRewardRate[projectType], PER_MILL);
//        console.log(
//            "3)newQueryRewardsForDeployment %s",
//            newQueryRewardsForDeployment
//        );
        uint256 newQueryRewardsPerBooster = MathUtil.mulDiv(newQueryRewardsForDeployment
            , FIXED_POINT_SCALING_FACTOR
            , deploymentBoostedToken);
//        console.log(
//            "3)newQueryRewardsPerBooster %s",
//            newQueryRewardsPerBooster
//        );
//        console.log(
//            "3)deployment.accQueryRewardsPerBooster %s",
//            deployment.accQueryRewardsPerBooster
//        );
        return (deployment.accQueryRewardsPerBooster + newQueryRewardsPerBooster, accRewardsForDeployment);
    }

    function getQueryRewards(bytes32 _deploymentId, address _account) public view returns (uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        (uint256 accQueryRewardsPerBoostedToken,) = getAccQueryRewardsPerBooster(_deploymentId);

        uint256 newRewards = _calcRewards(
            deployment.accountBooster[_account],
            deployment.boosterQueryRewards[_account].accQueryRewardsPerBoosterSnapshot,
            accQueryRewardsPerBoostedToken
        );
        BoosterQueryReward memory boosterQueryRewards = deployment.boosterQueryRewards[_account];
        return boosterQueryRewards.accQueryRewards + newRewards - boosterQueryRewards.spentQueryRewards;
    }

    function getAccQueryRewards(bytes32 _deploymentId, address _account) public view returns (uint256) {
        DeploymentPool storage deployment = deploymentPools[_deploymentId];

        (uint256 accQueryRewardsPerBoostedToken,) = getAccQueryRewardsPerBooster(_deploymentId);
        BoosterQueryReward memory boosterQueryRewards = deployment.boosterQueryRewards[_account];

        uint256 newRewards = _calcRewards(
            deployment.accountBooster[_account],
            boosterQueryRewards.accQueryRewardsPerBoosterSnapshot,
            accQueryRewardsPerBoostedToken
        );
        return boosterQueryRewards.accQueryRewards + newRewards;
    }

    /**
     * FIXME: for testing purpose
     */
    function spendQueryRewards(bytes32 _deploymentId, uint256 _amount) external {
        address spender = msg.sender;
        require(getQueryRewards(_deploymentId, spender) >= _amount, "no enough query rewards");
        DeploymentPool storage deployment = deploymentPools[_deploymentId];
        BoosterQueryReward storage boosterQueryRewards = deployment.boosterQueryRewards[spender];
        boosterQueryRewards.spentQueryRewards += _amount;

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(msg.sender, _amount);
    }

    function getBoosterQueryRewards(bytes32 _deploymentId, address _account) view external returns (BoosterQueryReward memory)  {
        return deploymentPools[_deploymentId].boosterQueryRewards[_account];
    }

    function spendQueryRewards(address _indexer, uint256 amount) external returns (uint256) {
        require(msg.sender == settings.getContractAddress(SQContracts.StateChannel), 'RB01');

        // TODO check balance & amount
        uint256 balance = IERC20(settings.getContractAddress(SQContracts.SQToken)).balanceOf(address(this)); // MOCK
        if (balance < amount) {
            amount = balance;
        }

        // Allowance
        IERC20(settings.getContractAddress(SQContracts.SQToken)).approve(msg.sender, amount);

        return amount;
    }

    function refundQueryRewards(address _indexer, uint256 amount) external {
        require(msg.sender == settings.getContractAddress(SQContracts.StateChannel), 'RB01');
        // TODO
    }
}
