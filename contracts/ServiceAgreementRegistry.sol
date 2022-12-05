// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/IServiceAgreementRegistry.sol';
import './interfaces/ISettings.sol';
import './interfaces/IQueryRegistry.sol';
import './interfaces/IRewardsDistributer.sol';
import './interfaces/IStaking.sol';
import './interfaces/IPlanManager.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

/**
 * @title Service Agreement Registry Contract
 * @notice ### Overview
 * This contract tracks all service Agreements for Indexers and Consumers.
 * For now, Consumer can accept the plan created by Indexer from Plan Manager to generate close service agreement.
 * Indexer can also accept Purchase Offer created by Consumer from purchase offer market to generate close service agreement.
 * All generated service agreement need to register in this contract by calling establishServiceAgreement(). After this all SQT Toaken
 * from agreements will be temporary hold in this contract, and approve reward distributor contract to take and distribute these Token.
 */
contract ServiceAgreementRegistry is Initializable, OwnableUpgradeable, IServiceAgreementRegistry, Constants {
    using MathUtil for uint256;

    // -- Storage --

    ISettings public settings;
    //the id for next ServiceAgreement
    uint256 public nextServiceAgreementId;
    //ServiceAgreementId => AgreementInfo
    mapping(uint256 => ClosedServiceAgreementInfo) closedServiceAgreements;
    //serviceAgreement address: Indexer address => index number => serviceAgreement address
    mapping(address => mapping(uint256 => uint256)) public closedServiceAgreementIds;
    //number of service agreements: Indexer address =>  number of service agreements
    mapping(address => uint256) public indexerCsaLength;
    //number of service agreements: Indexer address => DeploymentId => number of service agreements
    mapping(address => mapping(bytes32 => uint256)) public indexerDeploymentCsaLength;
    //address can establishServiceAgreement, for now only PurchaceOfferMarket and PlanManager addresses
    mapping(address => bool) public establisherWhitelist;
    //calculated sum daily reward: Indexer address => sumDailyReward
    mapping(address => uint256) public sumDailyReward;
    //users authorised by consumer that can request access token from indexer, for closed agreements only.
    //consumer address => user address => bool
    //We are using the statu `consumerAuthAllows` offchain.
    mapping(address => mapping(address => bool)) public consumerAuthAllows;
    //Multipler used to calculate Indexer reward limit
    uint256 public threshold;
    //second in a day
    uint256 private constant SECONDS_IN_DAY = 86400;

    // -- Events --

    /**
     * @dev Emitted when closed service agreement established
     */
    event ClosedAgreementCreated(
        address indexed consumer,
        address indexed indexer,
        bytes32 indexed deploymentId,
        uint256 serviceAgreementId
    );
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
     * @dev Emitted when consumer add new user
     */
    event UserAdded(address indexed consumer, address user);
    /**
     * @dev Emitted when consumer remove user
     */
    event UserRemoved(address indexed consumer, address user);

    /**
     * @dev Initialize this contract. Load establisherWhitelist.
     */
    function initialize(ISettings _settings, uint256 _threshold, address[] calldata _whitelist) external initializer {
        __Ownable_init();

        settings = _settings;

        threshold = _threshold;

        nextServiceAgreementId = 1;

        for (uint256 i; i < _whitelist.length; i++) {
            establisherWhitelist[_whitelist[i]] = true;
        }
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

    /**
     * @dev Consumer add users can request access token from indexer.
     * We are using the statu `consumerAuthAllows` offchain.
     */
    function addUser(address consumer, address user) external {
        require(msg.sender == consumer, 'Only consumer can add user');
        consumerAuthAllows[consumer][user] = true;
        emit UserAdded(consumer, user);
    }

    /**
     * @dev Consumer remove users can request access token from indexer.
     */
    function removeUser(address consumer, address user) external {
        require(msg.sender == consumer, 'Only consumer can remove user');
        delete consumerAuthAllows[consumer][user];
        emit UserRemoved(consumer, user);
    }

    function addEstablisher(address establisher) external onlyOwner {
        establisherWhitelist[establisher] = true;
    }

    function removeEstablisher(address establisher) external onlyOwner {
        establisherWhitelist[establisher] = false;
    }

    function periodInDay(uint256 period) private pure returns (uint256) {
        return period > SECONDS_IN_DAY ? period / SECONDS_IN_DAY : 1;
    }

    function createClosedServiceAgreement(ClosedServiceAgreementInfo memory agreement) external returns (uint256) {
        if (msg.sender != address(this)) {
            require(establisherWhitelist[msg.sender], 'No access');
        }
        closedServiceAgreements[nextServiceAgreementId] = agreement;
        uint256 agreementId = nextServiceAgreementId;
        nextServiceAgreementId += 1;
        return agreementId;
    }

    /**
     * @dev Establish the generated service agreement.
     * For now only establish the close service agreement generated from PlanManager and PurchsaseOfferMarket.
     * This function is called by PlanManager or PurchsaseOfferMarket when close service agreement generated,
     * it temporary hold the SQT Token from these agreements, approve and nodify reward distributor contract to take and
     * distribute these Token.
     * All agreements register to this contract through this method.
     * When new agreement come we need to track the sumDailyReward of Indexer. In our design there is an upper limit
     * on the rewards indexer can earn every day, and the limit will increase with the increase of the total staked
     * amount of that indexer. This design can ensure our Customer to obtain high quality of service from Indexer，
     * at the same time, it also encourages Indexer to provide better more stable services.
     *
     */
    function establishServiceAgreement(uint256 agreementId) external {
        if (msg.sender != address(this)) {
            require(establisherWhitelist[msg.sender], 'No access');
        }

        //for now only support closed service agreement
        ClosedServiceAgreementInfo memory agreement = closedServiceAgreements[agreementId];
        require(agreement.consumer != address(0), 'Agreement does not exist');

        address indexer = agreement.indexer;
        address consumer = agreement.consumer;
        bytes32 deploymentId = agreement.deploymentId;

        require(
            IQueryRegistry(settings.getQueryRegistry()).isIndexingAvailable(deploymentId, indexer),
            'Indexing service is not available'
        );

        IStaking staking = IStaking(settings.getStaking());
        uint256 totalStake = staking.getTotalStakingAmount(indexer);

        uint256 lockedAmount = agreement.lockedAmount;
        uint256 period = periodInDay(agreement.period);
        sumDailyReward[indexer] += lockedAmount / period;
        require(
            totalStake >= MathUtil.mulDiv(sumDailyReward[indexer], threshold, PER_MILL),
            'Indexer reward reached to the limit'
        );

        closedServiceAgreementIds[indexer][indexerCsaLength[indexer]] = agreementId;
        indexerCsaLength[indexer] += 1;
        indexerDeploymentCsaLength[indexer][deploymentId] += 1;

        // approve token to reward distributor contract
        address SQToken = settings.getSQToken();
        IERC20(SQToken).approve(settings.getRewardsDistributer(), lockedAmount);

        // increase agreement rewards
        IRewardsDistributer rewardsDistributer = IRewardsDistributer(settings.getRewardsDistributer());
        rewardsDistributer.increaseAgreementRewards(agreementId);

        emit ClosedAgreementCreated(consumer, indexer, deploymentId, agreementId);
    }

    /**
     * @dev A function allow Consumer call to renew its unexpired closed service agreement.
     * We only allow the the agreement generated from PlanManager renewable which is created
     * by Indexer and accepted by Consumer. We use the status planId in agreement to determine
     * whether the agreement is renewable, since only the agreement generated from PlanManager
     * come with the PlanId.
     * Indexer can be prevente the agreement rennew by inactive the plan which bound to it.
     * Consumer must renew befor the agreement expired.
     */
    function renewAgreement(uint256 agreementId) external {
        //for now only support closed service agreement
        ClosedServiceAgreementInfo memory agreement = closedServiceAgreements[agreementId];
        require(msg.sender == agreement.consumer, 'Sender is not the consumer');
        require(agreement.startDate < block.timestamp, 'Cannot renew upcoming agreement');
        require(agreement.planId != 0, 'Agreement cannot renew without planId');

        IPlanManager planManager = IPlanManager(settings.getPlanManager());
        (, , , bool active) = planManager.getPlan(agreement.indexer, agreement.planId);
        require(active, 'Plan is inactive');
        require((agreement.startDate + agreement.period) > block.timestamp, 'Agreement ended');

        // create closed service agreement
        ClosedServiceAgreementInfo memory newAgreement = ClosedServiceAgreementInfo(
            agreement.consumer,
            agreement.indexer,
            agreement.deploymentId,
            agreement.lockedAmount,
            agreement.startDate + agreement.period,
            agreement.period,
            agreement.planId,
            agreement.planTemplateId
        );
        uint256 newAgreementId = this.createClosedServiceAgreement(newAgreement);

        // deposit SQToken into service agreement registry contract
        IERC20(settings.getSQToken()).transferFrom(msg.sender, address(this), agreement.lockedAmount);
        this.establishServiceAgreement(newAgreementId);
    }

    function clearEndedAgreement(address indexer, uint256 id) public {
        require(id < indexerCsaLength[indexer], 'Agreement does not exist');

        uint256 agreementId = closedServiceAgreementIds[indexer][id];
        ClosedServiceAgreementInfo memory agreement = closedServiceAgreements[agreementId];
        require(agreement.consumer != address(0), 'Agreement does not exist');
        require(block.timestamp > (agreement.startDate + agreement.period), 'Agreement not complete');

        uint256 lockedAmount = agreement.lockedAmount;
        uint256 period = periodInDay(agreement.period);
        sumDailyReward[indexer] = MathUtil.sub(sumDailyReward[indexer], (lockedAmount / period));

        closedServiceAgreementIds[indexer][id] = closedServiceAgreementIds[indexer][indexerCsaLength[indexer] - 1];
        delete closedServiceAgreementIds[indexer][indexerCsaLength[indexer] - 1];
        indexerCsaLength[indexer] -= 1;
        indexerDeploymentCsaLength[indexer][agreement.deploymentId] -= 1;

        emit ClosedAgreementRemoved(agreement.consumer, agreement.indexer, agreement.deploymentId, agreementId);
    }

    function clearAllEndedAgreements(address indexer) public {
        uint256 count = 0;
        for (uint256 i = indexerCsaLength[indexer]; i >= 1; i--) {
            uint256 agreementId = closedServiceAgreementIds[indexer][i - 1];
            ClosedServiceAgreementInfo memory agreement = closedServiceAgreements[agreementId];
            if (block.timestamp > (agreement.startDate + agreement.period)) {
                clearEndedAgreement(indexer, i - 1);
                count++;
                if (count >= 10) {
                    break;
                }
            }
        }
    }

    function closedServiceAgreementExpired(uint256 agreementId) public view returns (bool) {
        ClosedServiceAgreementInfo memory agreement = closedServiceAgreements[agreementId];
        return block.timestamp > (agreement.startDate + agreement.period);
    }

    function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool) {
        return indexerDeploymentCsaLength[indexer][deploymentId] > 0;
    }

    function getClosedServiceAgreement(uint256 agreementId) external view returns (ClosedServiceAgreementInfo memory) {
        return closedServiceAgreements[agreementId];
    }
}
