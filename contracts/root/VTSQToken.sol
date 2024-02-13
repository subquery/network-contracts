// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract VTSQToken is ERC20, Ownable, ERC20Burnable {
    using SafeERC20 for IERC20;
    address public minter;

    modifier isMinter() {
        require(minter == msg.sender, 'Not minter');
        _;
    }

    constructor(address _minter) ERC20('VTSubQueryToken', 'vtSQT') Ownable() {
        minter = _minter;
    }

    function mint(address destination, uint256 amount) external isMinter {
        _mint(destination, amount);
    }

    /// #if_succeeds {:msg "minter should be set"} minter == _minter;
    /// #if_succeeds {:msg "owner functionality"} old(msg.sender == address(owner));
    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    function getMinter() external view returns (address) {
        return minter;
    }

    // @notice skip spender check when it is requested by minter (vesting contract)
    function burnFrom(address account, uint256 amount) public override {
        if (_msgSender() != minter) {
            _spendAllowance(account, _msgSender(), amount);
        }
        _burn(account, amount);
    }
}
