// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "../IModularCompliance.sol";
import "../../../token/IToken.sol";
import "../../../registry/interface/IIdentityRegistry.sol";
import "./AbstractModule.sol";

/**
 * @title CountryAllowModule
 * @dev Modular compliance module — whitelists countries.
 *      Only investors whose country is on the allowed list can receive tokens.
 *      Country codes use numeric ISO 3166-1 standard.
 *
 *      State is keyed by compliance address so one module instance
 *      can serve multiple ModularCompliance contracts.
 */
contract CountryAllowModule is AbstractModule {

    // ── Events ────────────────────────────────────────────────────────────────
    event CountryAllowed(address indexed _compliance, uint16 indexed _country);
    event CountryUnallowed(address indexed _compliance, uint16 indexed _country);

    // ── State ─────────────────────────────────────────────────────────────────
    /// compliance → country → allowed
    mapping(address => mapping(uint16 => bool)) private _allowedCountries;

    // ── Configuration (via ModularCompliance.callModuleFunction) ─────────────

    function addAllowedCountry(uint16 _country) external onlyComplianceCall {
        require(!_allowedCountries[msg.sender][_country], "country already allowed");
        _allowedCountries[msg.sender][_country] = true;
        emit CountryAllowed(msg.sender, _country);
    }

    function removeAllowedCountry(uint16 _country) external onlyComplianceCall {
        require(_allowedCountries[msg.sender][_country], "country not allowed");
        _allowedCountries[msg.sender][_country] = false;
        emit CountryUnallowed(msg.sender, _country);
    }

    function batchAllowCountries(uint16[] calldata _countries) external onlyComplianceCall {
        for (uint256 i = 0; i < _countries.length; i++) {
            uint16 c = _countries[i];
            if (!_allowedCountries[msg.sender][c]) {
                _allowedCountries[msg.sender][c] = true;
                emit CountryAllowed(msg.sender, c);
            }
        }
    }

    function batchDisallowCountries(uint16[] calldata _countries) external onlyComplianceCall {
        for (uint256 i = 0; i < _countries.length; i++) {
            uint16 c = _countries[i];
            if (_allowedCountries[msg.sender][c]) {
                _allowedCountries[msg.sender][c] = false;
                emit CountryUnallowed(msg.sender, c);
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
        return _allowedCountries[_compliance][receiverCountry];
    }

    function canComplianceBind(address) external pure override returns (bool) { return true; }
    function isPlugAndPlay() external pure override returns (bool) { return true; }
    function name() external pure override returns (string memory) { return "CountryAllowModule"; }

    // ── Views ─────────────────────────────────────────────────────────────────

    function isCountryAllowed(address _compliance, uint16 _country) external view returns (bool) {
        return _allowedCountries[_compliance][_country];
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _getCountry(address _compliance, address _userAddress) internal view returns (uint16) {
        address tokenBound = IModularCompliance(_compliance).getTokenBound();
        IIdentityRegistry identityRegistry = IToken(tokenBound).identityRegistry();
        return identityRegistry.investorCountry(_userAddress);
    }
}