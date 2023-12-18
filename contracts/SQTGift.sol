// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract SQTGift is Initializable, OwnableUpgradeable, ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721EnumerableUpgradeable {

  struct RedeemRange {
    uint256 startTokenId;
    uint256 endTokenId;
    uint256 sqtValue;
  }
  
  address public sqtoken;
  uint256 public maxSupply;
  uint256 public maxSQT;

  uint256 public defaultSQTValue;
  uint256 public totalRedeemableSQT;
  uint256 public totalRedeemedSQT;

  bool public redeemable;

  RedeemRange[] public redeemRanges;
  mapping(address => bool) public allowlist;
  mapping(uint256 => uint256) public sqtRedeemableValue;

  event GiftMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 sqtValue);
  event GiftRedeemed(address indexed to, uint256 indexed tokenId, uint256 sqtValue);

  function initialize(uint256 _maxSupply, uint256 _maxSQT, address _sqtoken) external initializer {
    __Ownable_init();
    __ERC721_init("SQT Gift", "SQTG");
    __ERC721URIStorage_init();
    __ERC721Enumerable_init();

    maxSupply = _maxSupply;
    maxSQT = _maxSQT;
    sqtoken = _sqtoken;
  }

  function setMaxSupply(uint256 _maxSupply) external onlyOwner {
    maxSupply = _maxSupply;
  }

  function setMaxSQT(uint256 _maxSQT) external onlyOwner {
    maxSQT = _maxSQT;
  }

  function setDefaultSQTValue(uint256 _defaultSQTValue) external onlyOwner {
    defaultSQTValue = _defaultSQTValue;
  }

  function setRedeemable(bool _redeemable) external onlyOwner {
    redeemable = _redeemable;
  }

  function addToAllowlist(address _address) public onlyOwner {
    allowlist[_address] = true;
  }

  function removeFromAllowlist(address _address) public onlyOwner {
    allowlist[_address] = false;
  }

  function addRedeemRange(uint256 startId, uint256 endId, uint256 sqtValue) public onlyOwner {
    redeemRanges.push(RedeemRange(startId, endId, sqtValue));
  }

  function despositSQT(uint256 amount) public onlyOwner {
    require(IERC20(sqtoken).transferFrom(msg.sender, address(this), amount), 'Failed to transfer SQT');
  }

  function withdrawSQT(uint256 amount) public onlyOwner {
    require(IERC20(sqtoken).transfer(msg.sender, amount), 'Failed to transfer SQT');
  }

  function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override(
    ERC721Upgradeable, 
    ERC721EnumerableUpgradeable
  ) {
      super._beforeTokenTransfer(from, to, tokenId, batchSize);
  }

  function supportsInterface(bytes4 interfaceId) public view override(
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable
  ) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function tokenURI(uint256 tokenId) public view override(
    ERC721Upgradeable, 
    ERC721URIStorageUpgradeable
  ) returns (string memory) {
      return super.tokenURI(tokenId);
  }

  function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
      super._burn(tokenId);
  }

  function _baseURI() internal view virtual override returns (string memory) {
    return "ipfs://";
  }

  function _getSQTValueForTokenId(uint256 tokenId) private view returns (uint256) {
    for (uint i = 0; i < redeemRanges.length; i++) {
      if (tokenId >= redeemRanges[i].startTokenId && tokenId <= redeemRanges[i].endTokenId) {
          return redeemRanges[i].sqtValue;
      }
    }
    
    return defaultSQTValue;
  }

  function mint(string memory _tokenURI) public {
    require(allowlist[msg.sender], "Not on allowlist");
    require(totalSupply() < maxSupply, "Max gift supply reached");

    uint256 tokenId = totalSupply() + 1;
    uint256 sqtValue = _getSQTValueForTokenId(tokenId);
    totalRedeemableSQT += sqtValue;
    require(totalRedeemableSQT <= maxSQT, "Max SQT reached");
    sqtRedeemableValue[tokenId] = sqtValue;

    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, _tokenURI);

    allowlist[msg.sender] = false;

    emit GiftMinted(msg.sender, tokenId, _tokenURI, sqtValue);
  }

  function redeem(uint256 tokenId) public {
    require(redeemable, "Redeem not enabled");
    require(_exists(tokenId), "Token ID does not exist");
    require(ownerOf(tokenId) == msg.sender, "Not owner of token");
    require(sqtRedeemableValue[tokenId] > 0, "Token not redeemable");

    uint256 sqtValue = sqtRedeemableValue[tokenId];
    sqtRedeemableValue[tokenId] = 0;
    totalRedeemableSQT -= sqtValue;
    totalRedeemedSQT += sqtValue;

    require(IERC20(sqtoken).transfer(msg.sender, sqtValue), 'Failed to transfer SQT');
    _burn(tokenId);

    emit GiftRedeemed(msg.sender, tokenId, sqtValue);
  }
}