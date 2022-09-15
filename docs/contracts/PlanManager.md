# Solidity API

## PlanManager

### Plan

```solidity
struct Plan {
  uint256 price;
  uint256 planTemplateId;
  bytes32 deploymentId;
  bool active;
}
```

### PlanTemplate

```solidity
struct PlanTemplate {
  uint256 period;
  uint256 dailyReqCap;
  uint256 rateLimit;
  bytes32 metadata;
  bool active;
}
```

### settings

```solidity
contract ISettings settings
```

### planTemplateIds

```solidity
uint256 planTemplateIds
```

### planTemplates

```solidity
mapping(uint256 => struct PlanManager.PlanTemplate) planTemplates
```

### nextPlanId

```solidity
mapping(address => uint256) nextPlanId
```

### plans

```solidity
mapping(address => mapping(uint256 => struct PlanManager.Plan)) plans
```

### planIds

```solidity
mapping(address => mapping(bytes32 => uint256[])) planIds
```

### indexerPlanLimit

```solidity
uint16 indexerPlanLimit
```

### PlanTemplateCreated

```solidity
event PlanTemplateCreated(uint256 planTemplateId)
```

_Emitted when owner create a PlanTemplate._

### PlanTemplateMetadataChanged

```solidity
event PlanTemplateMetadataChanged(uint256 planTemplateId, bytes32 metadata)
```

_Emitted when owner change the Metadata of a PlanTemplate._

### PlanTemplateStatusChanged

```solidity
event PlanTemplateStatusChanged(uint256 planTemplateId, bool active)
```

_Emitted when owner change the status of a PlanTemplate. active or not_

### PlanCreated

```solidity
event PlanCreated(address creator, bytes32 deploymentId, uint256 planTemplateId, uint256 planId, uint256 price)
```

_Emitted when Indexer create a Plan._

### PlanRemoved

```solidity
event PlanRemoved(address source, uint256 id, bytes32 deploymentId)
```

_Emitted when Indexer remove a Plan._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setIndexerPlanLimit

```solidity
function setIndexerPlanLimit(uint16 _indexerPlanLimit) external
```

### createPlanTemplate

```solidity
function createPlanTemplate(uint256 _period, uint256 _dailyReqCap, uint256 _rateLimit, bytes32 _metadata) external
```

_Allow Owner to create a PlanTemplate._

### updatePlanTemplateMetadata

```solidity
function updatePlanTemplateMetadata(uint256 _planTemplateId, bytes32 _metadata) external
```

_Allow Owner to update the Metadata of a PlanTemplate._

### updatePlanTemplateStatus

```solidity
function updatePlanTemplateStatus(uint256 _planTemplateId, bool _active) external
```

_Allow Owner to update the status of a PlanTemplate.
active or not_

### createPlan

```solidity
function createPlan(uint256 _price, uint256 _planTemplateId, bytes32 _deploymentId) external
```

_Allow Indexer to create a Plan basing on a specific plan template_

### removePlan

```solidity
function removePlan(uint256 _planId) external
```

_Allow Indexer to remove actived Plan._

### acceptPlan

```solidity
function acceptPlan(address _indexer, bytes32 _deploymentId, uint256 _planId) external
```

_Allow Consumer to accept a plan created by an indexer. Consumer transfer token to
ServiceAgreementRegistry contract and a service agreement will be created
when they accept the plan._

### templates

```solidity
function templates() external view returns (struct PlanManager.PlanTemplate[])
```

### getPlan

```solidity
function getPlan(address indexer, uint256 planId) external view returns (uint256 price, uint256 planTemplateId, bytes32 deploymentId, bool active)
```

### getPlanTemplate

```solidity
function getPlanTemplate(uint256 planTemplateId) external view returns (uint256 period, uint256 dailyReqCap, uint256 rateLimit, bytes32 metadata, bool active)
```

## PlanManager

## PlanManager

### Plan

```solidity
struct Plan {
  uint256 price;
  uint256 planTemplateId;
  bytes32 deploymentId;
  bool active;
}
```

### PlanTemplate

```solidity
struct PlanTemplate {
  uint256 period;
  uint256 dailyReqCap;
  uint256 rateLimit;
  bytes32 metadata;
  bool active;
}
```

### settings

```solidity
contract ISettings settings
```

### planTemplateIds

```solidity
uint256 planTemplateIds
```

### planTemplates

```solidity
mapping(uint256 => struct PlanManager.PlanTemplate) planTemplates
```

### planCount

```solidity
mapping(address => uint256) planCount
```

### plans

```solidity
mapping(address => mapping(uint256 => struct PlanManager.Plan)) plans
```

### planIds

```solidity
mapping(address => mapping(bytes32 => uint256[])) planIds
```

### indexerPlanLimit

```solidity
uint16 indexerPlanLimit
```

### PlanTemplateCreated

```solidity
event PlanTemplateCreated(uint256 planTemplateId)
```

_Emitted when owner create a PlanTemplate._

### PlanTemplateMetadataChanged

```solidity
event PlanTemplateMetadataChanged(uint256 planTemplateId, bytes32 metadata)
```

_Emitted when owner change the Metadata of a PlanTemplate._

### PlanTemplateStatusChanged

```solidity
event PlanTemplateStatusChanged(uint256 planTemplateId, bool active)
```

_Emitted when owner change the status of a PlanTemplate. active or not_

### PlanCreated

```solidity
event PlanCreated(address creator, bytes32 deploymentId, uint256 planTemplateId, uint256 planId, uint256 price)
```

_Emitted when Indexer create a Plan._

### PlanRemoved

```solidity
event PlanRemoved(address source, uint256 id, bytes32 deploymentId)
```

_Emitted when Indexer remove a Plan._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setIndexerPlanLimit

```solidity
function setIndexerPlanLimit(uint16 _indexerPlanLimit) external
```

### createPlanTemplate

```solidity
function createPlanTemplate(uint256 _period, uint256 _dailyReqCap, uint256 _rateLimit, bytes32 _metadata) external
```

_Allow Owner to create a PlanTemplate._

### updatePlanTemplateMetadata

```solidity
function updatePlanTemplateMetadata(uint256 _planTemplateId, bytes32 _metadata) external
```

_Allow Owner to update the Metadata of a PlanTemplate._

### updatePlanTemplateStatus

```solidity
function updatePlanTemplateStatus(uint256 _planTemplateId, bool _active) external
```

_Allow Owner to update the status of a PlanTemplate.
active or not_

### createPlan

```solidity
function createPlan(uint256 _price, uint256 _planTemplateId, bytes32 _deploymentId) external
```

_Allow Indexer to create a Plan basing on a specific plan template_

### removePlan

```solidity
function removePlan(uint256 _planId) external
```

_Allow Indexer to remove actived Plan._

### acceptPlan

```solidity
function acceptPlan(address _indexer, bytes32 _deploymentId, uint256 _planId) external
```

_Allow Consumer to accept a plan created by an indexer. Consumer transfer token to
ServiceAgreementRegistry contract and a service agreement will be created
when they accept the plan._

### templates

```solidity
function templates() external view returns (struct PlanManager.PlanTemplate[])
```

### indexerPlans

```solidity
function indexerPlans(address indexer) external view returns (struct PlanManager.Plan[])
```

### getPlan

```solidity
function getPlan(address indexer, uint256 planId) external view returns (uint256 price, uint256 planTemplateId, bytes32 deploymentId, bool active)
```

### getPlanTemplate

```solidity
function getPlanTemplate(uint256 planTemplateId) external view returns (uint256 period, uint256 dailyReqCap, uint256 rateLimit, bytes32 metadata, bool active)
```

