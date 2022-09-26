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

/**
 * @title Plan Manager Contract
 * @notice
 * ### Overview
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
    /**
     * @notice Plan is created by an Indexer,  a service agreement will be created once a consumer accept a plan.
     */
    struct Plan {
        uint256 price;
        uint256 planTemplateId;
        bytes32 deploymentId;
        bool active;
    }

    /**
     * @notice PlanTemplate is created and maintained by the owner, the owner provides a set of PlanTemplates for indexers to choose. For Indexer and Consumer to create the Plan and Purchase Offer.
     */
    struct PlanTemplate {
        uint256 period;
        uint256 dailyReqCap;
        uint256 rateLimit;
        bytes32 metadata;
        bool active;
    }

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;
    /// @notice Number of planTemplate
    uint256 public planTemplateIds;
    /// @notice planTemplateId => planTemplate
    mapping(uint256 => PlanTemplate) public planTemplates;
    /// @notice indexer => index
    mapping(address => uint256) public nextPlanId;
    /// @notice indexer => index => plan
    mapping(address => mapping(uint256 => Plan)) public plans;
    /// @notice indexer => deploymentId => planIds
    mapping(address => mapping(bytes32 => uint256[])) public planIds;
    /// @notice the limit of the plan that Indexer can create
    uint16 public indexerPlanLimit;


    /// @dev ### EVENTS
    /// @notice Emitted when owner create a PlanTemplate.
    event PlanTemplateCreated(uint256 indexed planTemplateId);
    /// @notice Emitted when owner change the Metadata of a PlanTemplate.
    event PlanTemplateMetadataChanged(uint256 indexed planTemplateId, bytes32 metadata);
    /// @notice Emitted when owner change the status of a PlanTemplate. active or not
    event PlanTemplateStatusChanged(uint256 indexed planTemplateId, bool active);
    /// @notice Emitted when Indexer create a Plan.
    event PlanCreated(
        address indexed creator,
        bytes32 indexed deploymentId,
        uint256 planTemplateId,
        uint256 planId,
        uint256 price
    );
    /// @notice Emitted when Indexer remove a Plan.
    event PlanRemoved(address indexed source, uint256 id, bytes32 deploymentId);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize this contract to set the indexerPlanLimit be 5 which any indexer can create 5 plans.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
        indexerPlanLimit = 5;
    }

    /**
     * @notice Set the indexer plan limit.
     * @param _indexerPlanLimit indexerPlanLimit to set
     */
    function setIndexerPlanLimit(uint16 _indexerPlanLimit) external onlyOwner {
        indexerPlanLimit = _indexerPlanLimit;
    }

    /**
     * @notice Allow admin to create a PlanTemplate.
     * @param _period plan period
     * @param _dailyReqCap daily request limit
     * @param _rateLimit request rate limit
     * @param _metadata plan metadata
     */
    function createPlanTemplate(
        uint256 _period,
        uint256 _dailyReqCap,
        uint256 _rateLimit,
        bytes32 _metadata
    ) external onlyOwner {
        require(_period > 0, 'Period need to be positive');
        require(_dailyReqCap > 0, 'DailyReqCap need to be positive');
        require(_rateLimit > 0, 'RateLimit need to be positive');

        planTemplates[planTemplateIds] = PlanTemplate(_period, _dailyReqCap, _rateLimit, _metadata, true);

        emit PlanTemplateCreated(planTemplateIds);

        planTemplateIds++;
    }

    /**
     * @notice Allow admin to update the Metadata of a PlanTemplate.
     * @param _planTemplateId plan template id
     * @param _metadata metadata to update
     */
    function updatePlanTemplateMetadata(uint256 _planTemplateId, bytes32 _metadata) external onlyOwner {
        require(planTemplates[_planTemplateId].period > 0, 'Plan template not existing');

        planTemplates[_planTemplateId].metadata = _metadata;

        emit PlanTemplateMetadataChanged(_planTemplateId, _metadata);
    }

    /**
     * @notice Allow Owner to update the status of a PlanTemplate.
     * @param _planTemplateId plan template id
     * @param _active plan template active or not
     */
    function updatePlanTemplateStatus(uint256 _planTemplateId, bool _active) external onlyOwner {
        require(planTemplates[_planTemplateId].period > 0, 'Plan template not existing');

        planTemplates[_planTemplateId].active = _active;

        emit PlanTemplateStatusChanged(_planTemplateId, _active);
    }

    /**
     * @notice Allow Indexer to create a Plan basing on a specific plan template.
     * @param _price plan price
     * @param _planTemplateId plan template id
     * @param _deploymentId project deployment Id on plan
     */
    function createPlan(
        uint256 _price,
        uint256 _planTemplateId,
        bytes32 _deploymentId
    ) external {
        require(_price > 0, 'Price need to be positive');
        require(planTemplates[_planTemplateId].active, 'Inactive plan template');
        require(planIds[msg.sender][_deploymentId].length < indexerPlanLimit, 'Indexer plan limitation reached');

        nextPlanId[msg.sender]++;
        plans[msg.sender][nextPlanId[msg.sender]] = Plan(_price, _planTemplateId, _deploymentId, true);
        planIds[msg.sender][_deploymentId].push(nextPlanId[msg.sender]);
        
        emit PlanCreated(msg.sender, _deploymentId, _planTemplateId, nextPlanId[msg.sender], _price);
    }

    /**
     * @notice Allow Indexer to remove actived Plan.
     * @param _planId Plan id to remove
     */
    function removePlan(uint256 _planId) external {
        require(plans[msg.sender][_planId].active, 'Inactive plan can not be removed');

        bytes32 deploymentId = plans[msg.sender][_planId].deploymentId;

        // remove _planId from planIds
        uint256[] memory ids = planIds[msg.sender][deploymentId];
        delete planIds[msg.sender][deploymentId];
        for (uint256 i; i < ids.length; i++) {
            if (_planId != ids[i]) {
                planIds[msg.sender][deploymentId].push(_planId);
            }
        }

        delete plans[msg.sender][_planId];

        emit PlanRemoved(msg.sender, _planId, deploymentId);
    }

    /**
     * @notice Allow Consumer to accept a plan created by an indexer. Consumer transfer token to ServiceAgreementRegistry contract and a service agreement will be created when they accept the plan.
     * @param _indexer indexer address
     * @param _deploymentId deployment Id 
     * @param _planId plan Id to accept
     */
    function acceptPlan(
        address _indexer,
        bytes32 _deploymentId,
        uint256 _planId
    ) external {
        Plan memory plan = plans[_indexer][_planId];
        require(plan.active, 'Inactive plan');
        require(_deploymentId != bytes32(0), 'DeploymentId can not be empty');
        require(
            plan.deploymentId == ((planIds[_indexer][_deploymentId].length == 0) ? bytes32(0) : _deploymentId),
            'Plan not match with the deployment'
        );

        // create closed service agreement contract
        ClosedServiceAgreementInfo memory agreement = ClosedServiceAgreementInfo(
            msg.sender,
            _indexer,
            _deploymentId,
            plan.price,
            block.timestamp,
            planTemplates[plan.planTemplateId].period,
            _planId,
            plan.planTemplateId
        );
        // deposit SQToken into serviceAgreementRegistry contract
        require(
            IERC20(settings.getSQToken()).transferFrom(msg.sender, settings.getServiceAgreementRegistry(), plan.price),
            'transfer fail'
        );

        // register the agreement to service agreement registry contract
        IServiceAgreementRegistry registry = IServiceAgreementRegistry(settings.getServiceAgreementRegistry());
        uint256 agreementId = registry.createClosedServiceAgreement(agreement);
        registry.establishServiceAgreement(agreementId);
    }

    /**
     * @notice Get all plan templates
     */
    function templates() external view returns (PlanTemplate[] memory) {
        PlanTemplate[] memory _templates = new PlanTemplate[](planTemplateIds);
        for (uint256 i = 0; i < planTemplateIds; i++) {
            _templates[i] = planTemplates[i];
        }

        return _templates;
    }

    /**
     * @notice Get a specific plan
     * @param indexer indexer address
     * @param planId plan id
     */
    function getPlan(address indexer, uint256 planId)
        external
        view
        returns (
            uint256 price,
            uint256 planTemplateId,
            bytes32 deploymentId,
            bool active
        )
    {
        Plan memory plan = plans[indexer][planId];
        price = plan.price;
        planTemplateId = plan.planTemplateId;
        deploymentId = plan.deploymentId;
        active = plan.active;
    }

    /**
     * @notice Get a specific plan templates
     * @param planTemplateId plan template id
     */
    function getPlanTemplate(uint256 planTemplateId)
        external
        view
        returns (
            uint256 period,
            uint256 dailyReqCap,
            uint256 rateLimit,
            bytes32 metadata,
            bool active
        )
    {
        PlanTemplate memory planTemplate = planTemplates[planTemplateId];
        period = planTemplate.period;
        dailyReqCap = planTemplate.dailyReqCap;
        rateLimit = planTemplate.rateLimit;
        metadata = planTemplate.metadata;
        active = planTemplate.active;
    }
}
