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
import './interfaces/IProjectRegistry.sol';
import './interfaces/IRewardsDistributer.sol';
import './utils/FixedMath.sol';
import './utils/MathUtil.sol';
import './utils/StakingUtil.sol';

/**
 * @title Rewards for running
 * @notice ### Overview
 * The RewardsRunning using the Cobb-Douglas production function for staking & running
 */
contract RewardsRunning is Initializable, OwnableUpgradeable {
    using ERC165CheckerUpgradeable for address;
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    /// @notice Project Running Reward Pool
    struct ProjectPool {
        // inflation reward
        uint256 totalReward;
        // extra amount of the project
        uint256 extraReward;
        // total staking in this Pool
        uint256 totalStake;
        // total labor in this Pool
        uint256 totalLabor;
        // total unclaimed labor
        uint256 unclaimTotalLabor;
        // total unclaimed reward, if has remian, will send to next era extraReward
        uint256 unclaimReward;
        // staking: indexer => staking amount
        mapping(address => uint256) stake;
        // labor: indexer => Labor reward (online times (minutes))
        mapping(address => uint256) labor;
    }

    /// @notice Indexer Project
    struct IndexerProject {
        // unclaimed project count
        uint unclaim;
        // projects list
        uint256[] projects;
        // project list index
        mapping(uint256 => uint) index;
    }

    /// @notice Era Reward Pool
    struct EraPool {
        // total reward for all project by inflation
        uint256 inflationReward;
        // record the unclaimed project
        uint256 unclaimProject;
        // record the indexer joined projects, and check if all is claimed
        mapping(address => IndexerProject) indexerUnclaimProjects;
        // storage all pools by project: project id => ProjectPool
        mapping(uint256 => ProjectPool) pools;
    }

    /// @dev ### STATES
    /// @notice Settings info
    ISettings public settings;

    /// @notice Era Rewards Pools: era => Era Pool
    mapping(uint256 => EraPool) private pools;
    /// @notice project shares in all rewards
    mapping(uint256 => uint256) public projectShares;
    /// @notice project type shares in all rewards
    mapping(ProjectType => uint256) public projectTypeShares;
    /// @notice Allowlist reporters
    mapping(address => bool) public reporters;

    /// @notice the numerator of Percentage of the stake and labor (1-alpha) in the total
    int32 public alphaNumerator;
    /// @notice the denominator of the alpha
    int32 public alphaDenominator;

    /// @dev ### EVENTS
    /// @notice Emitted when update the alpha for cobb-douglas function
    event Alpha(int32 alphaNumerator, int32 alphaDenominator);
    /// @notice Emitted when add Labor(reward) for current era pool
    event Labor(uint256 era, uint256 projectId, address indexer, uint256 labor, uint256 total);
    /// @notice Emitted when collect reward (stake) from era pool
    event Collect(uint256 era, uint256 projectId, address indexer, uint256 reward);
    /// @notice Emitted when extra reward to the era project pool
    event ExtraReward(uint256 era, uint256 projectId, address sender, uint256 amount);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract, setup the alphaNumerator, alphaDenominator
     * @param _settings settings contract address
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        alphaNumerator = 1;
        alphaDenominator = 3;
        settings = _settings;
    }

    /**
     * @notice update the settings
     * @param _settings settings contract address
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @notice update the project shares
     * @param projects all project ids
     * @param shares all project shares
     * @param deleted deleted projects
     */
    function setProjectShare(uint256[] calldata projects, uint256[] calldata shares, uint256[] calldata deleted) external onlyOwner {
        require(projects.length == shares.length, 'RR003');
        uint256 totalShare = 0;
        for(uint256 i = 0; i < projects.length; i++) {
            projectShares[projects[i]] = shares[i];
            totalShare += shares[i];
        }
        require(totalShare == 100, 'RR004');

        for(uint256 i = 0; i < deleted.length; i++) {
            delete projectShares[deleted[i]];
        }
    }

    /**
     * @notice update the project type shares
     * @param types all project types
     * @param shares project types shares
     */
    function setProjectTypeShare(ProjectType[] calldata types, uint256[] calldata shares) external onlyOwner {
        require(types.length == shares.length, 'RR005');
        uint256 totalShare = 0;
        for(uint256 i = 0; i < types.length; i++) {
            projectTypeShares[types[i]] = shares[i];
            totalShare += shares[i];
        }
        require(totalShare == 100, 'RR006');
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

    /**
     * @notice get the Pool reward by projectId, era and indexer. returns my labor and total reward
     * @param era era number
     * @param projectId project id
     * @param indexer indexer address
     */
    function getReward(uint256 era, uint256 projectId, address indexer) public view returns (uint256, uint256) {
        EraPool storage eraPool = pools[era];
        ProjectPool storage pool = eraPool.pools[projectId];

        IProjectRegistry projectRegistry = IProjectRegistry(settings.getContractAddress(SQContracts.ProjectRegistry));
        ProjectType projectType = projectRegistry.projectInfo(projectId).projectType;
        uint256 totalReward = pool.extraReward + eraPool.inflationReward * projectShares[projectId] / 100 * projectTypeShares[projectType] / 100;

        return (pool.labor[indexer], totalReward);
    }

    /**
     * @notice add extra reward to the current era project
     * @param projectId the project id
     * @param amount the amount of extra reward
     */
    function extraReward(uint256 projectId, uint256 amount) external {
        require(amount > 0, 'RR002');
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(msg.sender, address(this), amount);

        uint256 era = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        EraPool storage eraPool = pools[era];
        ProjectPool storage pool = eraPool.pools[projectId];
        pool.extraReward += amount;

        emit ExtraReward(era, projectId, msg.sender, amount);
    }

    /**
     * @notice Add Labor(online status) for current era project pool
     * @param projectId project id
     * @param indexers all indexer addresses
     */
    function labor(uint256 projectId, address[] calldata indexers) external {
        require(reporters[msg.sender], 'RR007');

        uint256 era = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        EraPool storage eraPool = pools[era];
        ProjectPool storage pool = eraPool.pools[projectId];

        // project created firstly.
        if (pool.totalLabor == 0) {
            eraPool.unclaimProject += 1;
        }

        for(uint256 i = 0; i < indexers.length; i++) {
            address indexer = indexers[i];

            // indexer joined the deployment pool firstly.
            if (pool.labor[indexer] == 0) {
                IStakingManager stakingManager = IStakingManager(settings.getContractAddress(SQContracts.StakingManager));
                uint256 myStake = stakingManager.getTotalStakingAmount(indexer);
                if (myStake == 0) {
                    // skip change, this indexer can not claim, the remain reward will send to next era pool
                    pool.totalLabor += 1;
                    continue;
                }
                pool.stake[indexer] = myStake;
                pool.totalStake += myStake;
            }

            // update projrects list
            IndexerProject storage indexerProject = eraPool.indexerUnclaimProjects[indexer];
            if (indexerProject.projects.length == 0) {
                indexerProject.projects.push(0); // only for skip 0;
            }
            if (indexerProject.index[projectId] == 0) {
                indexerProject.unclaim += 1;
                indexerProject.projects.push(projectId);
                indexerProject.index[projectId] = indexerProject.unclaim;
            }

            pool.labor[indexer] += 1;
            pool.totalLabor += 1;
            pool.unclaimTotalLabor += 1;

            emit Labor(era, projectId, indexer, pool.labor[indexer], pool.totalLabor);
        }
    }

    /**
     * @notice Collect reward (stake) from previous era Pool
     * @param projectId deployment id
     * @param indexer indexer address
     */
    function collect(uint256 projectId, address indexer) external {
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        _collect(currentEra - 1, projectId, indexer);
    }

    /**
     * @notice Collect reward (stake) from era pool
     * @param era era number
     * @param projectId deployment id
     * @param indexer indexer address
     */
    function collectEra(uint256 era, uint256 projectId, address indexer) external {
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        require(currentEra > era, 'RR008');
        _collect(era, projectId, indexer);
    }

    /**
     * @notice Batch collect all deployments from previous era Pool
     * @param indexer indexer address
     */
    function batchCollect(address indexer) external {
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        EraPool storage eraPool = pools[currentEra - 1];
        IndexerProject storage indexerProject = eraPool.indexerUnclaimProjects[indexer];
        uint lastIndex = indexerProject.unclaim;
        for (uint i = lastIndex; i > 0; i--) {
            uint256 projectId = indexerProject.projects[i];
            _collect(currentEra - 1, projectId, indexer);
        }
    }

    /**
     * @notice Determine is the pool claimed on the era
     * @param era era number
     * @param indexer indexer address
     * @return bool is claimed or not
     */
    function isClaimed(uint256 era, address indexer) external view returns (bool) {
        return pools[era].indexerUnclaimProjects[indexer].unclaim == 0;
    }

    /**
     * @notice Get unclaim deployments for the era
     * @param era era number
     * @param indexer indexer address
     * @return uint256List list of projectIds
     */
    function getUnclaimDeployments(uint256 era, address indexer) external view returns (uint256[] memory) {
        return pools[era].indexerUnclaimProjects[indexer].projects;
    }

    /// @notice work for collect() and collectEra()
    function _collect(uint256 era, uint256 projectId, address indexer) private {
        EraPool storage eraPool = pools[era];
        ProjectPool storage pool = eraPool.pools[projectId];

        // calc total reward for this project if it is first time to collect
        if (pool.totalReward == 0) {
            IProjectRegistry projectRegistry = IProjectRegistry(settings.getContractAddress(SQContracts.ProjectRegistry));
            ProjectType projectType = projectRegistry.projectInfo(projectId).projectType;
            pool.totalReward = pool.extraReward + eraPool.inflationReward * projectShares[projectId] / 100 * projectTypeShares[projectType] / 100;
            pool.unclaimReward = pool.totalReward;
        }

        // this is to prevent duplicated collect
        require(pool.totalStake > 0 && pool.totalReward > 0 && pool.labor[indexer] > 0, 'RR009');

        uint256 amount = _cobbDouglas(pool.totalReward, pool.labor[indexer], pool.stake[indexer], pool.totalStake);

        // TODO reward send to distribute or staking
        address rewardDistributer = settings.getContractAddress(SQContracts.RewardsDistributer);
        IRewardsDistributer distributer = IRewardsDistributer(rewardDistributer);
        IERC20(settings.getContractAddress(SQContracts.SQToken)).approve(rewardDistributer, amount);
        if (amount > 0) {
            distributer.addInstantRewards(indexer, address(this), amount, era);
        }

        // update indexer project list
        IndexerProject storage indexerProject = eraPool.indexerUnclaimProjects[indexer];
        uint index = indexerProject.index[projectId];
        uint256 lastProject = indexerProject.projects[indexerProject.unclaim];
        indexerProject.projects[index] = lastProject;
        indexerProject.projects.pop();
        indexerProject.index[lastProject] = index;
        delete indexerProject.index[projectId];
        indexerProject.unclaim -= 1;
        if (indexerProject.unclaim == 0) {
            delete eraPool.indexerUnclaimProjects[indexer];
        }

        pool.unclaimTotalLabor -= pool.labor[indexer];
        pool.unclaimReward -= amount;
        delete pool.labor[indexer];
        delete pool.stake[indexer];

        if (pool.unclaimTotalLabor == 0) {
            // the remained send to current era
            if (pool.unclaimReward > 0) {
                uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
                EraPool storage nextEraPool = pools[currentEra];
                ProjectPool storage nextPool = nextEraPool.pools[projectId];
                nextPool.extraReward += pool.unclaimReward;
            }

            delete eraPool.pools[projectId];
            eraPool.unclaimProject -= 1;

            // if unclaimed pool == 0, delete the era
            if (eraPool.unclaimProject == 0) {
                delete pools[era];
            }
        }

        emit Collect(era, projectId, indexer, amount);
    }

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
