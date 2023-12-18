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

import './interfaces/ISQTGift.sol';

contract SQTGift is Initializable, OwnableUpgradeable, ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721EnumerableUpgradeable, ISQTGift {
  
  address public sqtoken;
  address public redeemer;

  uint256 public maxSupply;
  uint256 public maxSQT;

  uint256 public defaultSQTValue;
  uint256 public totalRedeemableSQT;
  uint256 public totalRedeemedSQT;

  RedeemRange[] public redeemRanges;
  mapping(address => bool) public allowlist;
  mapping(uint256 => uint256) public sqtRedeemableValue;

  event GiftMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 sqtValue);

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

  function setRedeemer(address _redeemer) external onlyOwner {
    redeemer = _redeemer;
  }

  function setDefaultSQTValue(uint256 _defaultSQTValue) external onlyOwner {
    defaultSQTValue = _defaultSQTValue;
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

  function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override(
    ERC721Upgradeable, 
    ERC721EnumerableUpgradeable
  ) {
      super._beforeTokenTransfer(from, to, tokenId, batchSize);
  }

  function supportsInterface(bytes4 interfaceId) public view override(
    IERC165Upgradeable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable
  ) returns (bool) {
    return interfaceId == type(ISQTGift).interfaceId || super.supportsInterface(interfaceId);
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

  function afterTokenRedeem(uint256 tokenId) external {
    require(msg.sender == redeemer, "Not redeemer");

    uint256 sqtValue = sqtRedeemableValue[tokenId];
    sqtRedeemableValue[tokenId] = 0;
    totalRedeemableSQT -= sqtValue;
    totalRedeemedSQT += sqtValue;
    
    _burn(tokenId);
  }

  function getSQTRedeemableValue(uint256 tokenId) external view returns (uint256) {
    return sqtRedeemableValue[tokenId];
  }
}