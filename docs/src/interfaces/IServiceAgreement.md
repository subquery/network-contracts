# Solidity API

## AgreementType

```solidity
enum AgreementType {
  Closed,
  Open
}
```

## IServiceAgreement

### hasEnded

```solidity
function hasEnded() external view returns (bool)
```

### deploymentId

```solidity
function deploymentId() external view returns (bytes32)
```

### period

```solidity
function period() external view returns (uint256)
```

### startDate

```solidity
function startDate() external view returns (uint256)
```

### value

```solidity
function value() external view returns (uint256)
```

### agreementType

```solidity
function agreementType() external view returns (enum AgreementType)
```

## IClosedServiceAgreement

### indexer

```solidity
function indexer() external view returns (address)
```

### consumer

```solidity
function consumer() external view returns (address)
```

### planId

```solidity
function planId() external view returns (uint256)
```

### planTemplateId

```solidity
function planTemplateId() external view returns (uint256)
```

## IOpenServiceAgreement

### indexers

```solidity
function indexers() external view returns (address[])
```

### consumers

```solidity
function consumers() external view returns (address[])
```

