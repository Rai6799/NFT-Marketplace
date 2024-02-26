//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./IPaymentMethods.sol";

contract PaymentMethods is
    ERC2771Context,
    Ownable,
    AccessControlEnumerable,
    IPaymentMethods
{
    address public forwarder;

    bytes32 public constant PRICE_UPDATER = keccak256("PRICE_UPDATER");

    event NewPaymentMethod(
        address indexed token,
        uint256 price,
        uint256 decimals,
        uint256 discount
    );
    event UpdatedPaymentMethod(
        address indexed token,
        uint256 price,
        uint256 discount
    );
    event UpdatedPaymentMethodStatus(address indexed token, bool active);

    struct PaymentMethod {
        uint256 price;
        uint256 decimals;
        uint256 discount;
        bool enable;
        bool exist;
    }

    mapping(address => PaymentMethod) public paymentMethods;

    constructor(
        address owner,
        address priceUpdater,
        address[] memory paymentMethodTokenAddress,
        uint256[] memory paymentMethodPrice,
        uint256[] memory paymentMethodDecimals,
        uint256[] memory paymentMethodDiscount,
        address forwarder_
    ) ERC2771Context(forwarder_) Ownable() {
        _transferOwnership(owner);
        forwarder = forwarder_;
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
        _setupRole(PRICE_UPDATER, priceUpdater);
        _addPaymentMethods(
            paymentMethodTokenAddress,
            paymentMethodPrice,
            paymentMethodDecimals,
            paymentMethodDiscount
        );
    }

    function updateForwarder(address forwarder_) external onlyOwner {
        forwarder = forwarder_;
    }

    function isTrustedForwarder(address forwarder_)
        public
        view
        override
        returns (bool)
    {
        return forwarder_ == forwarder;
    }

    function _addPaymentMethod(
        address tokenAddress,
        uint256 price,
        uint256 decimals,
        uint256 discount
    ) internal {
        require(
            !paymentMethods[tokenAddress].exist,
            "Payment method already exist"
        );
        paymentMethods[tokenAddress] = PaymentMethod(
            price,
            decimals,
            discount,
            true,
            true
        );
        emit NewPaymentMethod(tokenAddress, price, decimals, discount);
    }

    function _addPaymentMethods(
        address[] memory tokenAddress,
        uint256[] memory price,
        uint256[] memory decimals,
        uint256[] memory discount
    ) internal {
        require(
            (tokenAddress.length == price.length) &&
                (price.length == decimals.length) &&
                (decimals.length == discount.length),
            "Invalid params length"
        );
        for (uint256 i = 0; i < tokenAddress.length; i++) {
            _addPaymentMethod(
                tokenAddress[i],
                price[i],
                decimals[i],
                discount[i]
            );
        }
    }

    function addPaymentMethods(
        address[] memory tokenAddress,
        uint256[] memory price,
        uint256[] memory decimals,
        uint256[] memory discount
    ) external onlyOwner {
        _addPaymentMethods(tokenAddress, price, decimals, discount);
    }

    function addPaymentMethod(
        address tokenAddress,
        uint256 price,
        uint256 decimals,
        uint256 discount
    ) external onlyOwner {
        _addPaymentMethod(tokenAddress, price, decimals, discount);
    }

    function updatePaymentMethodStatus(address tokenAddress, bool status)
        external
        onlyOwner
    {
        require(
            paymentMethods[tokenAddress].enable != status,
            "Payment status not change"
        );
        paymentMethods[tokenAddress].enable = status;
        emit UpdatedPaymentMethodStatus(tokenAddress, status);
    }

    function removePaymentMethodStatus(address tokenAddress)
        external
        onlyOwner
    {
        require(paymentMethods[tokenAddress].exist, "Payment not exist");
        delete paymentMethods[tokenAddress];
        emit UpdatedPaymentMethodStatus(tokenAddress, false);
    }

    function updatePaymentMethod(
        address tokenAddress,
        uint256 price,
        uint256 discount
    ) external onlyRole(PRICE_UPDATER) {
        require(paymentMethods[tokenAddress].exist, "Payment method not exist");
        paymentMethods[tokenAddress].price = price;
        paymentMethods[tokenAddress].discount = discount;
        emit UpdatedPaymentMethod(tokenAddress, price, discount);
    }

    function paymentMethodAvailable(address tokenAddress)
        public
        view
        returns (bool)
    {
        return
            paymentMethods[tokenAddress].exist &&
            paymentMethods[tokenAddress].enable;
    }

    function paymentMethod(address tokenAddress)
        external
        view
        returns (
            uint256 price,
            uint256 factor,
            uint256 discount
        )
    {
        require(
            paymentMethodAvailable(tokenAddress),
            "Payment method unavailable"
        );
        PaymentMethod memory localPaymentMethod = paymentMethods[tokenAddress];
        price = localPaymentMethod.price;
        discount = localPaymentMethod.discount;
        factor = 10**localPaymentMethod.decimals;
    }

    function _msgSender()
        internal
        view
        virtual
        override(Context, ERC2771Context)
        returns (address sender)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }
}
//althabe.eth
