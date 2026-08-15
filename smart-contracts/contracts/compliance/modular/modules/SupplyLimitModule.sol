// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "../IModularCompliance.sol";
import "../../../token/IToken.sol";
import "./AbstractModule.sol";

/**
 * @title SupplyLimitModule
 * @dev Modular compliance module — caps the total token supply.
 *      Mint operations (_from == address(0)) that would exceed the cap are blocked.
 *      A limit of 0 means "no limit".
 *
 *      State is keyed by compliance address so one module instance
 *      can serve multiple ModularCompliance contracts.
 */
contract SupplyLimitModule is AbstractModule {

    // ── Events ────────────────────────────────────────────────────────────────
    event SupplyLimitSet(address indexed _compliance, uint256 _limit);

    // ── State ─────────────────────────────────────────────────────────────────
    /// compliance → supply limit (0 = unlimited)
    mapping(address => uint256) private _supplyLimit;

    // ── Configuration (via ModularCompliance.callModuleFunction) ─────────────

    /**
     * @notice Sets the maximum total supply allowed for the bound token.
     * @param _limit  Max supply in token's smallest unit.  0 removes the cap.
     */
    function setSupplyLimit(uint256 _limit) external onlyComplianceCall {
        _supplyLimit[msg.sender] = _limit;
        emit SupplyLimitSet(msg.sender, _limit);
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
     * @dev When _from == address(0) this is a mint check — blocks if
     *      currentTotalSupply + _value would exceed the configured limit.
     *      Normal transfers are always allowed by this module.
     */
    function moduleCheck(
        address _from,
        address /*_to*/,
        uint256 _value,
        address _compliance
    ) external view override returns (bool) {
        if (_from != address(0)) return true; // not a mint — no supply check needed

        uint256 limit = _supplyLimit[_compliance];
        if (limit == 0) return true; // no cap configured

        address tokenBound = IModularCompliance(_compliance).getTokenBound();
        uint256 currentSupply = IToken(tokenBound).totalSupply();
        return (currentSupply + _value) <= limit;
    }

    function canComplianceBind(address) external pure override returns (bool) { return true; }
    function isPlugAndPlay() external pure override returns (bool) { return true; }
    function name() external pure override returns (string memory) { return "SupplyLimitModule"; }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getSupplyLimit(address _compliance) external view returns (uint256) {
        return _supplyLimit[_compliance];
    }
}