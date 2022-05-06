// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import './PositionManager.sol';
import '../interfaces/IPositionManagerFactory.sol';
import '../interfaces/IDiamondCut.sol';

contract PositionManagerFactory is IPositionManagerFactory {
    address governance;
    address diamondCutFacet;
    address uniswapAddressHolder;
    address aaveAddressHolder;
    address registry;
    address[] public positionManagers;
    FacetCut[] public actions;
    mapping(address => address) public override userToPositionManager;

    ///@notice emitted when a new position manager is created
    ///@param positionManager address of PositionManager
    ///@param user address of user
    event PositionManagerCreated(address indexed positionManager, address user);

    modifier onlyGovernance () {
        require(msg.sender == governance, "PositionManagerFactory::onlyGovernance: Only governance can add actions");
    }

    constructor (address _governance, ) {
        governance = _governance;
    }

    ///@notice changes the address of the governance
    ///@param _governance address of the new governance
    function changeGovernance (address _governance) onlyGovernance {
        governance = _governance;
    }

    ///@notice adds a new action to the factory
    ///@param actionAddress address of the action
    ///@param selectors action selectors
    function pushActionData(address actionAddress, bytes4[] selectors) public onlyGovernance {
        actions.push(FacetCut({actionAddress, FacetCutAction.add, selectors}));
    }

    ///@notice deploy new positionManager and assign to userAddress
    ///@param _userAddress the address of the user that will be the owner of PositionManager
    ///@param _diamondCutFacet the address of the DiamondCutFacet contract
    ///@param _uniswapAddressHolderAddress the address of the UniswapAddressHolder contract
    ///@param _registryAddress the address of the Registry contract
    ///@return address[] return array of PositionManager address updated with the last deployed PositionManager
    function create() public override returns (address[] memory) {
        require(userToPositionManager[msg.sender] == 0, "PositionManagerFactory::create: User already has a PositionManager");
        PositionManager manager = new PositionManager(msg.sender, diamondCutFacet, registry);
        positionManagers.push(address(manager));
        userToPositionManager[msg.sender] = address(manager);
        manager.init(msg.sender, uniswapAddressHolder, registry, aaveAddressHolder);
        IDiamondCut(manager).diamondCut(actions, '0x0000000000000000000000000000000000000000', []);
        
        emit PositionManagerCreated(address(manager), _userAddress);

        return positionManagers;
    }

    ///@notice get all positionManager array of address
    ///@dev array need to return with a custom function to get all the array
    ///@return address[] return the array of positionManager
    function getAllPositionManagers() public view override returns (address[] memory) {
        return positionManagers;
    }
}
