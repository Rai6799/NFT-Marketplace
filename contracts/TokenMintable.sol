//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Token.sol";

contract TokenMintable is Token, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        address minter,
        address owner,
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address forwarder,
        IPolicy policy
    ) Token(owner, name, symbol, initialSupply, forwarder, policy) {
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
        _setupRole(MINTER_ROLE, minter);
    }

    function mint(address to, uint256 amount) external {
        mint(to, amount, "", "", false);
    }

    function mint(
        address to,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData
    ) public onlyRole(MINTER_ROLE) {
        _mint(to, amount, userData, operatorData, true);
    }

    function mint(
        address to,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData,
        bool requireReceptionAck
    ) public onlyRole(MINTER_ROLE) {
        _mint(to, amount, userData, operatorData, requireReceptionAck);
    }

    function _msgSender()
        internal
        view
        virtual
        override(Context, Token)
        returns (address sender)
    {
        return Token._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(Context, Token)
        returns (bytes calldata)
    {
        return Token._msgData();
    }
}
//althabe.eth
