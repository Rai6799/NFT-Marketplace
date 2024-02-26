//SPDX-License-Identifier: MIT
//Author: althabe.eth, gioojeda.eth
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "./IERC4907.sol";

interface IMokensNFT is IERC721Upgradeable, IERC4907 {
    function mint(address to, bytes32 tokenHash) external;

    function mintBatch(address to, bytes32[] memory tokensHash) external;

    function tokenHashById(uint256 tokenId) external view returns (bytes32);

    function tokenIdByHash(bytes32 tokenHash) external view returns (uint256);
}
