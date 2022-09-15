# Solidity API

## ChannelStatus

```solidity
enum ChannelStatus {
  Finalized,
  Open,
  Challenge
}
```

## ChannelState

```solidity
struct ChannelState {
  enum ChannelStatus status;
  address indexer;
  address consumer;
  uint256 total;
  uint256 spent;
  uint256 expirationAt;
  uint256 challengeAt;
  bytes32 deploymentId;
}
```

## QueryState

```solidity
struct QueryState {
  uint256 channelId;
  uint256 spent;
  bool isFinal;
  bytes indexerSign;
  bytes consumerSign;
}
```

## StateChannel

### settings

```solidity
contract ISettings settings
```

### challengeExpiration

```solidity
uint256 challengeExpiration
```

### ChannelOpen

```solidity
event ChannelOpen(uint256 channelId, address indexer, address consumer, uint256 total, uint256 expiration, bytes32 deploymentId)
```

### ChannelExtend

```solidity
event ChannelExtend(uint256 channelId, uint256 expiration)
```

### ChannelFund

```solidity
event ChannelFund(uint256 channelId, uint256 total)
```

### ChannelCheckpoint

```solidity
event ChannelCheckpoint(uint256 channelId, uint256 spent)
```

### ChannelChallenge

```solidity
event ChannelChallenge(uint256 channelId, uint256 spent, uint256 expiration)
```

### ChannelRespond

```solidity
event ChannelRespond(uint256 channelId, uint256 spent)
```

### ChannelFinalize

```solidity
event ChannelFinalize(uint256 channelId)
```

### channels

```solidity
mapping(uint256 => struct ChannelState) channels
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setChallengeExpiration

```solidity
function setChallengeExpiration(uint256 expiration) public
```

### channel

```solidity
function channel(uint256 channelId) public view returns (struct ChannelState)
```

### open

```solidity
function open(uint256 channelId, address indexer, address consumer, uint256 amount, uint256 expiration, bytes32 deploymentId, bytes callback, bytes indexerSign, bytes consumerSign) public
```

### extend

```solidity
function extend(uint256 channelId, uint256 preExpirationAt, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### fund

```solidity
function fund(uint256 channelId, uint256 amount, bytes sign) public
```

### checkpoint

```solidity
function checkpoint(struct QueryState query) public
```

### challenge

```solidity
function challenge(struct QueryState query) public
```

### respond

```solidity
function respond(struct QueryState query) public
```

### claim

```solidity
function claim(uint256 channelId) public
```

### _checkStateSign

```solidity
function _checkStateSign(uint256 channelId, bytes32 payload, bytes indexerSign, bytes consumerSign) private view
```

### _checkSign

```solidity
function _checkSign(bytes32 payload, bytes indexerSign, bytes consumerSign, address channelIndexer, address channelController, address channelConsumer) private pure
```

### _settlement

```solidity
function _settlement(struct QueryState query) private
```

### _finalize

```solidity
function _finalize(uint256 channelId) private
```

### _isContract

```solidity
function _isContract(address _addr) private view returns (bool)
```

## ChannelStatus

```solidity
enum ChannelStatus {
  Finalized,
  Open,
  Challenge
}
```

## ChannelState

```solidity
struct ChannelState {
  enum ChannelStatus status;
  address indexer;
  address consumer;
  uint256 total;
  uint256 spent;
  uint256 expirationAt;
  uint256 challengeAt;
  bytes32 deploymentId;
}
```

## QueryState

```solidity
struct QueryState {
  uint256 channelId;
  uint256 spent;
  bool isFinal;
  bytes indexerSign;
  bytes consumerSign;
}
```

## StateChannel

### settings

```solidity
contract ISettings settings
```

### challengeExpiration

```solidity
uint256 challengeExpiration
```

### ChannelOpen

```solidity
event ChannelOpen(uint256 channelId, address indexer, address consumer, uint256 total, uint256 expiration, bytes32 deploymentId)
```

### ChannelExtend

```solidity
event ChannelExtend(uint256 channelId, uint256 expiration)
```

### ChannelFund

```solidity
event ChannelFund(uint256 channelId, uint256 total)
```

### ChannelCheckpoint

```solidity
event ChannelCheckpoint(uint256 channelId, uint256 spent)
```

### ChannelChallenge

```solidity
event ChannelChallenge(uint256 channelId, uint256 spent, uint256 expiration)
```

### ChannelRespond

```solidity
event ChannelRespond(uint256 channelId, uint256 spent)
```

### ChannelFinalize

```solidity
event ChannelFinalize(uint256 channelId)
```

### channels

```solidity
mapping(uint256 => struct ChannelState) channels
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setChallengeExpiration

```solidity
function setChallengeExpiration(uint256 expiration) public
```

### channel

```solidity
function channel(uint256 channelId) public view returns (struct ChannelState)
```

### open

```solidity
function open(uint256 channelId, address indexer, address consumer, uint256 amount, uint256 expiration, bytes32 deploymentId, bytes callback, bytes indexerSign, bytes consumerSign) public
```

### extend

```solidity
function extend(uint256 channelId, uint256 preExpirationAt, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### fund

```solidity
function fund(uint256 channelId, uint256 amount, bytes sign) public
```

### checkpoint

```solidity
function checkpoint(struct QueryState query) public
```

### challenge

```solidity
function challenge(struct QueryState query) public
```

### respond

```solidity
function respond(struct QueryState query) public
```

### claim

```solidity
function claim(uint256 channelId) public
```

### _checkStateSign

```solidity
function _checkStateSign(uint256 channelId, bytes32 payload, bytes indexerSign, bytes consumerSign) private view
```

### _checkSign

```solidity
function _checkSign(bytes32 payload, bytes indexerSign, bytes consumerSign, address channelIndexer, address channelController, address channelConsumer) private pure
```

### _settlement

```solidity
function _settlement(struct QueryState query) private
```

### _finalize

```solidity
function _finalize(uint256 channelId) private
```

### _isContract

```solidity
function _isContract(address _addr) private view returns (bool)
```

## ChannelStatus

```solidity
enum ChannelStatus {
  Finalized,
  Open,
  Challenge
}
```

## ChannelState

```solidity
struct ChannelState {
  enum ChannelStatus status;
  address indexer;
  address consumer;
  uint256 total;
  uint256 spent;
  uint256 expirationAt;
  uint256 challengeAt;
  bytes32 deploymentId;
}
```

## QueryState

```solidity
struct QueryState {
  uint256 channelId;
  uint256 spent;
  bool isFinal;
  bytes indexerSign;
  bytes consumerSign;
}
```

## StateChannel

### settings

```solidity
contract ISettings settings
```

### challengeExpiration

```solidity
uint256 challengeExpiration
```

### ChannelOpen

```solidity
event ChannelOpen(uint256 channelId, address indexer, address consumer, uint256 total, uint256 expiration, bytes32 deploymentId)
```

### ChannelExtend

```solidity
event ChannelExtend(uint256 channelId, uint256 expiration)
```

### ChannelFund

```solidity
event ChannelFund(uint256 channelId, uint256 total)
```

### ChannelCheckpoint

```solidity
event ChannelCheckpoint(uint256 channelId, uint256 spent)
```

### ChannelChallenge

```solidity
event ChannelChallenge(uint256 channelId, uint256 spent, uint256 expiration)
```

### ChannelRespond

```solidity
event ChannelRespond(uint256 channelId, uint256 spent)
```

### ChannelFinalize

```solidity
event ChannelFinalize(uint256 channelId)
```

### channels

```solidity
mapping(uint256 => struct ChannelState) channels
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setChallengeExpiration

```solidity
function setChallengeExpiration(uint256 expiration) public
```

### channel

```solidity
function channel(uint256 channelId) public view returns (struct ChannelState)
```

### open

```solidity
function open(uint256 channelId, address indexer, address consumer, uint256 amount, uint256 expiration, bytes32 deploymentId, bytes callback, bytes indexerSign, bytes consumerSign) public
```

### extend

```solidity
function extend(uint256 channelId, uint256 preExpirationAt, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### fund

```solidity
function fund(uint256 channelId, uint256 amount, bytes sign) public
```

### checkpoint

```solidity
function checkpoint(struct QueryState query) public
```

### challenge

```solidity
function challenge(struct QueryState query) public
```

### respond

```solidity
function respond(struct QueryState query) public
```

### claim

```solidity
function claim(uint256 channelId) public
```

### _checkStateSign

```solidity
function _checkStateSign(uint256 channelId, bytes32 payload, bytes indexerSign, bytes consumerSign) private view
```

### _checkSign

```solidity
function _checkSign(bytes32 payload, bytes indexerSign, bytes consumerSign, address channelIndexer, address channelController, address channelConsumer) private pure
```

### _settlement

```solidity
function _settlement(struct QueryState query) private
```

### _finalize

```solidity
function _finalize(uint256 channelId) private
```

### _isContract

```solidity
function _isContract(address _addr) private view returns (bool)
```

## ChannelStatus

```solidity
enum ChannelStatus {
  Finalized,
  Open,
  Challenge
}
```

## ChannelState

```solidity
struct ChannelState {
  enum ChannelStatus status;
  address indexer;
  address consumer;
  uint256 count;
  uint256 balance;
  uint256 expirationAt;
  uint256 challengeAt;
}
```

## QueryState

```solidity
struct QueryState {
  uint256 channelId;
  bool isFinal;
  uint256 count;
  uint256 price;
  bytes indexerSign;
  bytes consumerSign;
}
```

## StateChannel

### settings

```solidity
contract ISettings settings
```

### challengeExpiration

```solidity
uint256 challengeExpiration
```

### ChannelOpen

```solidity
event ChannelOpen(uint256 channelId, address indexer, address consumer)
```

### ChannelCheckpoint

```solidity
event ChannelCheckpoint(uint256 channelId, uint256 count)
```

### ChannelChallenge

```solidity
event ChannelChallenge(uint256 channelId, uint256 count, uint256 expiration)
```

### ChannelRespond

```solidity
event ChannelRespond(uint256 channelId, uint256 count)
```

### ChannelFinalize

```solidity
event ChannelFinalize(uint256 channelId)
```

### channels

```solidity
mapping(uint256 => struct ChannelState) channels
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setChallengeExpiration

```solidity
function setChallengeExpiration(uint256 expiration) public
```

### channel

```solidity
function channel(uint256 channelId) public view returns (struct ChannelState)
```

### open

```solidity
function open(uint256 channelId, address payable indexer, address payable consumer, uint256 amount, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### extend

```solidity
function extend(uint256 channelId, uint256 preExpirationAt, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### fund

```solidity
function fund(uint256 channelId, uint256 amount, bytes sign) public
```

### checkpoint

```solidity
function checkpoint(struct QueryState query) public
```

### challenge

```solidity
function challenge(struct QueryState query) public
```

### respond

```solidity
function respond(struct QueryState query) public
```

### claim

```solidity
function claim(uint256 channelId) public
```

### _checkStateSign

```solidity
function _checkStateSign(uint256 channelId, bytes32 payload, bytes indexerSign, bytes consumerSign) private view
```

### _checkSign

```solidity
function _checkSign(bytes32 payload, bytes indexerSign, bytes consumerSign, address channelIndexer, address channelController, address channelConsumer) private pure
```

### _settlement

```solidity
function _settlement(struct QueryState query) private
```

### _finalize

```solidity
function _finalize(uint256 channelId) private
```

