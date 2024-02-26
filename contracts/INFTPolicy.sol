//SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./IPolicy.sol";

interface INFTPolicy is IPolicy {
    function isNFTTransferable(
        address token,
        address operator,
        address from,
        address to,
        uint256 tokenId
    ) external view returns (bool);
}
//althabe.eth
