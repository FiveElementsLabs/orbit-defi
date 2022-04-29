// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../interfaces/IPositionManager.sol';
import '../interfaces/DataTypes.sol';
import '../interfaces/IUniswapAddressHolder.sol';
import '../interfaces/IAaveAddressHolder.sol';
import '../interfaces/IDiamondCut.sol';
import '../interfaces/IRegistry.sol';
import '../interfaces/ILendingPool.sol';
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
    struct ModuleInfo {
        bool isActive;
        bytes data;
    }

    struct AaveReserve {
        AavePosition[] positions;
        uint256 sharesEmitted;
    }

    struct AavePosition {
        uint256 id;
        uint256 shares;
    }

    uint256[] private uniswapNFTs;
    uint256 private aaveIdCounter = 0;
    mapping(address => AaveReserve) public aaveUserReserves;
    mapping(uint256 => mapping(address => ModuleInfo)) public activatedModules;

    ///@notice emitted when a position is withdrawn
    ///@param to address of the user
    ///@param tokenId ID of the withdrawn NFT
    event WithdrawUni(address to, uint256 tokenId);

    ///@notice emitted when a ERC20 is withdrawn
    ///@param tokenAddress address of the ERC20
    ///@param to address of the user
    ///@param amount of the ERC20
    event WithdrawERC20(address tokenAddress, address to, uint256 amount);

    ///@notice modifier to check if the msg.sender is the owner
    modifier onlyOwner() {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        require(msg.sender == Storage.owner, 'PositionManager::onlyOwner: Only owner can call this function');
        _;
    }

    ///@notice modifier to check if the msg.sender is the PositionManagerFactory
    modifier onlyFactory(address _registry) {
        require(
            IRegistry(_registry).positionManagerFactoryAddress() == msg.sender,
            'PositionManager::init: Only PositionManagerFactory can init this contract'
        );
        _;
    }

    ///@notice modifier to check if the position is owned by the positionManager
    modifier onlyOwnedPosition(uint256 tokenId) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        require(
            INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).ownerOf(
                tokenId
            ) == address(this),
            'PositionManager::onlyOwnedPosition: positionManager is not owner of the token'
        );
        _;
    }

    constructor(
        address _owner,
        address _diamondCutFacet,
        address _registry
    ) payable onlyFactory(_registry) {
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

    function init(
        address _owner,
        address _uniswapAddressHolder,
        address _registry,
        address _aaveAddressHolder
    ) public onlyFactory(_registry) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        Storage.owner = _owner;
        Storage.uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
        Storage.registry = IRegistry(_registry);
        Storage.aaveAddressHolder = IAaveAddressHolder(_aaveAddressHolder);
    }

    ///@notice remove awareness of tokenId UniswapV3 NFT
    ///@param tokenId ID of the NFT to remove
    function removePositionId(uint256 tokenId) public override {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        ///@dev if ownerOf reverts, tokenId is non existent or it has been burned
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
                if (uniswapNFTs.length > 1) {
                    uniswapNFTs[i] = uniswapNFTs[uniswapNFTs.length - 1];
                    uniswapNFTs.pop();
                } else {
                    delete uniswapNFTs;
                }
                return;
            }
        }
    }

    ///@notice add tokenId in the uniswapNFTs array
    ///@param tokenId ID of the added NFT
    function pushPositionId(uint256 tokenId) public override onlyOwnedPosition(tokenId) {
        uniswapNFTs.push(tokenId);
    }

    ///@notice return the IDs of the uniswap positions
    ///@return array of IDs
    function getAllUniPositions() external view override returns (uint256[] memory) {
        uint256[] memory uniswapNFTsMemory = uniswapNFTs;
        return uniswapNFTsMemory;
    }

    ///@notice add awareness of aave position to positionManager
    ///@param token address of token deposited
    ///@param amount of aTokens recieved from deposit
    function pushAavePosition(address token, uint256 amount) public override {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        uint256 shares;
        ///@notice when positionManager deposits into aave, we give the position one share
        ///        for each aToken recieved * shares_emitted / total_amount_of_aTokens owned
        if (aaveUserReserves[token].sharesEmitted == 0) {
            shares = amount;
        } else {
            DataTypes.ReserveData memory reserveData = ILendingPool(Storage.aaveAddressHolder.lendingPoolAddress())
                .getReserveData(token);
            console.log('aTokenAmount', IERC20(reserveData.aTokenAddress).balanceOf(address(this)));
            console.log('sharesEmitted', aaveUserReserves[token].sharesEmitted);
            shares =
                (amount * aaveUserReserves[token].sharesEmitted) /
                IERC20(reserveData.aTokenAddress).balanceOf(address(this));
        }

        aaveUserReserves[token].positions.push(AavePosition({id: aaveIdCounter, shares: shares}));
        aaveUserReserves[token].sharesEmitted += shares;
        aaveIdCounter++;
    }

    ///@notice remove awareness of aave position from positionManager
    ///@param token address of token withdrawn
    ///@param id of the withdrawn position
    function removeAavePosition(address token, uint256 id) public {
        require(
            aaveUserReserves[token].sharesEmitted > 0,
            'PositionManager::removeAavePosition: no position to remove!'
        );
        for (uint256 i = 0; i < aaveUserReserves[token].positions.length; i++) {
            if (aaveUserReserves[token].positions[i].id == id) {
                if (aaveUserReserves[token].positions.length > 1) {
                    aaveUserReserves[token].sharesEmitted -= aaveUserReserves[token].positions[i].shares;
                    aaveUserReserves[token].positions[i] = aaveUserReserves[token].positions[
                        aaveUserReserves[token].positions.length - 1
                    ];
                    aaveUserReserves[token].positions.pop();
                } else {
                    delete aaveUserReserves[token].positions;
                }
                i = aaveUserReserves[token].positions.length;
            }
        }
    }

    ///@notice return all aave positions in a certain token
    ///@param token address of token
    function getAavePositions(address token) public view returns (AavePosition[] memory) {
        return aaveUserReserves[token].positions;
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
    }

    ///@notice return the state of the module for tokenId position
    ///@param tokenId ID of the position
    ///@param moduleAddress address of the module
    function getModuleState(uint256 tokenId, address moduleAddress)
        external
        view
        override
        onlyOwnedPosition(tokenId)
        returns (bool)
    {
        return activatedModules[tokenId][moduleAddress].isActive;
    }

    ///@notice sets the data of a module strategy for tokenId position
    ///@param tokenId ID of the position
    ///@param moduleAddress address of the module
    ///@param data data for the module
    function setModuleData(
        uint256 tokenId,
        address moduleAddress,
        bytes memory data
    ) external override onlyOwner onlyOwnedPosition(tokenId) {
        activatedModules[tokenId][moduleAddress].data = data;
    }

    ///@notice returns the data of a module strategy for tokenId position
    ///@param tokenId ID of the position
    ///@param moduleAddress address of the module
    function getModuleData(uint256 tokenId, address moduleAddress)
        external
        view
        override
        onlyOwnedPosition(tokenId)
        returns (bytes memory)
    {
        return activatedModules[tokenId][moduleAddress].data;
    }

    ///@notice return the address of this position manager owner
    ///@return address of the owner
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

    ///@notice function to check if an address corresponds to an active module (or this contract)
    ///@param _address input address
    ///@return isCalledFromActiveModule boolean
    function _calledFromActiveModule(address _address) internal view returns (bool isCalledFromActiveModule) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        bytes32[] memory keys = Storage.registry.getModuleKeys();
        for (uint256 i = 0; i < keys.length; i++) {
            if (Storage.registry.moduleAddress(keys[i]) == _address && Storage.registry.isActive(keys[i]) == true) {
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
