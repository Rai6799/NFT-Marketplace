// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "./IMokensNFT.sol";
import "./IPaymentMethods.sol";

contract Marketplace is
    OwnableUpgradeable,
    IERC721ReceiverUpgradeable,
    ERC2771ContextUpgradeable
{
    event NewSellOffer(
        address indexed publisher,
        uint256 indexed tokenId,
        uint256 price
    );
    event NewRentOffer(
        address indexed publisher,
        uint256 indexed tokenId,
        uint256 price,
        uint256 rentDuration
    );
    event UpdateOfferPrice(uint256 indexed tokenId, uint256 price);
    event UpdateOfferRentDuration(
        uint256 indexed tokenId,
        uint256 rentDuration
    );
    event CancelOffer(uint256 indexed tokenId);
    event OfferTaken(
        uint256 indexed tokenId,
        address indexed paymentToken,
        OfferType indexed type_,
        uint256 commission
    );

    event ForwarderUpdated(address indexed forwarder);
    event VaultUpdated(address indexed vault);

    address public forwarder;
    address public vault;

    IPaymentMethods public paymentMethods;

    IMokensNFT public mokensNFT;
    uint256 public commission;
    uint256 public constant COMMISSION_FACTOR = 10**4; // 4 Decimals

    enum OfferType {
        Sell,
        Rent
    }

    struct Offer {
        address publisher;
        uint256 price;
        OfferType type_;
        uint64 rentDuration;
        uint256 createdAt;
    }

    mapping(uint256 => address) public offers_publisher;
    mapping(uint256 => uint256) public offers_price;
    mapping(uint256 => OfferType) public offers_type;
    mapping(uint256 => uint64) public offers_rentDuration;
    mapping(uint256 => uint256) public offers_createdAt;

    modifier offerExistence(uint256 tokenId, bool exist) {
        if (exist) {
            require(offers_createdAt[tokenId] != 0, "Offer not exist");
        } else {
            require(offers_createdAt[tokenId] == 0, "Offer already exist");
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address forwarder_) ERC2771ContextUpgradeable(forwarder_) {
        _disableInitializers();
    }

    function initialize(
        address owner,
        IMokensNFT mokensNFT_,
        IPaymentMethods paymentMethods_,
        address vault_,
        address forwarder_,
        uint256 commission_
    ) public initializer {
        __Context_init();
        __Ownable_init();
        _transferOwnership(owner);
        forwarder = forwarder_;
        vault = vault_;
        paymentMethods = paymentMethods_;
        mokensNFT = mokensNFT_;
        commission = commission_;
    }

    function getOffer(uint256 tokenId)
        public
        view
        returns (
            address publisher,
            uint256 price,
            OfferType type_,
            uint256 rentDuration,
            uint256 createdAt
        )
    {
        publisher = offers_publisher[tokenId];
        price = offers_price[tokenId];
        type_ = offers_type[tokenId];
        rentDuration = offers_rentDuration[tokenId];
        createdAt = offers_createdAt[tokenId];
    }

    function createOffer(
        uint256 tokenId,
        uint256 price,
        OfferType type_,
        uint64 rentDuration
    ) public offerExistence(tokenId, false) {
        require(mokensNFT.userOf(tokenId) == address(0), "Token rented");
        offers_createdAt[tokenId] = block.timestamp;
        offers_publisher[tokenId] = _msgSender();
        offers_price[tokenId] = price;
        offers_type[tokenId] = type_;
        offers_rentDuration[tokenId] = rentDuration;
        mokensNFT.safeTransferFrom(_msgSender(), address(this), tokenId);
        if (type_ == OfferType.Sell) {
            emit NewSellOffer(offers_publisher[tokenId], tokenId, price);
        } else {
            emit NewRentOffer(
                offers_publisher[tokenId],
                tokenId,
                price,
                rentDuration
            );
        }
    }

    function createRentOffer(
        uint256 tokenId,
        uint256 price,
        uint64 rentDuration
    ) external {
        createOffer(tokenId, price, OfferType.Rent, rentDuration);
    }

    function createSellOffer(uint256 tokenId, uint256 price) external {
        createOffer(tokenId, price, OfferType.Sell, 0);
    }

    function updateOfferPrice(uint256 tokenId, uint256 price)
        external
        offerExistence(tokenId, true)
    {
        require(offers_publisher[tokenId] == _msgSender(), "Invalid sender");
        offers_price[tokenId] = price;
        emit UpdateOfferPrice(tokenId, price);
    }

    function updateOfferRentDuration(uint256 tokenId, uint64 rentDuration)
        external
        offerExistence(tokenId, true)
    {
        require(offers_publisher[tokenId] == _msgSender(), "Invalid sender");
        offers_rentDuration[tokenId] = rentDuration;
        emit UpdateOfferRentDuration(tokenId, rentDuration);
    }

    function cancelOffer(uint256 tokenId)
        external
        offerExistence(tokenId, true)
    {
        require(offers_publisher[tokenId] == _msgSender(), "Invalid sender");
        offers_createdAt[tokenId] = 0;
        mokensNFT.safeTransferFrom(
            address(this),
            offers_publisher[tokenId],
            tokenId
        );
        emit CancelOffer(tokenId);
    }

    function takeOffer(uint256 tokenId, address paymentToken)
        external
        payable
        offerExistence(tokenId, true)
    {
        require(
            paymentMethods.paymentMethodAvailable(paymentToken),
            "Payment method not available"
        );
        if (offers_type[tokenId] == OfferType.Sell) {
            offers_createdAt[tokenId] = 0;
        }
        (
            uint256 paymentTokenPrice,
            uint256 paymentTokenPriceFactor,
            uint256 paymentTokenDiscount
        ) = paymentMethods.paymentMethod(paymentToken);

        uint256 priceInPayToken = (offers_price[tokenId] * paymentTokenPrice) /
            paymentTokenPriceFactor;

        if (paymentTokenDiscount > 0) {
            uint256 discountAmount = (priceInPayToken * paymentTokenDiscount) /
                paymentTokenPriceFactor;
            priceInPayToken = priceInPayToken - discountAmount;
        }

        uint256 localCommission = (priceInPayToken * commission) /
            COMMISSION_FACTOR;

        if (paymentToken != address(0)) {
            IERC20Upgradeable paymentTokenContract = IERC20Upgradeable(
                paymentToken
            );
            require(
                paymentTokenContract.transferFrom(
                    _msgSender(),
                    offers_publisher[tokenId],
                    priceInPayToken - localCommission
                ),
                "Can't transfer payment"
            );
            require(
                paymentTokenContract.transferFrom(
                    _msgSender(),
                    vault,
                    localCommission
                ),
                "Can't transfer commission"
            );
        } else {
            // Native
            require(
                msg.value >= priceInPayToken,
                "Not enough funds transferred"
            );
            payable(offers_publisher[tokenId]).transfer(
                priceInPayToken - localCommission
            );
            payable(vault).transfer(localCommission);
            payable(_msgSender()).transfer(msg.value - (priceInPayToken));
        }

        if (offers_type[tokenId] == OfferType.Rent) {
            mokensNFT.setUser(
                tokenId,
                _msgSender(),
                uint64(block.timestamp) + offers_rentDuration[tokenId]
            );
        } else {
            mokensNFT.transferFrom(address(this), _msgSender(), tokenId);
        }
        emit OfferTaken(
            tokenId,
            paymentToken,
            offers_type[tokenId],
            localCommission
        );
    }

    function updateForwarder(address forwarder_) external onlyOwner {
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder);
    }

    function updateVault(address vault_) external onlyOwner {
        vault = vault_;
        emit VaultUpdated(vault);
    }

    function updatePaymentMethods(IPaymentMethods paymentMethods_)
        external
        onlyOwner
    {
        paymentMethods = paymentMethods_;
    }

    function updateCommission(uint256 commission_) external onlyOwner {
        commission = commission_;
    }

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (address sender)
    {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771ContextUpgradeable._msgData();
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }
}
