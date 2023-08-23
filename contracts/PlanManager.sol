// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import './interfaces/IServiceAgreementRegistry.sol';
import './interfaces/ISettings.sol';
import './interfaces/IPlanManager.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IPriceOracle.sol';

/**
 * @title Plan Manager Contract
 * @notice ### Overview
 * The Plan Manager Contract tracks and maintains all the Plans and PlanTemplates.
 * It is the place Indexer create and publish a Plan for a specific deployment.
 * And also the place Consumer can search and take these Plan.
 *
 * ### Terminology
 * Plan: Plan is created by an Indexer,  a service agreement will be created once a consumer accept a plan.
 * PlanTemplate: PlanTemplate is create and maintenance by owner, we provide a set of PlanTemplates
 * for Indexer to create the Plan.
 */
contract PlanManager is Initializable, OwnableUpgradeable, IPlanManager {
    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;

    /// @notice the limit of the plan that Indexer can create
    uint256 public limit;

    /// @notice The id for next plan template
    uint256 public nextTemplateId;

    /// @notice The id for next plan, start from 1, PurchaseOfferMarket will use 0.
    uint256 public nextPlanId;

    /// @notice TemplateId => Template
    mapping(uint256 => PlanTemplate) private templates;

    /// @notice PlanId => Plan
    mapping(uint256 => Plan) private plans;

    /// @notice indexer => deploymentId => already plan number
    mapping(address => mapping(bytes32 => uint256)) private limits;

    /// @notice TemplateId => Template
    mapping(uint256 => PlanTemplateV2) private v2templates;

    /// @dev ### EVENTS
    /// @notice Emitted when owner create a PlanTemplate.
    event PlanTemplateCreated(uint256 indexed templateId);

    /// @notice Emitted when owner change the Metadata of a PlanTemplate.
    event PlanTemplateMetadataChanged(uint256 indexed templateId, bytes32 metadata);

    /// @notice Emitted when owner change the status of a PlanTemplate. active or not
    event PlanTemplateStatusChanged(uint256 indexed templateId, bool active);

    /// @notice Emitted when Indexer create a Plan.
    event PlanCreated(uint256 indexed planId, address creator, bytes32 deploymentId, uint256 planTemplateId, uint256 price);

    /// @notice Emitted when Indexer remove a Plan.
    event PlanRemoved(uint256 indexed planId);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize this contract to set the limit be 5 which any indexer can create 5 plans.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
        limit = 5;
        nextPlanId = 1;
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @notice Set the indexer plan limit.
     * @param _limit limit to set
     */
    function setIndexerPlanLimit(uint256 _limit) external onlyOwner {
        limit = _limit;
    }

    /**
     * @notice Allow admin to create a PlanTemplate.
     * @param period plan period
     * @param dailyReqCap daily request limit
     * @param rateLimit request rate limit
     * @param metadata plan metadata
     */
    function createPlanTemplate(uint256 period, uint256 dailyReqCap, uint256 rateLimit, address priceToken, bytes32 metadata) external onlyOwner {
        require(period > 0, 'PM001');
        require(dailyReqCap > 0, 'PM002');
        require(rateLimit > 0, 'PM003');

        v2templates[nextTemplateId] = PlanTemplateV2(period, dailyReqCap, rateLimit, priceToken, metadata, true);

        emit PlanTemplateCreated(nextTemplateId);
        nextTemplateId++;
    }

    /**
     * @notice Allow admin to update the Metadata of a PlanTemplate.
     * @param templateId plan template id
     * @param metadata metadata to update
     */
    function updatePlanTemplateMetadata(uint256 templateId, bytes32 metadata) external onlyOwner {
        require(v2templates[templateId].period > 0, 'PM004');

        v2templates[templateId].metadata = metadata;

        emit PlanTemplateMetadataChanged(templateId, metadata);
    }

    /**
     * @notice Allow Owner to update the status of a PlanTemplate.
     * @param templateId plan template id
     * @param active plan template active or not
     */
    function updatePlanTemplateStatus(uint256 templateId, bool active) external onlyOwner {
        require(v2templates[templateId].period > 0, 'PM004');

        v2templates[templateId].active = active;

        emit PlanTemplateStatusChanged(templateId, active);
    }

    function convertPlanPriceToSQT(address priceToken, uint256 price) public view returns (uint256) {
        if (priceToken == settings.getSQToken()){
            return price;
        }

        uint256 assetPrice = IPriceOracle(settings.getPriceOracle()).getAssetPrice(priceToken, settings.getSQToken());
        return price * 1e18 / assetPrice;
    }

    /**
     * @notice Allow Indexer to create a Plan basing on a specific plan template.
     * @param price plan price
     * @param templateId plan template id
     * @param deploymentId project deployment Id on plan
     */
    function createPlan(uint256 price, uint256 templateId, bytes32 deploymentId) external {
        require(!(IEraManager(settings.getEraManager()).maintenance()), 'G019');
        require(price > 0, 'PM005');
        require(v2templates[templateId].active, 'PM006');
        require(limits[msg.sender][deploymentId] < limit, 'PM007');

        plans[nextPlanId] = Plan(msg.sender, price, templateId, deploymentId, true);
        limits[msg.sender][deploymentId] += 1;

        emit PlanCreated(nextPlanId, msg.sender, deploymentId, templateId, price);
        nextPlanId++;
    }

    /**
     * @notice Allow Indexer to remove actived Plan.
     * @param planId Plan id to remove
     */
    function removePlan(uint256 planId) external {
        require(!(IEraManager(settings.getEraManager()).maintenance()), 'G019');
        require(plans[planId].indexer == msg.sender, 'PM008');

        bytes32 deploymentId = plans[planId].deploymentId;
        limits[msg.sender][deploymentId] -= 1;
        delete plans[planId];

        emit PlanRemoved(planId);
    }

    /**
     * @notice Allow Consumer to accept a plan created by an indexer.
     * Consumer transfer token to ServiceAgreementRegistry contract and a service agreement will be created when they accept the plan.
     * @param planId plan Id to accept
     * @param deploymentId project deployment Id
     */
    function acceptPlan(uint256 planId, bytes32 deploymentId) external {
        require(!(IEraManager(settings.getEraManager()).maintenance()), 'G019');
        Plan memory plan = plans[planId];
        require(plan.active, 'PM009');
        if (plan.deploymentId != bytes32(0)) {
            require(plan.deploymentId == deploymentId, 'PM010');
        } else {
            require(deploymentId != bytes32(0), 'PM011');
        }

        //stable price mode
        PlanTemplateV2 memory template = v2templates[plan.templateId];
        uint256 sqtPrice = convertPlanPriceToSQT(template.priceToken, plan.price);

        // create closed service agreement contract
        ClosedServiceAgreementInfo memory agreement = ClosedServiceAgreementInfo(
            msg.sender,
            plan.indexer,
            deploymentId,
            sqtPrice,
            block.timestamp,
            v2templates[plan.templateId].period,
            planId,
            plan.templateId
        );

        // deposit SQToken into serviceAgreementRegistry contract
        IERC20(settings.getSQToken()).transferFrom(msg.sender, settings.getServiceAgreementRegistry(), plan.price);

        // register the agreement to service agreement registry contract
        IServiceAgreementRegistry registry = IServiceAgreementRegistry(settings.getServiceAgreementRegistry());
        uint256 agreementId = registry.createClosedServiceAgreement(agreement);
        registry.establishServiceAgreement(agreementId);
    }

    /**
     * @notice Get a specific plan
     * @param planId plan id
     */
    function getPlan(uint256 planId) external view returns (Plan memory) {
        return plans[planId];
    }

    /**
     * @notice Get a specific plan templates
     * @param templateId plan template id
     */
    function getPlanTemplate(uint256 templateId) external view returns (PlanTemplateV2 memory) {
        if (v2templates[templateId].period > 0) {
            return v2templates[templateId];
        } else {
            PlanTemplate memory v1template = templates[templateId];
            return PlanTemplateV2(v1template.period, v1template.dailyReqCap, v1template.rateLimit, settings.getSQToken(), v1template.metadata, v1template.active);
        }
    }
}
