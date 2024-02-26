//SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IPolicy {
    function isTransferable(
        address token,
        address operator,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);

    function isOperatorFor(
        address token,
        address operator,
        address tokenHolder
    ) external view returns (bool);
}
//althabe.eth
