// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "../IModularCompliance.sol";
import "../../../token/IToken.sol";
import "../../../registry/interface/IIdentityRegistry.sol";
import "./AbstractModule.sol";

/**
 * @title CountryRestrictModule
 * @dev Modular compliance module — blacklists countries.
 *      Transfers to investors in a restricted country are blocked.
 *      Country codes use numeric ISO 3166-1 standard.
 *
 *      State is keyed by compliance address so one module instance
 *      can serve multiple ModularCompliance contracts.
 */
contract CountryRestrictModule is AbstractModule {

    // ── Events ────────────────────────────────────────────────────────────────
    event CountryRestrictionAdded(address indexed _compliance, uint16 indexed _country);
    event CountryRestrictionRemoved(address indexed _compliance, uint16 indexed _country);

    // ── State ─────────────────────────────────────────────────────────────────
    /// compliance → country → restricted
    mapping(address => mapping(uint16 => bool)) private _restrictedCountries;

    // ── Configuration (via ModularCompliance.callModuleFunction) ─────────────

    function addCountryRestriction(uint16 _country) external onlyComplianceCall {
        require(!_restrictedCountries[msg.sender][_country], "country already restricted");
        _restrictedCountries[msg.sender][_country] = true;
        emit CountryRestrictionAdded(msg.sender, _country);
    }

    function removeCountryRestriction(uint16 _country) external onlyComplianceCall {
        require(_restrictedCountries[msg.sender][_country], "country not restricted");
        _restrictedCountries[msg.sender][_country] = false;
        emit CountryRestrictionRemoved(msg.sender, _country);
    }

    function batchRestrictCountries(uint16[] calldata _countries) external onlyComplianceCall {
        for (uint256 i = 0; i < _countries.length; i++) {
            uint16 c = _countries[i];
            if (!_restrictedCountries[msg.sender][c]) {
                _restrictedCountries[msg.sender][c] = true;
                emit CountryRestrictionAdded(msg.sender, c);
            }
        }
    }

    function batchUnrestrictCountries(uint16[] calldata _countries) external onlyComplianceCall {
        for (uint256 i = 0; i < _countries.length; i++) {
            uint16 c = _countries[i];
            if (_restrictedCountries[msg.sender][c]) {
                _restrictedCountries[msg.sender][c] = false;
                emit CountryRestrictionRemoved(msg.sender, c);
            }
        }
    }

    // ── IModule ───────────────────────────────────────────────────────────────

    // solhint-disable-next-line no-empty-blocks
    function moduleTransferAction(address, address, uint256) external override onlyComplianceCall {}
    // solhint-disable-next-line no-empty-blocks
    function moduleMintAction(address, uint256) external override onlyComplianceCall {}
    // solhint-disable-next-line no-empty-blocks
    function moduleBurnAction(address, uint256) external override onlyComplianceCall {}

    function moduleCheck(
        address /*_from*/,
        address _to,
        uint256 /*_value*/,
        address _compliance
    ) external view override returns (bool) {
        uint16 receiverCountry = _getCountry(_compliance, _to);
        return !_restrictedCountries[_compliance][receiverCountry];
    }

    function canComplianceBind(address) external pure override returns (bool) { return true; }
    function isPlugAndPlay() external pure override returns (bool) { return true; }
    function name() external pure override returns (string memory) { return "CountryRestrictModule"; }

    // ── Views ─────────────────────────────────────────────────────────────────

    function isCountryRestricted(address _compliance, uint16 _country) external view returns (bool) {
        return _restrictedCountries[_compliance][_country];
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _getCountry(address _compliance, address _userAddress) internal view returns (uint16) {
        address tokenBound = IModularCompliance(_compliance).getTokenBound();
        IIdentityRegistry identityRegistry = IToken(tokenBound).identityRegistry();
        return identityRegistry.investorCountry(_userAddress);
    }
}