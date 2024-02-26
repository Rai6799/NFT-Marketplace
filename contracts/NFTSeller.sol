//SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./IMokensNFT.sol";
import "./IPaymentMethods.sol";

contract NFTSeller is
    AccessControlEnumerableUpgradeable,
    ERC2771ContextUpgradeable,
    OwnableUpgradeable
{
    using ECDSAUpgradeable for bytes32;

    bytes32 public constant STOCKER = keccak256("STOCKER");

    event NewTokensAvailable(uint256 indexed Lootbox, uint256 available);
    event NewLootboxAvailable(uint256 indexed Lootbox, uint256 price);
    event UpdateLootboxPrice(uint256 indexed Lootbox, uint256 price);
    event LootboxSell(
        uint256 price,
        uint256 discount,
        address indexed paymentToken,
        bytes32 tokenHash
    );

    event ForwarderUpdated(address indexed forwarder);
    event VaultUpdated(address indexed vault);

    address public forwarder;
    address public vault;
    address public authorizedMetaSigner;
    IPaymentMethods public paymentMethods;
    IMokensNFT public mokensNFT;

    struct Lootbox {
        uint256 sellIndex;
        uint256 appendIndex;
        uint256 price;
        bool exist;
        mapping(uint256 => bytes32) tokensHash;
    }

    mapping(uint256 => Lootbox) public lootboxes;
    uint256 public initiatedLootbox;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address forwarder_) ERC2771ContextUpgradeable(forwarder_) {
        _disableInitializers();
    }

    function initialize(
        address owner,
        address manager,
        IMokensNFT mokensNFT_,
        IPaymentMethods paymentMethods_,
        address authorizedMetaSigner_,
        address vault_,
        address forwarder_
    ) public initializer {
        __Ownable_init();
        __AccessControlEnumerable_init();
        _transferOwnership(owner);
        forwarder = forwarder_;
        vault = vault_;
        authorizedMetaSigner = authorizedMetaSigner_;
        paymentMethods = paymentMethods_;
        mokensNFT = mokensNFT_;
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
        _setupRole(STOCKER, manager);
        initiatedLootbox = 0;
    }

    function _addTokensHashToLootbox(
        uint256 lootboxIndex,
        bytes32[] memory tokensHash
    ) internal {
        require(lootboxes[lootboxIndex].exist, "Lootbox not exist");
        for (uint256 i = 0; i < tokensHash.length; i++) {
            lootboxes[lootboxIndex].tokensHash[
                lootboxes[lootboxIndex].appendIndex
            ] = tokensHash[i];
            lootboxes[lootboxIndex].appendIndex++;
        }
        emit NewTokensAvailable(
            lootboxIndex,
            lootboxes[lootboxIndex].appendIndex -
                lootboxes[lootboxIndex].sellIndex
        );
    }

    function _addLootbox(uint256 price, bytes32[] memory tokensHash) internal {
        lootboxes[initiatedLootbox].exist = true;
        lootboxes[initiatedLootbox].price = price;
        lootboxes[initiatedLootbox].sellIndex = 0;
        lootboxes[initiatedLootbox].appendIndex = 0;
        _addTokensHashToLootbox(initiatedLootbox, tokensHash);
        emit NewLootboxAvailable(initiatedLootbox, price);
        initiatedLootbox++;
    }

    function addLootbox(uint256 price, bytes32[] memory tokensHash)
        external
        onlyOwner
    {
        _addLootbox(price, tokensHash);
    }

    function addTokensHashToLootbox(
        uint256 lootboxIndex,
        bytes32[] memory tokensHash
    ) external onlyRole(STOCKER) {
        _addTokensHashToLootbox(lootboxIndex, tokensHash);
    }

    function updateLootboxPrice(uint256 lootboxIndex, uint256 price)
        external
        onlyOwner
    {
        require(lootboxes[lootboxIndex].exist, "Lootbox not exist");
        lootboxes[lootboxIndex].price = price;
        emit UpdateLootboxPrice(initiatedLootbox, price);
    }

    function updateForwarder(address forwarder_) external onlyOwner {
        forwarder = forwarder_;
    }

    function updateVault(address vault_) external onlyOwner {
        vault = vault_;
    }

    function updateAuthorizedMetaSigner(address authorizedMetaSigner_)
        external
        onlyOwner
    {
        authorizedMetaSigner = authorizedMetaSigner_;
    }

    function updatePaymentMethods(IPaymentMethods paymentMethods_)
        external
        onlyOwner
    {
        paymentMethods = paymentMethods_;
    }

    function claimTokens(address[] memory tokensAddresses) external onlyOwner {
        for (uint256 i = 0; i < tokensAddresses.length; i++) {
            address tokenAddress = tokensAddresses[i];
            if (tokenAddress != address(0)) {
                // ERC20
                IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
                require(
                    token.transfer(vault, token.balanceOf(address(this))),
                    "Can't transfer"
                );
            } else {
                // Native
                payable(vault).transfer(address(this).balance);
            }
        }
    }

    function _buyLootbox(
        uint256 price,
        bytes32 tokenHash,
        address paymentToken
    ) internal {
        require(
            paymentMethods.paymentMethodAvailable(paymentToken),
            "Payment method not available"
        );
        (
            uint256 paymentTokenPrice,
            uint256 paymentTokenPriceFactor,
            uint256 paymentTokenDiscount
        ) = paymentMethods.paymentMethod(paymentToken);

        IERC20Upgradeable paymentTokenContract = IERC20Upgradeable(
            paymentToken
        );

        uint256 priceInPayToken = (price * paymentTokenPrice) /
            paymentTokenPriceFactor;

        if (paymentTokenDiscount > 0) {
            uint256 discountAmount = (priceInPayToken * paymentTokenDiscount) /
                paymentTokenPriceFactor;
            priceInPayToken = priceInPayToken - discountAmount;
        }

        emit LootboxSell(price, paymentTokenDiscount, paymentToken, tokenHash);

        if (paymentToken != address(0)) {
            // ERC20
            require(
                paymentTokenContract.transferFrom(
                    _msgSender(),
                    vault,
                    priceInPayToken
                ),
                "Can't transfer"
            );
        } else {
            // Native
            require(
                msg.value >= priceInPayToken,
                "Not enough funds transferred"
            );
            payable(vault).transfer(priceInPayToken);
            payable(_msgSender()).transfer(msg.value - priceInPayToken);
        }

        mokensNFT.mint(_msgSender(), tokenHash);
    }

    function buyAvailableLootbox(uint256 lootboxIndex, address paymentToken)
        external
        payable
    {
        Lootbox storage lootbox = lootboxes[lootboxIndex];
        require(lootbox.appendIndex > lootbox.sellIndex, "No available stock");

        bytes32 tokenHash = lootbox.tokensHash[lootbox.sellIndex];
        lootbox.sellIndex++;

        _buyLootbox(lootbox.price, tokenHash, paymentToken);
    }

    function buyMetaLootbox(
        uint256 price,
        bytes32 tokenHash,
        address paymentToken,
        bytes memory signature
    ) external {
        address signedBy = keccak256(abi.encodePacked(price, tokenHash))
            .toEthSignedMessageHash()
            .recover(signature);
        require(signedBy == authorizedMetaSigner, "Invalid signer");
        _buyLootbox(price, tokenHash, paymentToken);
    }

    /**
    Cambiar gateway de pago
    **/

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
}
