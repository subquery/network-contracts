# Solidity API

## ClosedServiceAgreement

### settings

```solidity
address settings
```

### consumer

```solidity
address consumer
```

### indexer

```solidity
address indexer
```

### deploymentId

```solidity
bytes32 deploymentId
```

### lockedAmount

```solidity
uint256 lockedAmount
```

### contractPeriod

```solidity
uint256 contractPeriod
```

### startDate

```solidity
uint256 startDate
```

### planId

```solidity
uint256 planId
```

### planTemplateId

```solidity
uint256 planTemplateId
```

### agreementType

```solidity
enum AgreementType agreementType
```

### constructor

```solidity
constructor(address _settings, address _consumer, address _indexer, bytes32 _deploymentId, uint256 _lockedAmount, uint256 _startDate, uint256 _contractPeriod, uint256 _planId, uint256 _planTemplateId) public
```

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

_See {IERC165-supportsInterface}._

### hasEnded

```solidity
function hasEnded() external view returns (bool)
```

### fireDispute

```solidity
function fireDispute() external
```

### period

```solidity
function period() external view returns (uint256)
```

### value

```solidity
function value() external view returns (uint256)
```

