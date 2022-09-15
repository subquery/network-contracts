# Solidity API

## SQToken

### minter

```solidity
address minter
```

### isMinter

```solidity
modifier isMinter()
```

### constructor

```solidity
constructor(address _minter) public
```

### mint

```solidity
function mint(address destination, uint256 amount) external
```

### setMinter

```solidity
function setMinter(address _minter) external
```

#if_succeeds {:msg "minter should be set"} minter == _minter;
#if_succeeds {:msg "owner functionality"} old(msg.sender == address(owner));

### getMinter

```solidity
function getMinter() external view returns (address)
```

