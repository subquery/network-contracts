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
import './ClosedServiceAgreement.sol';

/**
 * @title Plan Manager Contract
 * @dev
 * ## Overview
 * The Plan Manager Contract tracks and maintains all the Plans and PlanTemplates.
 * It is the place Indexer create and publish a Plan for a specific deployment.
 * And also the place Consumer can search and take these Plan.
 *
 * ## Terminology
 * Plan: Plan is created by an Indexer,  a service agreement will be created once a consumer accept a plan.
 * PlanTemplate: PlanTemplate is create and maintenance by owner, we provide a set of PlanTemplates
 * for Indexer to create the Plan.
 */
contract PlanManager is Initializable, OwnableUpgradeable, IPlanManager {
    // -- Data --

    /**
     * @dev Plan is created by an Indexer,  a service agreement will be created once a consumer accept a plan.
     */
    struct Plan {
        uint256 price;
        uint256 planTemplateId;
        bytes32 deploymentId;
        bool active;
    }

    /**
     * @dev PlanTemplate is created and maintained by the owner, the owner provides a set of PlanTemplates for indexers to choose.
     *for Indexer and Consumer to create the Plan and Purchase Offer.
     */
    struct PlanTemplate {
        uint256 period;
        uint256 dailyReqCap;
        uint256 rateLimit;
        bytes32 metadata;
        bool active;
    }

    // -- Storage --

    ISettings public settings;
    //Number of planTemplate
    uint256 public planTemplateIds;
    //planTemplateId => planTemplate
    mapping(uint256 => PlanTemplate) public planTemplates;
    //indexer => index
    mapping(address => uint256) public planCount;
    //indexer => index => plan
    mapping(address => mapping(uint256 => Plan)) public plans;
    //indexer => deploymentId => planIds
    mapping(address => mapping(bytes32 => uint256[])) public planIds;
    //the limit of the plan that Indexer can create
    uint16 public indexerPlanLimit;

    // -- Events --

    /**
     * @dev Emitted when owner create a PlanTemplate.
     */
    event PlanTemplateCreated(uint256 indexed planTemplateId);
    /**
     * @dev Emitted when owner change the Metadata of a PlanTemplate.
     */
    event PlanTemplateMetadataChanged(uint256 indexed planTemplateId, bytes32 metadata);
    /**
     * @dev Emitted when owner change the status of a PlanTemplate. active or not
     */
    event PlanTemplateStatusChanged(uint256 indexed planTemplateId, bool active);
    /**
     * @dev Emitted when Indexer create a Plan.
     */
    event PlanCreated(
        address indexed creator,
        bytes32 indexed deploymentId,
        uint256 planTemplateId,
        uint256 planId,
        uint256 price
    );
    /**
     * @dev Emitted when Indexer remove a Plan.
     */
    event PlanRemoved(address indexed source, uint256 id, bytes32 deploymentId);

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
        indexerPlanLimit = 5;
    }

    function setIndexerPlanLimit(uint16 _indexerPlanLimit) external onlyOwner {
        indexerPlanLimit = _indexerPlanLimit;
    }

    /**
     * @dev Allow Owner to create a PlanTemplate.
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
     * @dev Allow Owner to update the Metadata of a PlanTemplate.
     */
    function updatePlanTemplateMetadata(uint256 _planTemplateId, bytes32 _metadata) external onlyOwner {
        require(planTemplates[_planTemplateId].period > 0, 'Plan template not existing');

        planTemplates[_planTemplateId].metadata = _metadata;

        emit PlanTemplateMetadataChanged(_planTemplateId, _metadata);
    }

    /**
     * @dev Allow Owner to update the status of a PlanTemplate.
     * active or not
     */
    function updatePlanTemplateStatus(uint256 _planTemplateId, bool _active) external onlyOwner {
        require(planTemplates[_planTemplateId].period > 0, 'Plan template not existing');

        planTemplates[_planTemplateId].active = _active;

        emit PlanTemplateStatusChanged(_planTemplateId, _active);
    }

    /**
     * @dev Allow Indexer to create a Plan basing on a specific plan template
     */
    function createPlan(
        uint256 _price,
        uint256 _planTemplateId,
        bytes32 _deploymentId
    ) external {
        require(_price > 0, 'Price need to be positive');
        require(planTemplates[_planTemplateId].active, 'Inactive plan template');
        require(planIds[msg.sender][_deploymentId].length < indexerPlanLimit, 'Indexer plan limitation reached');

        //make the planId start from 1
        uint256 _planCount = planCount[msg.sender] + 1;
        plans[msg.sender][_planCount] = Plan(_price, _planTemplateId, _deploymentId, true);
        planIds[msg.sender][_deploymentId].push(_planCount);
        planCount[msg.sender]++;

        emit PlanCreated(msg.sender, _deploymentId, _planTemplateId, _planCount, _price);
    }

    /**
     * @dev Allow Indexer to remove actived Plan.
     */
    function removePlan(uint256 _planId) external {
        require(plans[msg.sender][_planId].active, 'Inactive plan can not be removed');

        plans[msg.sender][_planId].active = false;
        bytes32 deploymentId = plans[msg.sender][_planId].deploymentId;

        // remove _planId from planIds
        uint256[] memory ids = planIds[msg.sender][deploymentId];
        delete planIds[msg.sender][deploymentId];
        for (uint256 i; i < ids.length; i++) {
            if (_planId != ids[i]) {
                planIds[msg.sender][deploymentId].push(_planId);
            }
        }
        planCount[msg.sender]--;

        emit PlanRemoved(msg.sender, _planId, deploymentId);
    }

    /**
     * @dev Allow Consumer to accept a plan created by an indexer. Consumer transfer token to
     * ServiceAgreementRegistry contract and a service agreement will be created
     * when they accept the plan.
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
        ClosedServiceAgreement serviceAgreement = new ClosedServiceAgreement(
            address(settings),
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

        IServiceAgreementRegistry(settings.getServiceAgreementRegistry()).establishServiceAgreement(
            address(serviceAgreement)
        );
    }

    // view function
    function templates() external view returns (PlanTemplate[] memory) {
        PlanTemplate[] memory _templates = new PlanTemplate[](planTemplateIds);
        for (uint256 i = 0; i < planTemplateIds; i++) {
            _templates[i] = planTemplates[i];
        }

        return _templates;
    }

    function indexerPlans(address indexer) external view returns (Plan[] memory) {
        Plan[] memory _plans = new Plan[](planCount[indexer]);
        for (uint256 i = 0; i < planCount[indexer]; i++) {
            _plans[i] = plans[indexer][i];
        }

        return _plans;
    }

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
