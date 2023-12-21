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
        // total basic reward for all project by inflation
        uint256 basicInflationReward;
        // total booster reward for all project by inflation
        uint256 boosterInflationReward;
        // record the unclaimed project
        uint256 unclaimProject;
        // record the reward unactived project for update shares
        uint256 unactivedProject;
        // record the indexer joined projects, and check if all is claimed
        mapping(address => IndexerProject) indexerUnclaimProjects;
        // storage all pools by project: project id => ProjectPool
        mapping(uint256 => ProjectPool) pools;
    }


    /// @notice The booster project
    struct BoosterProject {
        // the owner/first staking person is owner
        address owner;
        // total staking amount
        uint256 amount;
        // last time when changed the staking
        uint256 lastTime;
    }

    /// @dev ### STATES
    /// @notice Settings info
    ISettings public settings;

    /// @notice record the latest actived era for update shares
    uint256 public latestActivedEra;
    /// @notice record the total staking of booster projects
    uint256 public totalBoosterProjectStaking;

    /// @notice Era Rewards Pools: era => Era Pool
    mapping(uint256 => EraPool) private pools;
    /// @notice project shares in all rewards
    mapping(uint256 => uint256) public basicProjectShares;
    /// @notice booster project shares in all rewards
    mapping(uint256 => BoosterProject) public boosterProjectStakings;
    /// @notice Allowlist reporters
    mapping(address => bool) public reporters;

    ///@notice the block number limit when change staking
    uint256 public blockLimit;
    /// @notice the booster projects pool proportion of all inflation reward.
    uint256 public boosterProjectShare;
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
    /// @notice Emitted when inflation reward to the era pool
    event InflationReward(uint256 era, uint256 basicProjectAmount, uint256 boosterProjectAmount);
    /// @notice Emitted when extra reward to the era project pool
    event ExtraReward(uint256 era, uint256 projectId, address sender, uint256 amount);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract, setup the alphaNumerator, alphaDenominator
     * @param _settings settings contract address
     */
    function initialize(ISettings _settings, uint256 _boosterProjectShare, uint256 _blockLimit) external initializer {
        __Ownable_init();

        blockLimit = _blockLimit;
        boosterProjectShare = _boosterProjectShare;
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

        // check latest actived era
        uint256 era = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        require(era == latestActivedEra + 1, 'RR010');

        uint256 totalShare = 0;
        for(uint256 i = 0; i < projects.length; i++) {
            require(shares[i] > 0, 'RR011');
            basicProjectShares[projects[i]] = shares[i];
            totalShare += shares[i];
        }
        require(totalShare == 100, 'RR004');

        for(uint256 i = 0; i < deleted.length; i++) {
            delete basicProjectShares[deleted[i]];
        }
    }

    /**
     * @notice add booster project staking
     * @param projectId the project id
     * @param amount the added amount
     */
    function addProjectStaking(uint256 projectId, uint256 amount) external {
        // check latest actived era
        uint256 era = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        require(era == latestActivedEra + 1, 'RR010');

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(msg.sender, address(this), amount);

        BoosterProject storage project = boosterProjectStakings[projectId];
        project.amount += amount;
        project.lastTime = block.number;
        if (project.owner == address(0)) {
            project.owner = msg.sender;
        }
        totalBoosterProjectStaking += amount;
    }

    /**
     * @notice add booster project staking
     * @param projectId the project id
     * @param amount the added amount
     */
    function subProjectStaking(uint256 projectId, uint256 amount) external {
        // check latest actived era
        uint256 era = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        require(era == latestActivedEra + 1, 'RR010');

        BoosterProject storage project = boosterProjectStakings[projectId];
        require(project.lastTime + blockLimit < block.number, 'RR020');

        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(address(this), project.owner, amount);

        project.amount -= amount;
        project.lastTime = block.number;
        totalBoosterProjectStaking -= amount;
    }

    /**
     * @notice active next era project shares, call it before change project shares
     * @param projects need actived projects
     */
    function activeProjectShare(uint256[] calldata projects) external {
        // check latest actived era
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        require(latestActivedEra < currentEra, 'RR012');
        EraPool storage eraPool = pools[latestActivedEra+1];

        for(uint256 i = 0; i < projects.length; i++) {
            require(basicProjectShares[projects[i]] > 0 || boosterProjectStakings[projects[i]].amount > 0, 'RR015');
            ProjectPool storage pool = eraPool.pools[projects[i]];

            if (pool.totalReward == 0) {
                uint256 basicInflationReward = eraPool.basicInflationReward * basicProjectShares[projects[i]] / 100;
                uint256 boosterInflationReward = eraPool.boosterInflationReward * boosterProjectStakings[projects[i]].amount / totalBoosterProjectStaking;
                pool.totalReward = pool.extraReward + basicInflationReward + boosterInflationReward;
                pool.unclaimReward = pool.totalReward;
                eraPool.unactivedProject -= 1;
            }
        }
        if (eraPool.unactivedProject == 0) {
            latestActivedEra += 1;
        }
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
     * @notice Update waiting time when change staking
     * @param _blockLimit the time when do next change
     */
    function setBlockLimit(uint256 _blockLimit) public onlyOwner {
        blockLimit = _blockLimit;
    }

    /**
     * @notice Update the booster projects pool proportion of all inflation reward.
     * @param share the proportion of reward
     */
    function setBoosterProjectShare(uint256 share) public onlyOwner {
        require(share <= 100 && share >= 0, 'RR014');
        boosterProjectShare = share;
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

        uint256 totalReward = pool.extraReward + eraPool.basicInflationReward * basicProjectShares[projectId] / 100;

        return (pool.labor[indexer], totalReward);
    }

    /**
     * @notice receive and distribute inflation reward
     * @param amount the total amount of inflation reward
     */
    function inflationReward(uint256 amount) external {
        require(amount > 0, 'RR013');
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(msg.sender, address(this), amount);

        uint256 boosterProjectAmount = amount * boosterProjectShare / 100;
        uint256 basicProjectAmount = amount - boosterProjectAmount;

        uint256 era = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        EraPool storage eraPool = pools[era];
        eraPool.basicInflationReward = basicProjectAmount;
        eraPool.boosterInflationReward = boosterProjectAmount;

        emit InflationReward(era, basicProjectAmount, boosterProjectAmount);
    }

    /**
     * @notice add extra reward to the current era project
     * @param projectId the project id
     * @param amount the amount of extra reward
     */
    function extraReward(uint256 projectId, uint256 amount) external {
        require(amount > 0, 'RR002');
        require(basicProjectShares[projectId] > 0 || boosterProjectStakings[projectId].amount > 0, 'RR015');

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

        // check project is in basic or booster
        require(basicProjectShares[projectId] > 0 || boosterProjectStakings[projectId].amount > 0, 'RR015');

        uint256 era = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();
        EraPool storage eraPool = pools[era];
        ProjectPool storage pool = eraPool.pools[projectId];

        // project created firstly.
        if (pool.totalLabor == 0) {
            eraPool.unclaimProject += 1;
            eraPool.unactivedProject += 1;
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
        require(basicProjectShares[projectId] > 0 || boosterProjectStakings[projectId].amount > 0, 'RR015');

        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager)).safeUpdateAndGetEra();

        EraPool storage eraPool = pools[era];
        ProjectPool storage pool = eraPool.pools[projectId];

        // calc total reward for this project if it is first time to collect
        if (pool.totalReward == 0) {
            uint256 basicInflationReward = eraPool.basicInflationReward * basicProjectShares[projectId] / 100;
            uint256 boosterInflationReward = eraPool.boosterInflationReward * boosterProjectStakings[projectId].amount / totalBoosterProjectStaking;
            pool.totalReward = pool.extraReward + basicInflationReward + boosterInflationReward;
            pool.unclaimReward = pool.totalReward;
            eraPool.unactivedProject -= 1;
        }

        // check if all project share had been actived
        if (eraPool.unactivedProject == 0) {
            latestActivedEra += 1;
        }

        // this is to prevent duplicated collect
        require(pool.totalStake > 0 && pool.totalReward > 0 && pool.labor[indexer] > 0, 'RR009');

        uint256 amount = _cobbDouglas(pool.totalReward, pool.labor[indexer], pool.stake[indexer], pool.totalStake);

        // reward send to distribute
        address rewardDistributer = settings.getContractAddress(SQContracts.RewardsDistributer);
        IRewardsDistributer distributer = IRewardsDistributer(rewardDistributer);
        IERC20(settings.getContractAddress(SQContracts.SQToken)).approve(rewardDistributer, amount);
        if (amount > 0) {
            // reward send to CURRENT era
            distributer.addInstantRewards(indexer, address(this), amount, currentEra);
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
