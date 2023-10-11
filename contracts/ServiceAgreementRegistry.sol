// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

pragma experimental ABIEncoderV2;


import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/IServiceAgreementExtra.sol';
import './interfaces/IServiceAgreementRegistry.sol';
import './interfaces/ISettings.sol';
import './interfaces/IRewardsDistributer.sol';
import './interfaces/IPlanManager.sol';
/**
 * @title Service Agreement Registry Contract
 * @notice ### Overview
 * This contract tracks all service Agreements for Indexers and Consumers.
 * For now, Consumer can accept the plan created by Indexer from Plan Manager to generate close service agreement.
 * Indexer can also accept Purchase Offer created by Consumer from purchase offer market to generate close service agreement.
 * All generated service agreement need to register in this contract by calling establishServiceAgreement(). After this all SQT Toaken
 * from agreements will be temporary hold in this contract, and approve reward distributor contract to take and distribute these Token.
 */
contract ServiceAgreementRegistry is Initializable, OwnableUpgradeable, ERC721Upgradeable, IServiceAgreementRegistry {
    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;

    /// @notice the id for next ServiceAgreement
    uint256 public nextServiceAgreementId;

    /// @notice ServiceAgreementId => AgreementInfo
    mapping(uint256 => ClosedServiceAgreementInfo) private closedServiceAgreements;

    /// @notice address can establishServiceAgreement, for now only PurchaceOfferMarket and PlanManager addresses
    mapping(address => bool) public establisherWhitelist;

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
     * @dev Initialize this contract. Load establisherWhitelist.
     */
    function initialize(ISettings _settings, address[] calldata _whitelist) external initializer {
        __Ownable_init();
        __ERC721_init("SuqueryAgreement", "SA");

        settings = _settings;
        nextServiceAgreementId = 1;

        for (uint256 i; i < _whitelist.length; i++) {
            establisherWhitelist[_whitelist[i]] = true;
        }
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function addEstablisher(address establisher) external onlyOwner {
        establisherWhitelist[establisher] = true;
    }

    function removeEstablisher(address establisher) external onlyOwner {
        establisherWhitelist[establisher] = false;
    }

    function _afterTokenTransfer(address from, address to, uint256 tokenId) internal override {
        super._afterTokenTransfer(from, to, tokenId);
        closedServiceAgreements[tokenId].consumer = to;
    } 

    function createClosedServiceAgreement(ClosedServiceAgreementInfo memory agreement, bool checkThreshold) external returns (uint256) {
        if (msg.sender != address(this)) {
            require(establisherWhitelist[msg.sender], 'SA004');
        }

        uint256 agreementId = nextServiceAgreementId;
        closedServiceAgreements[agreementId] = agreement;

        _safeMint(agreement.consumer, agreementId);
        _establishServiceAgreement(agreementId, checkThreshold);

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
     * SQT need to be transfered before calling this function.
     * When new agreement come we need to track the sumDailyReward of Indexer. In our design there is an upper limit
     * on the rewards indexer can earn every day, and the limit will increase with the increase of the total staked
     * amount of that indexer. This design can ensure our Customer to obtain high quality of service from Indexer，
     * at the same time, it also encourages Indexer to provide better more stable services.
     *
     */
    function _establishServiceAgreement(uint256 agreementId, bool checkThreshold) internal {
        //for now only support closed service agreement
        ClosedServiceAgreementInfo memory agreement = closedServiceAgreements[agreementId];
        require(agreement.consumer != address(0), 'SA001');

        IServiceAgreementExtra saHelper = IServiceAgreementExtra(settings.getServiceAgreementExtra());
        saHelper.addAgreement(agreementId, agreement, checkThreshold);

        // approve token to reward distributor contract
        address SQToken = settings.getSQToken();
        IERC20(SQToken).approve(settings.getRewardsDistributer(), agreement.lockedAmount);

        // increase agreement rewards
        IRewardsDistributer rewardsDistributer = IRewardsDistributer(settings.getRewardsDistributer());
        rewardsDistributer.increaseAgreementRewards(agreementId);

        emit ClosedAgreementCreated(agreement.consumer, agreement.indexer, agreement.deploymentId, agreementId);
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
        require(msg.sender == agreement.consumer, 'SA007');
        require(agreement.startDate < block.timestamp, 'SA008');
        require((agreement.startDate + agreement.period) > block.timestamp, 'SA009');

        IPlanManager planManager = IPlanManager(settings.getPlanManager());
        Plan memory plan = planManager.getPlan(agreement.planId);
        require(plan.active, 'PM009');
        PlanTemplateV2 memory template = planManager.getPlanTemplate(plan.templateId);
        require(template.active, 'PM006');

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
        // deposit SQToken into service agreement registry contract
        IERC20(settings.getSQToken()).transferFrom(msg.sender, address(this), agreement.lockedAmount);
        this.createClosedServiceAgreement(newAgreement, false);
    }

    function closedServiceAgreementExpired(uint256 agreementId) public view returns (bool) {
        ClosedServiceAgreementInfo memory agreement = closedServiceAgreements[agreementId];
        return block.timestamp > (agreement.startDate + agreement.period);
    }

    function getClosedServiceAgreement(uint256 agreementId) external view returns (ClosedServiceAgreementInfo memory) {
        return closedServiceAgreements[agreementId];
    }
}
