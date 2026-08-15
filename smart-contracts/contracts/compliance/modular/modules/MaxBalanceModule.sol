// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "../IModularCompliance.sol";
import "../../../token/IToken.sol";
import "./AbstractModule.sol";

/**
 * @title MaxBalanceModule
 * @dev Modular compliance module — caps the maximum token balance any single
 *      investor wallet may hold.  A limit of 0 means "no limit".
 *
 *      State is keyed by compliance address so one module instance
 *      can serve multiple ModularCompliance contracts.
 */
contract MaxBalanceModule is AbstractModule {

    // ── Events ────────────────────────────────────────────────────────────────
    event MaxBalanceSet(address indexed _compliance, uint256 _maxBalance);

    // ── State ─────────────────────────────────────────────────────────────────
    /// compliance → max balance (0 = unlimited)
    mapping(address => uint256) private _maxBalance;

    // ── Configuration (via ModularCompliance.callModuleFunction) ─────────────

    /**
     * @notice Sets the maximum token balance allowed per investor wallet.
     * @param _max  Maximum balance in token's smallest unit.  0 removes the cap.
     */
    function setMaxBalance(uint256 _max) external onlyComplianceCall {
        _maxBalance[msg.sender] = _max;
        emit MaxBalanceSet(msg.sender, _max);
    }

    // ── IModule ───────────────────────────────────────────────────────────────

    // solhint-disable-next-line no-empty-blocks
    function moduleTransferAction(address, address, uint256) external override onlyComplianceCall {}
    // solhint-disable-next-line no-empty-blocks
    function moduleMintAction(address, uint256) external override onlyComplianceCall {}
    // solhint-disable-next-line no-empty-blocks
    function moduleBurnAction(address, uint256) external override onlyComplianceCall {}

    /**
     * @inheritdoc IModule
     * @dev Returns false when the transfer would push the receiver's balance above
     *      the configured maximum (if any).
     */
    function moduleCheck(
        address /*_from*/,
        address _to,
        uint256 _value,
        address _compliance
    ) external view override returns (bool) {
        uint256 maxBal = _maxBalance[_compliance];
        if (maxBal == 0) return true; // no cap configured

        address tokenBound = IModularCompliance(_compliance).getTokenBound();
        uint256 currentBalance = IToken(tokenBound).balanceOf(_to);
        return (currentBalance + _value) <= maxBal;
    }

    function canComplianceBind(address) external pure override returns (bool) { return true; }
    function isPlugAndPlay() external pure override returns (bool) { return true; }
    function name() external pure override returns (string memory) { return "MaxBalanceModule"; }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getMaxBalance(address _compliance) external view returns (uint256) {
        return _maxBalance[_compliance];
    }
}