// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './ClosedServiceAgreement.sol';
import './interfaces/IServiceAgreement.sol';
import './interfaces/IServiceAgreementRegistry.sol';
import './interfaces/ISettings.sol';
import './interfaces/IQueryRegistry.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/IRewardsDistributer.sol';
import './interfaces/IStaking.sol';
import './interfaces/IPlanManager.sol';
import './MathUtil.sol';
import './Constants.sol';

/**
 * @title Service Agreement Registry Contract
 * @dev
 * ## Overview
 * This contract tracks all service Agreements for Indexers and Consumers.
 * For now, Consumer can accept the plan created by Indexer from Plan Manager to generate close service agreement.
 * Indexer can also accept Purchase Offer created by Consumer from purchase offer market to generate close service agreement.
 * All generated service agreement need to register in this contract by calling establishServiceAgreement(). After this all SQT Toaken
 * from agreements will be temporary hold in this contract, and approve reward distributor contract to take and distribute these Token.
 */
contract ServiceAgreementRegistry is Initializable, OwnableUpgradeable, IServiceAgreementRegistry, Constants {
    using ERC165CheckerUpgradeable for address;
    using MathUtil for uint256;

    // -- Storage --

    ISettings public settings;
    //serviceAgreement address: Indexer address => index number => serviceAgreement address
    mapping(address => mapping(uint256 => address)) public serviceAgreements;
    //number of service agreements: Indexer address =>  number of service agreements
    mapping(address => uint256) public indexerSaLength;
    //number of service agreements: Indexer address => DeploymentId => number of service agreements
    mapping(address => mapping(bytes32 => uint256)) public indexerDeploymentSaLength;
    //address can establishServiceAgreement, for now only PurchaceOfferMarket and PlanManager addresses
    mapping(address => bool) public establisherWhitelist;
    //calculated sum daily reward: Indexer address => sumDailyReward
    mapping(address => uint256) public sumDailyReward;
    //users authorised by consumer that can request access token from indexer, for closed agreements only.
    //user address => consumer address => bool
    mapping(address => mapping(address => bool)) public consumerAuthAllows;
    //Multipler used to calculate Indexer reward limit
    uint256 public threshold;
    //second in a day
    uint256 constant SECONDS_IN_DAY = 86400;

    // -- Events --

    /**
     * @dev Emitted when closed service agreement established
     */
    event ClosedAgreementCreated(
        address indexed consumer,
        address indexed indexer,
        bytes32 indexed deploymentId,
        address serviceAgreement
    );
    /**
     * @dev Emitted when expired closed service agreement removed.
     */
    event ClosedAgreementRemoved(
        address indexed consumer,
        address indexed indexer,
        bytes32 indexed deploymentId,
        address serviceAgreement
    );

    /**
     * @dev Initialize this contract. Load establisherWhitelist.
     */
    function initialize(ISettings _settings, address[] calldata _whitelist) external initializer {
        __Ownable_init();

        settings = _settings;

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
     */
    function addUser(address consumer, address user) external {
        require(msg.sender == consumer, 'Only consumer can add user');
        consumerAuthAllows[user][consumer] = true;
    }

    /**
     * @dev Consumer remove users can request access token from indexer.
     */
    function removeUser(address consumer, address user) external {
        require(msg.sender == consumer, 'Only consumer can remove user');
        consumerAuthAllows[user][consumer] = false;
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
    function establishServiceAgreement(address agreementContract) external {
        if (msg.sender != address(this)) {
            require(establisherWhitelist[msg.sender], 'Address is not authorised to establish agreements');
        }
        require(
            agreementContract.supportsInterface(type(IServiceAgreement).interfaceId),
            'Contract is not a service agreement'
        );

        require(
            IServiceAgreement(agreementContract).agreementType() == AgreementType.Closed,
            'Only ClosedAgreement is supported for now'
        );
        IClosedServiceAgreement agreement = IClosedServiceAgreement(agreementContract);
        address indexer = agreement.indexer();
        address consumer = agreement.consumer();
        bytes32 deploymentId = agreement.deploymentId();

        require(
            IQueryRegistry(settings.getQueryRegistry()).isIndexingAvailable(deploymentId, indexer),
            'Indexing service is not available to establish agreements'
        );

        IStaking staking = IStaking(settings.getStaking());
        uint256 totalStake = staking.getTotalStakingAmount(indexer);

        uint256 lockedAmount = agreement.value();
        uint256 contractPeriod = periodInDay(agreement.period());
        sumDailyReward[indexer] += lockedAmount / contractPeriod;
        require(
            totalStake >= MathUtil.mulDiv(sumDailyReward[indexer], threshold, PER_MILL),
            'Indexer reward reached to the limit'
        );

        serviceAgreements[indexer][indexerSaLength[indexer]] = agreementContract;
        indexerSaLength[indexer] += 1;
        indexerDeploymentSaLength[indexer][deploymentId] += 1;

        // approve token to reward distributor contract
        address SQToken = settings.getSQToken();
        IERC20(SQToken).approve(settings.getRewardsDistributer(), IServiceAgreement(agreementContract).value());

        // increase agreement rewards
        IRewardsDistributer rewardsDistributer = IRewardsDistributer(settings.getRewardsDistributer());
        rewardsDistributer.increaseAgreementRewards(indexer, agreementContract);

        emit ClosedAgreementCreated(consumer, indexer, deploymentId, agreementContract);
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
    function renewAgreement(address agreementContract) external {
        require(
            IServiceAgreement(agreementContract).agreementType() == AgreementType.Closed,
            'Only ClosedAgreement is supported for now'
        );
        IClosedServiceAgreement agreement = IClosedServiceAgreement(agreementContract);

        require(msg.sender == agreement.consumer(), 'sender is not consumer');
        require(agreement.startDate() < block.timestamp, 'cannot renew upcoming agreement');
        require(agreement.planId() != 0, 'Agreement cannot renew without planId');
        IPlanManager planManager = IPlanManager(settings.getPlanManager());
        (, , , bool active) = planManager.getPlan(agreement.indexer(), agreement.planId());
        require(active, 'Plan is inactive');
        require((agreement.startDate() + agreement.period()) > block.timestamp, 'Agreement ended');

        // create closed service agreement contract
        ClosedServiceAgreement serviceAgreement = new ClosedServiceAgreement(
            address(settings),
            agreement.consumer(),
            agreement.indexer(),
            agreement.deploymentId(),
            agreement.value(),
            agreement.startDate() + agreement.period(),
            agreement.period(),
            agreement.planId(),
            agreement.planTemplateId()
        );

        // deposit SQToken into serviceAgreementRegistry contract
        IERC20(settings.getSQToken()).transferFrom(msg.sender, address(this), agreement.value());

        this.establishServiceAgreement(address(serviceAgreement));
    }

    function clearEndedAgreement(address indexer, uint256 id) public {
        require(id < indexerSaLength[indexer], 'service agreement id not existing for the indexer');

        address agreementContract = getServiceAgreement(indexer, id);
        require(
            IServiceAgreement(agreementContract).agreementType() == AgreementType.Closed,
            'Only ClosedAgreement is supported for now'
        );
        IClosedServiceAgreement agreement = IClosedServiceAgreement(agreementContract);

        require(agreement.hasEnded(), 'service agreement not complete');

        uint256 lockedAmount = agreement.value();
        uint256 contractPeriod = periodInDay(agreement.period());
        //Todo: replace this with safeSub after merge dev
        if (sumDailyReward[indexer] < (lockedAmount / contractPeriod)) {
            sumDailyReward[indexer] = 0;
        } else {
            sumDailyReward[indexer] -= lockedAmount / contractPeriod;
        }

        serviceAgreements[indexer][id] = serviceAgreements[indexer][indexerSaLength[indexer] - 1];
        delete serviceAgreements[indexer][indexerSaLength[indexer] - 1];
        indexerSaLength[indexer] -= 1;

        bytes32 deploymentId = agreement.deploymentId();
        indexerDeploymentSaLength[indexer][deploymentId] -= 1;

        emit ClosedAgreementRemoved(
            agreement.consumer(),
            agreement.indexer(),
            agreement.deploymentId(),
            agreementContract
        );
    }

    function clearAllEndedAgreements(address indexer) public {
        for (uint256 i = indexerSaLength[indexer]; i >= 1; i--) {
            address agreementContract = getServiceAgreement(indexer, i - 1);
            IServiceAgreement agreement = IServiceAgreement(agreementContract);
            if (agreement.hasEnded()) {
                clearEndedAgreement(indexer, i - 1);
            }
        }
    }

    function getServiceAgreement(address indexer, uint256 id) public view returns (address) {
        return serviceAgreements[indexer][id];
    }

    function serviceAgreementExpired(address agreement) public view returns (bool) {
        return IServiceAgreement(agreement).hasEnded();
    }

    function hasOngoingServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool) {
        return indexerDeploymentSaLength[indexer][deploymentId] > 0;
    }

    function getIndexerDeploymentSaLength(address indexer, bytes32 deploymentId) public view returns (uint256) {
        return indexerDeploymentSaLength[indexer][deploymentId];
    }
}
