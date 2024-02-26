// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./INFTPolicy.sol";

contract Policy is Ownable, Pausable, IPolicy, INFTPolicy {
    constructor(address admin) Ownable() {
        transferOwnership(admin);
    }

    /* Policy */
    mapping(address => bool) private _blacklistedAccounts;

    event Blacklist(address indexed account, bool indexed blacklisted);

    function setBlacklistForAccount(address account, bool blacklisted)
        external
        onlyOwner
    {
        _blacklistedAccounts[account] = blacklisted;
        emit Blacklist(account, blacklisted);
    }

    function isTransferable(
        address,
        address,
        address from,
        address to,
        uint256
    ) external view override whenNotPaused returns (bool) {
        return !_blacklistedAccounts[from] && !_blacklistedAccounts[to];
    }

    function isNFTTransferable(
        address,
        address,
        address from,
        address to,
        uint256
    ) external view override whenNotPaused returns (bool) {
        return !_blacklistedAccounts[from] && !_blacklistedAccounts[to];
    }

    /* CoreContracts */
    mapping(address => bool) private _coreContracts;

    event CoreContract(address indexed account, bool indexed enable);

    function setCoreContract(address account, bool enable) external onlyOwner {
        _coreContracts[account] = enable;
        emit CoreContract(account, enable);
    }

    function isOperatorFor(
        address,
        address operator,
        address
    ) external view override whenNotPaused returns (bool) {
        return _coreContracts[operator];
    }
}
//althabe.eth
