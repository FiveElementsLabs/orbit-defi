// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

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
    IDiamondCut.FacetCut[] public actions;
    mapping(address => address) public override userToPositionManager;

    ///@notice emitted when a new position manager is created
    ///@param positionManager address of PositionManager
    ///@param user address of user
    event PositionManagerCreated(address indexed positionManager, address user);

    modifier onlyGovernance() {
        require(msg.sender == governance, 'PositionManagerFactory::onlyGovernance: Only governance can add actions');
        _;
    }

    constructor(address _governance) {
        governance = _governance;
    }

    ///@notice changes the address of the governance
    ///@param _governance address of the new governance
    function changeGovernance(address _governance) external onlyGovernance {
        governance = _governance;
    }

    ///@notice adds a new action to the factory
    ///@param actionAddress address of the action
    ///@param selectors action selectors
    function pushActionData(address actionAddress, bytes4[] calldata selectors) external onlyGovernance {
        actions.push(
            IDiamondCut.FacetCut({
                facetAddress: actionAddress,
                action: IDiamondCut.FacetCutAction.Add,
                functionSelectors: selectors
            })
        );
    }

    ///@notice deploy new positionManager and assign to userAddress
    ///@return address[] return array of PositionManager address updated with the last deployed PositionManager
    function create() public override returns (address[] memory) {
        require(
            userToPositionManager[msg.sender] == 0x0000000000000000000000000000000000000000,
            'PositionManagerFactory::create: User already has a PositionManager'
        );
        PositionManager manager = new PositionManager(msg.sender, diamondCutFacet, registry);
        positionManagers.push(address(manager));
        userToPositionManager[msg.sender] = address(manager);
        manager.init(msg.sender, uniswapAddressHolder, registry, aaveAddressHolder);
        bytes memory _calldata;
        IDiamondCut(address(manager)).diamondCut(actions, 0x0000000000000000000000000000000000000000, _calldata);

        emit PositionManagerCreated(address(manager), msg.sender);

        return positionManagers;
    }

    ///@notice get all positionManager array of address
    ///@dev array need to return with a custom function to get all the array
    ///@return address[] return the array of positionManager
    function getAllPositionManagers() public view override returns (address[] memory) {
        return positionManagers;
    }
}
