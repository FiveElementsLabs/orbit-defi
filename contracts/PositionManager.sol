// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';
import '@openzeppelin/contracts/proxy/Initializable.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import './helpers/ERC20Helper.sol';
import './utils/Storage.sol';

/**
 * @title   Position Manager
 * @notice  A vault that provides liquidity on Uniswap V3.
 * @notice  User can Deposit here its Uni-v3 position
 * @notice  If user does so, he is sure that idle liquidity will always be employed in protocols
 * @notice  User will pay fee to external keepers
 * @notice  vault works for multiple positions
 */

contract PositionManager is IPositionManager, ERC721Holder, Initializable {
    uint256[] private uniswapNFTs;
    mapping(uint256 => mapping(address => ModuleInfo)) public activatedModules;

    ///@notice emitted when a position is withdrawn
    ///@param to address of the user
    ///@param tokenId ID of the withdrawn NFT
    event PositionWithdrawn(address to, uint256 tokenId);

    ///@notice emitted when a ERC20 is withdrawn
    ///@param tokenAddress address of the ERC20
    ///@param to address of the user
    ///@param amount of the ERC20
    event ERC20Withdrawn(address tokenAddress, address to, uint256 amount);

    ///@notice emitted when a module is activated/deactivated
    ///@param module address of module
    ///@param tokenId position on which change is made
    ///@param isActive true if module is activated, false if deactivated
    event ModuleStateChanged(address module, uint256 tokenId, bool isActive);

    ///@notice modifier to check if the msg.sender is the owner
    modifier onlyOwner() {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        require(msg.sender == Storage.owner, 'PM0');
        _;
    }

    ///@notice modifier to check if the msg.sender is whitelisted
    modifier onlyWhitelisted() {
        require(_calledFromActiveModule(msg.sender) || msg.sender == address(this), 'PMW');
        _;
    }

    ///@notice modifier to check if the msg.sender is the PositionManagerFactory
    modifier onlyFactory() {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        require(Storage.registry.positionManagerFactoryAddress() == msg.sender, 'PMI');
        _;
    }

    ///@notice modifier to check if the position is owned by the positionManager
    modifier onlyOwnedPosition(uint256 tokenId) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        require(
            INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).ownerOf(
                tokenId
            ) == address(this),
            'PMT'
        );
        _;
    }

    constructor(
        address _owner,
        address _diamondCutFacet,
        address _registry
    ) payable {
        PositionManagerStorage.setContractOwner(_owner);

        // Add the diamondCut external function from the diamondCutFacet
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = IDiamondCut.diamondCut.selector;
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: _diamondCutFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });
        PositionManagerStorage.diamondCut(cut, address(0), '');
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        Storage.registry = IRegistry(_registry);
    }

    function init(
        address _owner,
        address _uniswapAddressHolder,
        address _aaveAddressHolder
    ) public onlyFactory initializer {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        Storage.owner = _owner;
        Storage.uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
        Storage.aaveAddressHolder = IAaveAddressHolder(_aaveAddressHolder);
    }

    ///@notice middleware to manage the position deposit or withdraw
    ///@param newTokenId ID of the position
    ///@param oldTokenId ID of the position to remove
    function middlewareUniswap(uint256 newTokenId, uint256 oldTokenId) external override onlyWhitelisted {
        if (oldTokenId != 0) _removePositionId(oldTokenId);

        if (newTokenId != 0) {
            _pushPositionId(newTokenId);
            _setDefaultDataOfPosition(newTokenId, oldTokenId);
        }
    }

    ///@notice remove awareness of tokenId UniswapV3 NFT
    ///@param tokenId ID of the NFT to remove
    function _removePositionId(uint256 tokenId) internal {
        uint256 uniswapNFTsLength = uniswapNFTs.length;
        for (uint256 i; i < uniswapNFTsLength; ++i) {
            if (uniswapNFTs[i] == tokenId) {
                if (i + 1 != uniswapNFTsLength) {
                    uniswapNFTs[i] = uniswapNFTs[uniswapNFTsLength - 1];
                }
                uniswapNFTs.pop();
                return;
            }
        }
    }

    ///@notice add tokenId in the uniswapNFTs array
    ///@param tokenId ID of the added NFT
    function _pushPositionId(uint256 tokenId) internal onlyOwnedPosition(tokenId) {
        uniswapNFTs.push(tokenId);
    }

    ///@notice return the IDs of the uniswap positions
    ///@return array of IDs
    function getAllUniPositions() external view override returns (uint256[] memory) {
        uint256[] memory uniswapNFTsMemory = uniswapNFTs;
        return uniswapNFTsMemory;
    }

    ///@notice set default data for every module
    ///@param newTokenId ID of the new position
    ///@param oldTokenId ID of the old position
    function _setDefaultDataOfPosition(uint256 newTokenId, uint256 oldTokenId) internal onlyOwnedPosition(newTokenId) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        bytes32[] memory moduleKeys = Storage.registry.getModuleKeys();

        uint256 moduleKeysLength = moduleKeys.length;
        for (uint256 i; i < moduleKeysLength; ++i) {
            (address moduleAddress, , bytes32 defaultData, bool activatedByDefault) = Storage.registry.getModuleInfo(
                moduleKeys[i]
            );
            if (oldTokenId != 0) {
                (bool isActive, bytes32 oldData) = getModuleInfo(oldTokenId, moduleAddress);
                activatedModules[newTokenId][moduleAddress].isActive = isActive;
                activatedModules[newTokenId][moduleAddress].data = oldData;
            } else {
                activatedModules[newTokenId][moduleAddress].isActive = activatedByDefault;
                activatedModules[newTokenId][moduleAddress].data = defaultData;
            }
        }
    }

    ///@notice toggle module state, activated (true) or not (false)
    ///@param tokenId ID of the NFT
    ///@param moduleAddress address of the module
    ///@param activated state of the module
    function toggleModule(
        uint256 tokenId,
        address moduleAddress,
        bool activated
    ) external override onlyOwner onlyOwnedPosition(tokenId) {
        activatedModules[tokenId][moduleAddress].isActive = activated;
        emit ModuleStateChanged(moduleAddress, tokenId, activated);
    }

    ///@notice sets the data of a module strategy for tokenId position
    ///@param tokenId ID of the position
    ///@param moduleAddress address of the module
    ///@param data data for the module
    function setModuleData(
        uint256 tokenId,
        address moduleAddress,
        bytes32 data
    ) external override onlyOwner onlyOwnedPosition(tokenId) {
        uint256 moduleData = uint256(data);
        require(moduleData != 0, 'PMM');
        activatedModules[tokenId][moduleAddress].data = data;
    }

    ///@notice get info for a module strategy for tokenId position
    ///@param _tokenId ID of the position
    ///@param _moduleAddress address of the module
    ///@return isActive is module activated
    ///@return data of the module
    function getModuleInfo(uint256 _tokenId, address _moduleAddress)
        public
        view
        override
        returns (bool isActive, bytes32 data)
    {
        return (activatedModules[_tokenId][_moduleAddress].isActive, activatedModules[_tokenId][_moduleAddress].data);
    }

    ///@notice get info for a aaveModule for tokenId position
    ///@param tokenId ID of the position
    ///@return uin256 shares of the position on aave
    ///@return address tokenToAave address
    function getAaveDataFromTokenId(uint256 tokenId) external view override returns (uint256, address) {
        return (
            uint256(PositionManagerStorage.getDynamicStorageValue(keccak256(abi.encodePacked(tokenId, 'aave_shares')))),
            address(
                uint160(
                    uint256(
                        PositionManagerStorage.getDynamicStorageValue(
                            keccak256(abi.encodePacked(tokenId, 'aave_tokenToAave'))
                        )
                    )
                )
            )
        );
    }

    ///@notice return the address of this position manager owner
    ///@return address of the owner
    function getOwner() external view override returns (address) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        return Storage.owner;
    }

    ///@notice transfer ERC20 tokens stuck in Position Manager to owner
    ///@param tokenAddress address of the token to be withdrawn
    function withdrawERC20(address tokenAddress) external override onlyOwner {
        uint256 amount = ERC20Helper._getBalance(tokenAddress, address(this));
        uint256 got = ERC20Helper._withdrawTokens(tokenAddress, msg.sender, amount);

        require(amount == got, 'PME');
        emit ERC20Withdrawn(tokenAddress, msg.sender, got);
    }

    ///@notice function to check if an address corresponds to an active module (or this contract)
    ///@param _address input address
    ///@return boolean true if the address is an active module
    function _calledFromActiveModule(address _address) internal view returns (bool) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        bytes32[] memory keys = Storage.registry.getModuleKeys();

        uint256 keysLength = keys.length;
        for (uint256 i; i < keysLength; ++i) {
            (address moduleAddress, bool isActive, , ) = Storage.registry.getModuleInfo(keys[i]);
            if (isActive && moduleAddress == _address) {
                return true;
            }
        }
        return false;
    }

    fallback() external payable onlyWhitelisted {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        address facet = Storage.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facet != address(0), 'PM');

        ///@dev Execute external function from facet using delegatecall and return any value.
        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // get any return value
            returndatacopy(0, 0, returndatasize())
            // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {
        revert();
        //we need to decide what to do when the contract receives ether
        //for now we just revert
    }
}
