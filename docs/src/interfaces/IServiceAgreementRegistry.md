# Solidity API

## ClosedServiceAgreementInfo

```solidity
struct ClosedServiceAgreementInfo {
  address consumer;
  address indexer;
  bytes32 deploymentId;
  uint256 lockedAmount;
  uint256 startDate;
  uint256 period;
  uint256 planId;
  uint256 planTemplateId;
}
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

### nextServiceAgreementId

```solidity
function nextServiceAgreementId() external view returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

## ClosedServiceAgreementInfo

```solidity
struct ClosedServiceAgreementInfo {
  address consumer;
  address indexer;
  bytes32 deploymentId;
  uint256 lockedAmount;
  uint256 startDate;
  uint256 period;
  uint256 planId;
  uint256 planTemplateId;
}
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

### nextServiceAgreementId

```solidity
function nextServiceAgreementId() external view returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

## ClosedServiceAgreementInfo

```solidity
struct ClosedServiceAgreementInfo {
  address consumer;
  address indexer;
  bytes32 deploymentId;
  uint256 lockedAmount;
  uint256 startDate;
  uint256 period;
  uint256 planId;
  uint256 planTemplateId;
}
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

### nextServiceAgreementId

```solidity
function nextServiceAgreementId() external view returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

## ClosedServiceAgreementInfo

```solidity
struct ClosedServiceAgreementInfo {
  address consumer;
  address indexer;
  bytes32 deploymentId;
  uint256 lockedAmount;
  uint256 startDate;
  uint256 period;
  uint256 planId;
  uint256 planTemplateId;
}
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

### nextServiceAgreementId

```solidity
function nextServiceAgreementId() external view returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(address agreementContract) external
```

### hasOngoingServiceAgreement

```solidity
function hasOngoingServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

