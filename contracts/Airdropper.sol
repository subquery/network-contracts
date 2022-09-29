// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '../node_modules/@openzeppelin/contracts/access/Ownable.sol';
import '../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract Airdropper is Ownable {
    using SafeERC20 for IERC20;
    // -- Data --

    struct Round {
        address tokenAddress; //airdrop token address
        uint256 roundStartTime; //strat time for this round
        uint256 roundDeadline; //deadline for this round
        uint256 unclaimedAmount;
    }

    mapping(address => mapping(uint256 => uint256)) public airdropRecord; //airdrop token amount per address per round
    mapping(uint256 => Round) public roundRecord;
    uint256 public nextRoundId;
    address public settleDestination;

    event RoundCreated(uint256 indexed roundId, address tokenAddress, uint256 roundStartTime, uint256 roundDeadline);

    event AddAirdrop(address indexed addr, uint256 roundId, uint256 amount);

    event AirdropClaimed(address indexed addr, uint256 roundId, uint256 amount);

    event RoundSettled(uint256 indexed roundId, address settleDestination, uint256 unclaimAmount);

    function setSettleDestination(address _settleDestination) external onlyOwner {
        settleDestination = _settleDestination;
    }

    function createRound(
        address _tokenAddr,
        uint256 _roundStratTime,
        uint256 _roundDeadline
    ) external onlyOwner returns (uint256) {
        require(_roundStratTime > block.timestamp && _roundDeadline > _roundStratTime, 'invaild round time set');
        require(_tokenAddr != address(0), 'invaild token address');
        roundRecord[nextRoundId] = Round(_tokenAddr, _roundStratTime, _roundDeadline, 0);
        nextRoundId += 1;
        emit RoundCreated(nextRoundId - 1, _tokenAddr, _roundStratTime, _roundDeadline);
        return nextRoundId - 1;
    }

    function _airdrop(
        address _addr,
        uint256 _roundId,
        uint256 _amount
    ) private {
        require(roundRecord[_roundId].roundStartTime > block.timestamp, 'invaild round to airdrop');
        require(airdropRecord[_addr][_roundId] == 0, 'duplicate airdrop');
        require(_amount > 0, 'invaild airdrop amount');

        IERC20(roundRecord[_roundId].tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        airdropRecord[_addr][_roundId] = _amount;
        roundRecord[_roundId].unclaimedAmount += _amount;
        emit AddAirdrop(_addr, _roundId, _amount);
    }

    function batchAirdrop(
        address[] calldata _addr,
        uint256[] calldata _roundId,
        uint256[] calldata _amount
    ) external onlyOwner {
        require(_addr.length == _roundId.length && _addr.length == _amount.length, 'invaild parameters');
        for (uint256 i = 0; i < _addr.length; i++) {
            _airdrop(_addr[i], _roundId[i], _amount[i]);
        }
    }

    function claimAirdrop(uint256 _roundId) public {
        require(
            roundRecord[_roundId].roundDeadline > block.timestamp &&
                roundRecord[_roundId].roundStartTime < block.timestamp,
            'invaild round to claim'
        );
        uint256 amount = airdropRecord[msg.sender][_roundId];
        require(amount != 0, 'nothing claim');

        require(
            IERC20(roundRecord[_roundId].tokenAddress).balanceOf(address(this)) >= amount,
            'Airdropper: insufficient assets'
        );
        IERC20(roundRecord[_roundId].tokenAddress).safeTransfer(msg.sender, amount);
        airdropRecord[msg.sender][_roundId] = 0;

        roundRecord[_roundId].unclaimedAmount -= amount;
        emit AirdropClaimed(msg.sender, _roundId, amount);
    }

    function batchClaimAirdrop(uint256[] calldata _roundIds) public {
        for (uint256 i = 0; i < _roundIds.length; i++) {
            claimAirdrop(_roundIds[i]);
        }
    }

    function settleEndedRound(uint256 _roundId) public {
        require(roundRecord[_roundId].roundDeadline < block.timestamp, 'invaild round to settle');
        uint256 unclaimAmount = roundRecord[_roundId].unclaimedAmount;
        require(unclaimAmount != 0, 'none token left');
        require(
            IERC20(roundRecord[_roundId].tokenAddress).balanceOf(address(this)) >=
                roundRecord[_roundId].unclaimedAmount,
            'Airdropper: insufficient assets'
        );
        IERC20(roundRecord[_roundId].tokenAddress).safeTransfer(
            settleDestination,
            roundRecord[_roundId].unclaimedAmount
        );
        roundRecord[_roundId].unclaimedAmount = 0;
        emit RoundSettled(_roundId, settleDestination, unclaimAmount);
    }
}
