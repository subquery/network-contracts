// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

contract AirdropperLite is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    // -- Data --

    struct Round {
        address tokenAddress; //airdrop token address
        uint256 roundStartTime; //start time for this round
        uint256 roundDeadline; //deadline for this round
    }

    mapping(address => mapping(uint256 => uint256)) public airdropRecord; //airdrop token amount per address per round
    mapping(uint256 => Round) public roundRecord;
    uint256 public nextRoundId;
    mapping(address => bool) public controllers;

    event RoundCreated(
        uint256 indexed roundId,
        address tokenAddress,
        uint256 roundStartTime,
        uint256 roundDeadline
    );

    event RoundUpdated(uint256 roundId, uint256 roundStartTime, uint256 roundDeadline);

    event AddAirdrop(address indexed addr, uint256 roundId, uint256 amount);

    modifier onlyController() {
        require(controllers[msg.sender], 'A010');
        _;
    }

    function initialize() external initializer {
        __Ownable_init();
        controllers[msg.sender] = true;
    }

    function addController(address controller) external onlyOwner {
        controllers[controller] = true;
    }

    function removeController(address controller) external onlyOwner {
        controllers[controller] = false;
    }

    function createRound(
        address _tokenAddr,
        uint256 _roundStartTime,
        uint256 _roundDeadline
    ) external onlyController returns (uint256) {
        require(_roundStartTime > block.timestamp && _roundDeadline > _roundStartTime, 'A001');
        require(_tokenAddr != address(0), 'G009');
        roundRecord[nextRoundId] = Round(_tokenAddr, _roundStartTime, _roundDeadline);
        nextRoundId += 1;
        emit RoundCreated(nextRoundId - 1, _tokenAddr, _roundStartTime, _roundDeadline);
        return nextRoundId - 1;
    }

    function updateRound(
        uint256 _roundId,
        uint256 _roundStartTime,
        uint256 _roundDeadline
    ) external onlyController {
        Round memory round = roundRecord[_roundId];
        require(round.roundStartTime > 0 && round.roundDeadline > block.timestamp, 'A011');
        require(_roundDeadline > _roundStartTime, 'A001');

        roundRecord[_roundId].roundStartTime = _roundStartTime;
        roundRecord[_roundId].roundDeadline = _roundDeadline;

        emit RoundUpdated(_roundId, _roundStartTime, _roundDeadline);
    }

    function withdrawByAdmin(address _tokenAddr, uint256 _amount) external onlyOwner {
        IERC20(_tokenAddr).safeTransfer(msg.sender, _amount);
    }

    function _airdrop(address _addr, uint256 _roundId, uint256 _amount) private {
        require(roundRecord[_roundId].roundDeadline > block.timestamp, 'A002');
        require(airdropRecord[_addr][_roundId] == 0, 'A003');
        require(_amount > 0, 'A004');

        airdropRecord[_addr][_roundId] = _amount;
        emit AddAirdrop(_addr, _roundId, _amount);
    }

    function batchAirdrop(
        address[] calldata _addrs,
        uint256[] calldata _roundIds,
        uint256[] calldata _amounts
    ) external onlyController {
        require(_addrs.length == _roundIds.length && _addrs.length == _amounts.length, 'G010');
        uint256 totalAmount;
        for (uint256 i = 0; i < _addrs.length; i++) {
            _airdrop(_addrs[i], _roundIds[i], _amounts[i]);
            unchecked {
                totalAmount += _amounts[i];
            }
        }
    }

    function claimAirdropFor(uint256 _roundId, address account) external {
        _claimAirdrop(_roundId, account);
    }

    function claimAirdrop(uint256 _roundId) external {
        _claimAirdrop(_roundId, msg.sender);
    }

    function _claimAirdrop(uint256 _roundId, address account) internal {
        require(
            roundRecord[_roundId].roundDeadline > block.timestamp &&
                roundRecord[_roundId].roundStartTime < block.timestamp,
            'A005'
        );
        uint256 amount = airdropRecord[account][_roundId];
        require(amount != 0, 'A006');

        require(
            IERC20(roundRecord[_roundId].tokenAddress).balanceOf(address(this)) >= amount,
            'A007'
        );
        IERC20(roundRecord[_roundId].tokenAddress).safeTransfer(account, amount);
        airdropRecord[account][_roundId] = 0;
    }

    function batchClaimAirdrop(uint256[] calldata _roundIds) external {
        for (uint256 i = 0; i < _roundIds.length; i++) {
            _claimAirdrop(_roundIds[i], msg.sender);
        }
    }

    function batchClaimFor(uint256[] calldata _roundIds, address[] calldata _accounts) external {
        require(_roundIds.length == _accounts.length, 'G020');
        for (uint256 i = 0; i < _roundIds.length; i++) {
            _claimAirdrop(_roundIds[i], _accounts[i]);
        }
    }
}
