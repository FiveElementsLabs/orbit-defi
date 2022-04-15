// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../interfaces/IPositionManager.sol';
import '../interfaces/IUniswapAddressHolder.sol';
import '../interfaces/IDiamondCut.sol';
import '../interfaces/IRegistry.sol';
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

contract PositionManager is IPositionManager, ERC721Holder {
    constructor(address _owner, address _diamondCutFacet) payable {
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
    }

    mapping(uint256 => mapping(address => bool)) public activatedModules;

    ///@notice emitted when a position is withdrawn
    ///@param to address of the user
    ///@param tokenId ID of the withdrawn NFT
    event WithdrawUni(address to, uint256 tokenId);

    ///@notice emitted when a ERC20 is withdrawn
    ///@param tokenAddress address of the ERC20
    ///@param to address of the user
    ///@param amount of the ERC20
    event WithdrawERC20(address tokenAddress, address to, uint256 amount);

    uint256[] private uniswapNFTs;

    function init(
        address _owner,
        address _uniswapAddressHolder,
        address _registry
    ) public {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        Storage.owner = _owner;
        Storage.uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
        Storage.registry = IRegistry(_registry);
    }

    //TODO: refactor of user parameters
    struct Module {
        address moduleAddress;
        bool activated;
    }

    ///@notice withdraw uniswap position NFT from the position manager
    ///@param tokenId ID of withdrawn token
    function withdrawUniNft(uint256 tokenId) public override onlyOwner {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        uint256 index = uniswapNFTs.length;
        for (uint256 i = 0; i < uniswapNFTs.length; i++) {
            if (uniswapNFTs[i] == tokenId) {
                index = i;
                i = uniswapNFTs.length;
            }
        }
        require(index < uniswapNFTs.length, 'PositionManager::withdrawUniNFT: token ID not found!');
        INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId,
            '0x0'
        );
        emit WithdrawUni(msg.sender, tokenId);
    }

    ///@notice remove awareness of UniswapV3 NFT at index
    ///@param index index of the NFT in the uniswapNFTs array
    function removePositionIdAtIndex(uint256 index) internal {
        if (uniswapNFTs.length > 1) {
            uniswapNFTs[index] = uniswapNFTs[uniswapNFTs.length - 1];
            uniswapNFTs.pop();
        } else {
            delete uniswapNFTs;
        }
    }

    ///@notice remove awareness of tokenId UniswapV3 NFT
    ///@param tokenId ID of the NFT to remove
    function removePositionId(uint256 tokenId) public override {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        try
            INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).ownerOf(
                tokenId
            )
        returns (address owner) {
            require(
                owner != address(this),
                'PositionManager::removePositionId: positionManager is still owner of the token!'
            );
        } catch {
            //do nothing
        }
        for (uint256 i = 0; i < uniswapNFTs.length; i++) {
            if (uniswapNFTs[i] == tokenId) {
                removePositionIdAtIndex(i);
                return;
            }
        }
    }

    ///@notice add tokenId in the uniswapNFTs array
    ///@param tokenId ID of the added NFT
    function pushPositionId(uint256 tokenId) public override {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        require(
            INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).ownerOf(
                tokenId
            ) == address(this),
            'PositionManager::pushPositionId: tokenId is not owned by this contract'
        );
        uniswapNFTs.push(tokenId);
    }

    ///@notice return the IDs of the uniswap positions
    ///@return array of IDs
    function getAllUniPositions() external view override returns (uint256[] memory) {
        uint256[] memory uniswapNFTsMemory = uniswapNFTs;
        return uniswapNFTsMemory;
    }

    ///@notice toggle module state, activated (true) or not (false)
    ///@param tokenId ID of the NFT
    ///@param moduleAddress address of the module
    ///@param activated state of the module
    function toggleModule(
        uint256 tokenId,
        address moduleAddress,
        bool activated
    ) external override onlyOwner {
        activatedModules[tokenId][moduleAddress] = activated;
    }

    ///@notice return the state of the module for tokenId position
    ///@param tokenId ID of the position
    ///@param moduleAddress address of the module
    function getModuleState(uint256 tokenId, address moduleAddress) external view override returns (bool) {
        return activatedModules[tokenId][moduleAddress];
    }

    function getOwner() external view override returns (address) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        return Storage.owner;
    }

    ///@notice return the all tokens of tokenAddress in the positionManager
    ///@param tokenAddress address of the token to be withdrawn
    function withdrawERC20(address tokenAddress) external override onlyOwner {
        ERC20Helper._approveToken(tokenAddress, address(this), 2**256 - 1);
        uint256 amount = ERC20Helper._withdrawTokens(tokenAddress, msg.sender, 2**256 - 1);
        emit WithdrawERC20(tokenAddress, msg.sender, amount);
    }

    ///@notice modifier to check if the msg.sender is the owner
    modifier onlyOwner() {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        require(msg.sender == Storage.owner, 'PositionManager::onlyOwner: Only owner can call this function');
        _;
    }

    function _calledFromActiveModule(address moduleAddress) internal view returns (bool isCalledFromActiveModule) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        bytes32[] memory keys = Storage.registry.getModuleKeys();
        for (uint256 i = 0; i < keys.length; i++) {
            if (
                Storage.registry.moduleAddress(keys[i]) == moduleAddress && Storage.registry.isActive(keys[i]) == true
            ) {
                isCalledFromActiveModule = true;
                i = keys.length;
            }
        }
    }

    fallback() external payable {
        require(
            _calledFromActiveModule(msg.sender) || msg.sender == address(this),
            'PositionManager::fallback: Only active modules can call this function'
        );
        StorageStruct storage Storage;
        bytes32 position = PositionManagerStorage.key;
        ///@dev get diamond storage position
        assembly {
            Storage.slot := position
        }
        address facet = Storage.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facet != address(0), 'PositionManager::Fallback: Function does not exist');
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
        //we need to decide what to do when the contract receives ether
        //for now we just keep it to be reused in the future
    }
}
