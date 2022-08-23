// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import './PositionManager.sol';
import '../interfaces/IPositionManagerFactory.sol';

contract PositionManagerFactory is IPositionManagerFactory {
    address public registry;
    address public governance;
    address public immutable diamondCutFacet;
    address public immutable aaveAddressHolder;
    address public immutable uniswapAddressHolder;
    address[] public positionManagers;
    IDiamondCut.FacetCut[] public actions;
    mapping(address => address) public override userToPositionManager;

    ///@notice emitted when a new position manager is created
    ///@param positionManager address of PositionManager
    ///@param user address of user
    event PositionManagerCreated(address indexed positionManager, address user);

    modifier onlyGovernance() {
        require(msg.sender == governance, 'PFG');
        _;
    }

    constructor(
        address _governance,
        address _registry,
        address _diamondCutFacet,
        address _uniswapAddressHolder,
        address _aaveAddressHolder
    ) {
        governance = _governance;
        registry = _registry;
        diamondCutFacet = _diamondCutFacet;
        uniswapAddressHolder = _uniswapAddressHolder;
        aaveAddressHolder = _aaveAddressHolder;
    }

    ///@notice changes the address of the governance
    ///@param _governance address of the new governance
    function changeGovernance(address _governance) external onlyGovernance {
        require(_governance != address(0), 'PFC');
        governance = _governance;
    }

    ///@notice changes the address of the registry
    ///@param _registry address of the new registry
    function changeRegistry(address _registry) external onlyGovernance {
        require(_registry != address(0), 'PFR');
        registry = _registry;
    }

    ///@notice update actions already existing on positionManager
    ///@dev Add (0) Replace(1) Remove(2)
    ///@param positionManager address of the position manager on which one should modified an action
    ///@param actionsToUpdate contains the facet addresses and function selectors of the actions
    function updateDiamond(address positionManager, IDiamondCut.FacetCut[] memory actionsToUpdate)
        external
        onlyGovernance
    {
        IDiamondCut(positionManager).diamondCut(actionsToUpdate, address(0), '');
    }

    ///@notice adds or removes an action to/from the factory
    ///@param facetAction facet of the action to add or remove from position manager factory
    function updateActionData(IDiamondCut.FacetCut calldata facetAction) external onlyGovernance {
        if (facetAction.action == IDiamondCut.FacetCutAction.Remove) {
            uint256 actionsLength = actions.length;
            for (uint256 i; i < actionsLength; ++i) {
                if (actions[i].facetAddress == facetAction.facetAddress) {
                    actions[i] = actions[actionsLength - 1];
                    actions.pop();
                    return;
                }
            }
            require(false, 'PFU');
        }

        if (facetAction.action == IDiamondCut.FacetCutAction.Replace) {
            uint256 actionsLength = actions.length;
            for (uint256 i; i < actionsLength; ++i) {
                if (actions[i].facetAddress == facetAction.facetAddress) {
                    actions[i] = facetAction;
                    return;
                }
            }
            require(false, 'PFU');
        }

        if (facetAction.action == IDiamondCut.FacetCutAction.Add) {
            uint256 actionsLength = actions.length;
            uint256 newSelectorsLength = facetAction.functionSelectors.length;
            for (uint256 i; i < actionsLength; ++i) {
                uint256 oldSelectorsLength = actions[i].functionSelectors.length;
                if (newSelectorsLength == oldSelectorsLength) {
                    bool different;
                    for (uint256 j; j < newSelectorsLength; ++j) {
                        if (actions[i].functionSelectors[j] != facetAction.functionSelectors[j]) {
                            different = true;
                            break;
                        }
                    }
                    require(different, 'PFE');
                }
            }
            actions.push(facetAction);
            return;
        }

        require(false, 'PFI');
    }

    ///@notice deploy new positionManager and assign to userAddress
    ///@return address[] return array of PositionManager address updated with the last deployed PositionManager
    function create() external override returns (address[] memory) {
        require(userToPositionManager[msg.sender] == address(0), 'PFP');
        PositionManager manager = new PositionManager(msg.sender, diamondCutFacet, registry);
        positionManagers.push(address(manager));
        userToPositionManager[msg.sender] = address(manager);
        manager.init(msg.sender, uniswapAddressHolder, aaveAddressHolder);
        IDiamondCut(address(manager)).diamondCut(actions, address(0), '');

        emit PositionManagerCreated(address(manager), msg.sender);

        return positionManagers;
    }

    ///@notice get the array of position manager addresses
    ///@return address[] return array of PositionManager addresses
    function getAllPositionManagers() public view override returns (address[] memory) {
        return positionManagers;
    }
}
