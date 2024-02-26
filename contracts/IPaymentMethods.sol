//SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IPaymentMethods {
    function paymentMethodAvailable(address tokenAddress)
        external
        view
        returns (bool);

    function paymentMethod(address tokenAddress)
        external
        view
        returns (
            uint256 price,
            uint256 factor,
            uint256 discount
        );
}
//althabe.eth
