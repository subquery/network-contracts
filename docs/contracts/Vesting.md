# Solidity API

## Vesting

### VestingPlan

```solidity
struct VestingPlan {
  uint256 lockPeriod;
  uint256 vestingPeriod;
  uint256 initialUnlockPercent;
}
```

### token

```solidity
address token
```

### vestingStartDate

```solidity
uint256 vestingStartDate
```

### plans

```solidity
struct Vesting.VestingPlan[] plans
```

### userPlanId

```solidity
mapping(address => uint256) userPlanId
```

### allocations

```solidity
mapping(address => uint256) allocations
```

### claimed

```solidity
mapping(address => uint256) claimed
```

### totalAllocation

```solidity
uint256 totalAllocation
```

### totalClaimed

```solidity
uint256 totalClaimed
```

### AddVestingPlan

```solidity
event AddVestingPlan(uint256 planId, uint256 lockPeriod, uint256 vestingPeriod, uint256 initialUnlockPercent)
```

### constructor

```solidity
constructor(address _token) public
```

### addVestingPlan

```solidity
function addVestingPlan(uint256 _lockPeriod, uint256 _vestingPeriod, uint256 _initialUnlockPercent) public
```

### allocateVesting

```solidity
function allocateVesting(address addr, uint256 _planId, uint256 _allocation) public
```

### batchAllocateVesting

```solidity
function batchAllocateVesting(uint256 planId, address[] addrs, uint256[] _allocations) external
```

### depositByAdmin

```solidity
function depositByAdmin(uint256 amount) external
```

### withdrawAllByAdmin

```solidity
function withdrawAllByAdmin() external
```

### startVesting

```solidity
function startVesting(uint256 _vestingStartDate) external
```

### claim

```solidity
function claim() external
```

### claimableAmount

```solidity
function claimableAmount(address user) public view returns (uint256)
```

