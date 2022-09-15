# Solidity API

## EraManager

_Produce epochs based on a period to coordinate contracts_

### settings

```solidity
contract ISettings settings
```

### eraPeriod

```solidity
uint256 eraPeriod
```

### eraNumber

```solidity
uint256 eraNumber
```

### eraStartTime

```solidity
uint256 eraStartTime
```

### EraPeriodUpdate

```solidity
event EraPeriodUpdate(uint256 era, uint256 eraPeriod)
```

### NewEraStart

```solidity
event NewEraStart(uint256 era, address caller)
```

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _eraPeriod) external
```

### startNewEra

```solidity
function startNewEra() public
```

_Start a new era if time already passed - anyone can call it_

### safeUpdateAndGetEra

```solidity
function safeUpdateAndGetEra() external returns (uint256)
```

### timestampToEraNumber

```solidity
function timestampToEraNumber(uint256 timestamp) external view returns (uint256)
```

### updateEraPeriod

```solidity
function updateEraPeriod(uint256 newEraPeriod) external
```

_Update era period - only admin can call it_

## EraManager

## EraManager

_Produce epochs based on a period to coordinate contracts_

### settings

```solidity
contract ISettings settings
```

### eraPeriod

```solidity
uint256 eraPeriod
```

### eraNumber

```solidity
uint256 eraNumber
```

### eraStartTime

```solidity
uint256 eraStartTime
```

### EraPeriodUpdate

```solidity
event EraPeriodUpdate(uint256 era, uint256 eraPeriod)
```

### NewEraStart

```solidity
event NewEraStart(uint256 era, address caller)
```

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _eraPeriod) external
```

### startNewEra

```solidity
function startNewEra() public
```

_Start a new era if time already passed - anyone can call it_

### safeUpdateAndGetEra

```solidity
function safeUpdateAndGetEra() external returns (uint256)
```

### timestampToEraNumber

```solidity
function timestampToEraNumber(uint256 timestamp) external view returns (uint256)
```

### updateEraPeriod

```solidity
function updateEraPeriod(uint256 newEraPeriod) external
```

_Update era period - only admin can call it_

