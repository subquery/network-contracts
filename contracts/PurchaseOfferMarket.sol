// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './MathUtil.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/IServiceAgreementRegistry.sol';
import './interfaces/ISettings.sol';
import './interfaces/IPurchaseOfferMarket.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IPlanManager.sol';
import './Constants.sol';

/**
 * @title Purchase Offer Market Contract
 * @dev
 * ## Overview
 * The Purchase Offer Market Contract tracks all purchase offers for Indexers and Consumers.
 * It allows Consumers to create/cancel purchase offers, and Indexers to accept the purchase offer to make
 * the service agreements. It is the place Consumer publish a purchase offer for a specific deployment.
 * And also the place indexers can search and take these purchase offers.
 *
 * ## Terminology
 * Purchase Offer: A Purchase Offer is created by the Consumer, any Indexer can accept it to make the
 * service agreement.
 *
 * ## Detail
 * We design the date structure for Purchase Offer, It stores purchase offer related information.
 * A Purchase Offer can accepted by multiple Indexers. Consumer transfer Token to this contract as long as
 *the purchase offer is created. And when Indexer accept the offer, the corresponding part of the money will
 * transfer to serviceAgrementRegistry contract first and wait rewardDistributer contract take and distribute.
 * After Indexer accept the offer we use the planTemplate that stored in Purchase Offer structure to generate
 * the service agreement.
 *
 * Consumers can cancel their purchase offer after expire date for free, but if cancel the unexpired Purchase Offer
 * we will charge the penalty fee.
 */
contract PurchaseOfferMarket is Initializable, OwnableUpgradeable, IPurchaseOfferMarket, Constants {
    // -- Data --

    /**
     * @dev Purchase Offer information.
     */
    struct PurchaseOffer {
        //amount of SQT for each indexer, total deposit = deposit * limit
        uint256 deposit;
        //indexer must indexed to this height before accept the offer
        uint256 minimumAcceptHeight;
        //planTemplate used to generate the service agreement.
        uint256 planTemplateId;
        //specific deployment id require for indexing
        bytes32 deploymentId;
        //offer expired date
        uint256 expireDate;
        //consumer who create this offer
        address consumer;
        //offer active or not
        bool cancelled;
        //how many indexer can accept the offer
        uint16 limit;
        //number of contracts created from this offer
        uint16 numAcceptedContracts;
    }

    // -- Storage --

    ISettings public settings;
    //offerId => Offer
    mapping(uint256 => PurchaseOffer) public offers;
    //number of all offers
    uint256 public numOffers;
    //penalty rate of consumer cancel the unexpired offer
    uint256 public penaltyRate;
    //if penalty destination address is 0x00, then burn the penalty
    address public penaltyDestination;
    //offerId => indexer => accepted
    mapping(uint256 => mapping(address => bool)) public acceptedOffer;
    //offerId => Indexer => MmrRoot
    mapping(uint256 => mapping(address => bytes32)) public offerMmrRoot;

    // -- Events --

    /**
     * @dev Emitted when Consumer create a purchase offer
     */
    event PurchaseOfferCreated(
        address consumer,
        uint256 offerId,
        bytes32 deploymentId,
        uint256 planTemplateId,
        uint256 deposit,
        uint16 limit,
        uint256 minimumAcceptHeight,
        uint256 expireDate
    );
    /**
     * @dev Emitted when Consumer cancel a purchase offer
     */
    event PurchaseOfferCancelled(address indexed creator, uint256 offerId, uint256 penalty);
    /**
     * @dev Emitted when Indexer accept an offer
     */
    event OfferAccepted(address indexed indexer, uint256 offerId, uint256 agreementId);

    modifier onlyIndexer() {
        require(IIndexerRegistry(settings.getIndexerRegistry()).isIndexer(msg.sender), 'caller is not an indexer');
        _;
    }

    /**
     * @dev Initialize this contract.
     */
    function initialize(
        ISettings _settings,
        uint256 _penaltyRate,
        address _penaltyDestination
    ) external initializer {
        __Ownable_init();
        require(_penaltyRate < PER_MILL, 'Invalid penalty rate');

        settings = _settings;
        penaltyRate = _penaltyRate;
        penaltyDestination = _penaltyDestination;
    }

    /**
     * @dev allow owner the set the Penalty Rate for cancel unexpired offer.
     */
    function setPenaltyRate(uint256 _penaltyRate) external onlyOwner {
        require(_penaltyRate < PER_MILL, 'Invalid penalty rate');
        penaltyRate = _penaltyRate;
    }

    /**
     * @dev allow owner to set the Penalty Destination address.
     * All Penalty will transfer to this address, if penalty destination address is 0x00,
     * then burn the penalty
     */
    function setPenaltyDestination(address _penaltyDestination) external onlyOwner {
        penaltyDestination = _penaltyDestination;
    }

    /**
     * @dev Allow Consumer to create a Purchase Offer.
     */
    function createPurchaseOffer(
        bytes32 _deploymentId,
        uint256 _planTemplateId,
        uint256 _deposit,
        uint16 _limit,
        uint256 _minimumAcceptHeight,
        uint256 _expireDate
    ) external {
        require(_expireDate > block.timestamp, 'invalid expiration');
        require(_deposit > 0, 'should deposit positive amount');
        require(_limit > 0, 'should limit positive amount');
        IPlanManager planManager = IPlanManager(settings.getPlanManager());
        (, , , , bool active) = planManager.getPlanTemplate(_planTemplateId);
        require(active, 'PlanTemplate inactive');

        offers[numOffers] = PurchaseOffer(
            _deposit,
            _minimumAcceptHeight,
            _planTemplateId,
            _deploymentId,
            _expireDate,
            msg.sender,
            false,
            _limit,
            0
        );

        // send SQToken from msg.sender to the contract (this) - deposit * limit
        require(
            IERC20(settings.getSQToken()).transferFrom(msg.sender, address(this), _deposit * _limit),
            'transfer fail'
        );

        emit PurchaseOfferCreated(
            msg.sender,
            numOffers,
            _deploymentId,
            _planTemplateId,
            _deposit,
            _limit,
            _minimumAcceptHeight,
            _expireDate
        );

        numOffers++;
    }

    /**
     * @dev Allow Consumer to cancel their Purchase Offer.
     * Consumer transfer all tokens to this contract when they create the offer.
     * We will charge a Penalty to cancel unexpired Offer.
     * And the Penalty will transfer to a configured address.
     * If the address not configured, then we burn the Penalty.
     */
    function cancelPurchaseOffer(uint256 _offerId) external {
        PurchaseOffer memory offer = offers[_offerId];
        require(msg.sender == offer.consumer, 'only offerer can cancel the offer');

        offers[_offerId].cancelled = true;

        //- deposit * limit
        uint256 unfulfilledValue = offer.deposit * (offer.limit - offer.numAcceptedContracts);
        uint256 penalty = 0;
        if (!isExpired(_offerId)) {
            penalty = MathUtil.mulDiv(penaltyRate, unfulfilledValue, PER_MILL);
            unfulfilledValue = unfulfilledValue - penalty;
            if (penaltyDestination != ZERO_ADDRESS) {
                IERC20(settings.getSQToken()).transfer(penaltyDestination, penalty);
            } else {
                ISQToken(settings.getSQToken()).burn(penalty);
            }
        }

        // send remaining SQToken from the contract to consumer (this)
        require(IERC20(settings.getSQToken()).transfer(msg.sender, unfulfilledValue), 'transfer fail');

        emit PurchaseOfferCancelled(msg.sender, _offerId, penalty);
    }

    /**
     * @dev Allow Indexer to accept the offer and make the service agreement.
     * The corresponding part of the money will transfer to serviceAgrementRegistry contract
     * and wait rewardDistributer contract take and distribute as long as Indexer accept the offer.
     * When Indexer accept the offer we need to ensure Indexer's deployment reaches the minimumAcceptHeight,
     * So we ask indexers to pass the latest mmr value when accepting the purchase offer,
     * and save this mmr value when agreement create.
     */
    function acceptPurchaseOffer(uint256 _offerId, bytes32 _mmrRoot) external onlyIndexer {
        require(_offerId < numOffers, 'invalid offerId');
        require(!isExpired(_offerId), 'offer expired');
        require(!acceptedOffer[_offerId][msg.sender], 'offer accepted already');
        require(!offers[_offerId].cancelled, 'offer cancelled');
        require(
            offers[_offerId].limit > offers[_offerId].numAcceptedContracts,
            'number of contracts already reached limit'
        );

        // increate number of accepted contracts
        offers[_offerId].numAcceptedContracts++;
        // flag offer accept to avoid double accept
        acceptedOffer[_offerId][msg.sender] = true;
        PurchaseOffer memory offer = offers[_offerId];
        offerMmrRoot[_offerId][msg.sender] = _mmrRoot;

        IPlanManager planManager = IPlanManager(settings.getPlanManager());
        (uint256 period, , , , ) = planManager.getPlanTemplate(offer.planTemplateId);
        // create closed service agreement contract
        ClosedServiceAgreementInfo memory agreement = ClosedServiceAgreementInfo(
            offer.consumer,
            msg.sender,
            offer.deploymentId,
            offer.deposit,
            block.timestamp,
            period,
            0,
            offer.planTemplateId
        );

        // deposit SQToken into the service agreement registry contract
        require(
            IERC20(settings.getSQToken()).transfer(settings.getServiceAgreementRegistry(), offer.deposit),
            'transfer fail'
        );
        // register the agreement to service agreement registry contract
        IServiceAgreementRegistry registry = IServiceAgreementRegistry(settings.getServiceAgreementRegistry());
        uint256 agreementId = registry.createClosedServiceAgreement(agreement);
        registry.establishServiceAgreement(agreementId);

        offerMmrRoot[_offerId][msg.sender] = _mmrRoot;

        emit OfferAccepted(msg.sender, _offerId, agreementId);
    }

    function isExpired(uint256 _offerId) public view returns (bool) {
        return offers[_offerId].expireDate < block.timestamp;
    }
}
