// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/IERC777.sol";

contract MockOperator {
    function operate(
        IERC777 token,
        address from,
        address to,
        uint256 amount
    ) external {
        token.operatorSend(from, to, amount, "", "");
    }

    function operate(
        IERC777 token,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external {
        token.operatorSend(from, to, amount, data, operatorData);
    }
}
//althabe.eth
