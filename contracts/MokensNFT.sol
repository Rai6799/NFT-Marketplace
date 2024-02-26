//SPDX-License-Identifier: MIT
//Author: althabe.eth, gioojeda.eth
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "./INFTPolicy.sol";
import "./IMokensNFT.sol";

contract MokensNFT is
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721BurnableUpgradeable,
    ERC721PausableUpgradeable,
    AccessControlEnumerableUpgradeable,
    ERC2771ContextUpgradeable,
    OwnableUpgradeable,
    IMokensNFT
{
    using Counters for Counters.Counter;

    event ForwarderUpdated(address indexed forwarder);
    event PolicyUpdated(INFTPolicy indexed policy);
    event Mint(address to, uint256 indexed tokenId, bytes32 indexed tokenHash);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    address internal _forwarder;
    INFTPolicy internal _policy;
    string private _baseTokenURI;

    Counters.Counter private _tokenIdTracker;

    mapping(uint256 => bytes32) private _tokensHash;
    mapping(bytes32 => uint256) private _tokensId;
    mapping(uint256 => address) internal _users_user;
    mapping(uint256 => uint64) internal _users_expires;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address forwarder_) ERC2771ContextUpgradeable(forwarder_) {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        string memory baseTokenURI,
        address owner,
        address minter,
        INFTPolicy policy_,
        address forwarder_
    ) public initializer {
        __ERC721_init(name, symbol);
        __Ownable_init();
        __AccessControlEnumerable_init();
        __ERC721Enumerable_init();
        __ERC721Burnable_init();
        __ERC721Pausable_init();
        _transferOwnership(owner);
        _baseTokenURI = baseTokenURI;
        _policy = policy_;
        _forwarder = forwarder_;
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
        _setupRole(MINTER_ROLE, minter);
    }

    function isApprovedForAll(address owner, address operator)
        public
        view
        virtual
        override(ERC721Upgradeable, IERC721Upgradeable)
        returns (bool)
    {
        return
            _policy.isOperatorFor(address(this), operator, owner) ||
            super.isApprovedForAll(owner, operator);
    }

    function forwarder() external view returns (address) {
        return _forwarder;
    }

    function policy() external view returns (IPolicy) {
        return _policy;
    }

    function tokenHashById(uint256 tokenId) external view returns (bytes32) {
        require(_exists(tokenId), "Unknow token");
        return _tokensHash[tokenId];
    }

    function tokenIdByHash(bytes32 tokenHash) external view returns (uint256) {
        require(_exists(_tokensId[tokenHash]), "Unknow token");
        return _tokensId[tokenHash];
    }

    function mint(address to, bytes32 tokenHash)
        external
        virtual
        onlyRole(MINTER_ROLE)
    {
        __mint(to, tokenHash);
    }

    function mintBatch(address to, bytes32[] memory tokensHash)
        external
        virtual
        onlyRole(MINTER_ROLE)
    {
        for (uint256 i = 0; i < tokensHash.length; i++) {
            __mint(to, tokensHash[i]);
        }
    }

    function setUser(
        uint256 tokenId,
        address user,
        uint64 expires
    ) public virtual {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );
        require(uint256(expires) >= block.timestamp, "Expired");
        require(userOf(tokenId) == address(0), "Rented");
        _users_user[tokenId] = user;
        _users_expires[tokenId] = expires;
        emit UpdateUser(tokenId, user, expires);
    }

    function userOf(uint256 tokenId) public view virtual returns (address) {
        address user = _users_user[tokenId];
        if (uint256(_users_expires[tokenId]) >= block.timestamp) {
            return user;
        }
        return address(0);
    }

    function userExpires(uint256 tokenId)
        public
        view
        virtual
        returns (uint256)
    {
        return _users_expires[tokenId];
    }

    function updateBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    function updateForwarder(address forwarder_) external onlyOwner {
        _forwarder = forwarder_;
        emit ForwarderUpdated(_forwarder);
    }

    function updatePolicy(INFTPolicy policy_) external onlyOwner {
        _policy = policy_;
        emit PolicyUpdated(_policy);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(
            AccessControlEnumerableUpgradeable,
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            IERC165Upgradeable
        )
        returns (bool)
    {
        return
            interfaceId == type(IERC4907).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function isTrustedForwarder(address forwarder_)
        public
        view
        override
        returns (bool)
    {
        return forwarder_ == _forwarder;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    )
        internal
        virtual
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            ERC721PausableUpgradeable
        )
    {
        super._beforeTokenTransfer(from, to, tokenId);
        require(
            _policy.isNFTTransferable(
                address(this),
                _msgSender(),
                from,
                to,
                tokenId
            ),
            "Can't transfer"
        );
        require(userOf(tokenId) == address(0), "Rented");
    }

    function __mint(address to, bytes32 tokenHash) internal {
        require(!_exists(_tokensId[tokenHash]), "Token hash already exists");
        _tokenIdTracker.increment();
        uint256 tokenId = _tokenIdTracker.current();
        _tokensHash[tokenId] = tokenHash;
        _tokensId[tokenHash] = tokenId;
        _mint(to, tokenId);
        emit Mint(to, tokenId, tokenHash);
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
}
