//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./IPolicy.sol";

contract Token is ERC777, ERC2771Context, Ownable, Pausable {
    address internal _forwarder;
    IPolicy internal _policy;

    event ForwarderUpdated(address indexed forwarder);
    event PolicyUpdated(IPolicy indexed policy);

    constructor(
        address owner,
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address forwarder_,
        IPolicy policy_
    )
        ERC777(name, symbol, new address[](0))
        ERC2771Context(forwarder_)
        Ownable()
        Pausable()
    {
        _transferOwnership(owner);
        _forwarder = forwarder_;
        _policy = policy_;
        _mint(owner, initialSupply, "", "", false);
    }

    function updateForwarder(address forwarder_) external onlyOwner {
        _forwarder = forwarder_;
        emit ForwarderUpdated(_forwarder);
    }

    function forwarder() public view returns (address) {
        return _forwarder;
    }

    function updatePolicy(IPolicy policy_) external onlyOwner {
        _policy = policy_;
        emit PolicyUpdated(_policy);
    }

    function policy() public view returns (IPolicy) {
        return _policy;
    }

    function isTrustedForwarder(address forwarder_)
        public
        view
        override
        returns (bool)
    {
        return forwarder_ == _forwarder;
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256 amount
    ) internal view override {
        require(
            _policy.isTransferable(address(this), operator, from, to, amount),
            "No transferable"
        );
    }

    function isOperatorFor(address operator, address tokenHolder)
        public
        view
        virtual
        override
        returns (bool)
    {
        return
            _policy.isOperatorFor(address(this), operator, tokenHolder) ||
            ERC777.isOperatorFor(operator, tokenHolder);
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
