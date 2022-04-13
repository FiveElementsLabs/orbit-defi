// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import './Registry.sol';
import '../interfaces/IPositionManager.sol';
import './actions/BaseAction.sol';
import '../interfaces/IUniswapAddressHolder.sol';
import './utils/Storage.sol';
import '../interfaces/IDiamondCut.sol';
import '../interfaces/IZapper.sol';

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

    ///@notice emitted when a position is created
    ///@param from address of the user
    ///@param tokenId ID of the minted NFT
    event DepositUni(address indexed from, uint256 tokenId);

    ///@notice emitted when a position is withdrawn
    ///@param to address of the user
    ///@param tokenId ID of the withdrawn NFT
    event WithdrawUni(address to, uint256 tokenId);

    ///@notice emitted to return the output of doAction transaction
    ///@param success delegate call was a success
    ///@param data data returned by the delegate call
    event Output(bool success, bytes data);

    uint256[] private uniswapNFTs;

    function init(address _owner, address _uniswapAddressHolder) public {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        Storage.owner = _owner;
        Storage.uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    //TODO: refactor of user parameters
    struct Module {
        address moduleAddress;
        bool activated;
    }

    ///@notice add uniswap position NFT to the position manager
    ///@param from address of the user
    ///@param tokenIds IDs of deposited tokens
    function depositUniNft(address from, uint256[] calldata tokenIds) external override onlyOwner {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        for (uint32 i = 0; i < tokenIds.length; i++) {
            INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress())
                .safeTransferFrom(from, address(this), tokenIds[i], '0x0');
            uniswapNFTs.push(tokenIds[i]);
            emit DepositUni(from, tokenIds[i]);
        }
    }

    ///@notice withdraw uniswap position NFT from the position manager
    ///@param to address of the user
    ///@param tokenId ID of withdrawn token
    function withdrawUniNft(address to, uint256 tokenId) public override onlyOwner {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        uint256 index = uniswapNFTs.length;
        for (uint256 i = 0; i < uniswapNFTs.length; i++) {
            if (uniswapNFTs[i] == tokenId) {
                index = i;
                i = uniswapNFTs.length;
            }
        }
        require(index < uniswapNFTs.length, 'token ID not found!');
        INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).safeTransferFrom(
            address(this),
            to,
            tokenId,
            '0x0'
        );
        emit WithdrawUni(to, tokenId);
    }

    ///@notice remove awareness of NFT at index
    ///@param index index of the NFT in the uniswapNFTs array
    function removePositionId(uint256 index) external override {
        require(msg.sender == address(this), 'only position manager can remove position');
        if (uniswapNFTs.length > 1) {
            uniswapNFTs[index] = uniswapNFTs[uniswapNFTs.length - 1];
            uniswapNFTs.pop();
        } else {
            delete uniswapNFTs;
        }
    }

    ///@notice add tokenId in the uniswapNFTs array
    ///@param tokenId ID of the added NFT
    function pushPositionId(uint256 tokenId) public {
        uniswapNFTs.push(tokenId);
    }

    ///@notice return the IDs of the uniswap positions
    ///@return array of IDs
    function getAllUniPosition() external view override returns (uint256[] memory) {
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

    function getModuleState(uint256 tokenId, address moduleAddress) external view override returns (bool) {
        return activatedModules[tokenId][moduleAddress];
    }

    function getOwner() external view override returns (address) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        return Storage.owner;
    }

    ///@notice modifier to check if the msg.sender is the owner
    modifier onlyOwner() {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        require(msg.sender == Storage.owner, 'Only owner');
        _;
    }

    ///@notice modifier to check if the msg.sender is the owner or a module
    modifier onlyOwnerOrModule() {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        require((msg.sender == Storage.owner), 'Only owner or module');
        _;
    }

    fallback() external payable {
        StorageStruct storage Storage;
        bytes32 position = PositionManagerStorage.key;
        ///@dev get diamond storage position
        assembly {
            Storage.slot := position
        }
        address facet = Storage.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facet != address(0), 'Diamond: Function does not exist');
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
}
