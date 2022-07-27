#### AD - AaveDeposit.sol

**ADN** - AaveDeposit::depositToAave: Aave token not found.
**ADS** - AaveDeposit::\_pushTokenIdToAave: positionShares does not exist

#### AW - AaveWithdraw.sol

**AWN** - AaveWithdraw::withdrawFromAave: no position to withdraw!

#### IL - IncreaseLiquidity.sol

**ILA** - IncreaseLiquidity::increaseLiquidity: Amounts cannot be both zero

#### MM - Mint.sol

**MM0** - Mint::mint: Failed transfer of leftover token0
**MM1** - Mint::mint: Failed transfer of leftover token1

#### ZZ - ZapIn.sol

**ZZT** - ZapIn::zapIn: token0 and token1 cannot be the same
**ZZ0** - ZapIn::zapIn: tokenIn cannot be 0

#### ZF - ZapOut.sol

**ZFP** - ZapOut::\_findBestFee: No pool found with desired tokens

#### SH - SwapHelper.sol

**SHR** - SwapHelper::getRatioFromRange: Position should be in range to call this function
**SHA** - SwapHelper::calcAmountToSwap: at least one amountIn should be != 0
**SHD** - SwapHelper::checkDeviation: Price deviation is too high

#### AM - AaveModule.sol

**AME** - AaveModule::moveToAave: module data cannot be empty
**AMA** - AaveModule::moveToAave: move to aave is not needed
**AMT** - AaveModule::moveToUniswap: token cannot be address 0
**AMU** - AaveModule::moveToUniswap: not needed.
**AMP** - AaveModule::\_moveToAave: position is in range.
**AMF** - AaveModule::\_moveToAave: Aave token not found.
**AMD** - AaveModule::\_findBestFee: No pool found with desired tokens

#### AC - AutoCompoundModule.sol

**ACA** - AutoCompoundModule::Constructor:addressHolder cannot be 0
**ACR** - AutoCompoundModule::Constructor:registry cannot be 0
**ACM** - AutoCompoundModule::\_checkIfCompoundIsNeeded: module data cannot be empty
**ACN** - AutoCompoundModule::autoCompoundFees: not needed.

#### IL - IdleLiquidityModule.sol

**ILU** - IdleLiquidityModule::Constructor:uniswapAddressHolder cannot be 0
**ILR** - IdleLiquidityModule::Constructor:registry cannot be 0
**ILD** - IdleLiquidityModule:: rebalance: Rebalance distance is 0
**ILN** - IdleLiquidityModule::rebalance: not needed.

#### WR - WithdrawRecipes.sol

**WRP** - WithdrawRecipes::withdrawUniNft: part to withdraw must be between 0 and 10000
**WRA** - WithdrawRecipes::withdrawFromAave: part to withdraw must be between 1 and 10000

#### AH - AaveAddressHolder.sol

**AHG** - AaveAddressHolder::onlyGovernance: Only governance can call this function

#### UH - UniswapAddressHolder.sol

**UHG** - UniswapAddressHolder::onlyGovernance: Only governance can call this function

#### S - PositionManagerStorage.sol

**SNO** - PositionManagerStorage::setContractOwner: new owner cannot be the null address
**SMF** - PositionManagerStorage::enforceIsGovernance: Must be positionManagerFactory to call this function
**SIF** - PositionManagerStorage::diamondCut: Incorrect FacetCutAction
**SNS** - PositionManagerStorage::addFunctions: No selectors in facet to cut
**SA0** - PositionManagerStorage::addFunctions: Add facet can't be address(0)
**SFE** - PositionManagerStorage::addFunctions: Can't add function that already exists
**SRE** - PositionManagerStorage::removeFunction: Can't remove function that doesn't exist
**SRI** - PositionManagerStorage::removeFunction: Can't remove immutable function
**SRF** - PositionManagerStorage::replaceFunctions: No selectors in facet to cut
**SR0** - PositionManagerStorage::replaceFunctions: Add facet can't be address(0)
**SRR** - PositionManagerStorage::replaceFunctions: Can't replace function with same function
**SES** - PositionManagerStorage::removeFunctions: No selectors in facet to cut
**SE0** - PositionManagerStorage::removeFunctions: Remove facet address must be address(0)
**SI0** - PositionManagerStorage::initializeDiamondCut: \_init is address(0) but_calldata is not empty
**SIC** - PositionManagerStorage::initializeDiamondCut: \_calldata is empty but \_init is not address(0)
**SIR** - PositionManagerStorage::initializeDiamondCut: \_init function reverted

#### PF - PositionManagerFactory.sol

**PFG** - PositionManagerFactory::onlyGovernance: Only governance can add actions
**PFC** - PositionManagerFactory::changeGovernance: New governance cannot be the null address
**PFR** - PositionManagerFactory::changeRegistry: New registry cannot be the null address
**PFU** - PositionManagerFactory::updateActionData: Action not found
**PFE** - PositionManagerFactory::updateActionData: Action already exists
**PFI** - PositionManagerFactory::updateActionData: Invalid action
**PFP** - PositionManagerFactory::create: User already has a PositionManager

#### R - Registry.sol

**RCG** - Registry::constructor: governance cannot be address(0).
**RCT** - Registry::constructor: twapDuration cannot be 0.
**ROG** - Registry::onlyGovernance: Call must come from governance.
**RF0** - Registry::setPositionManagerFactory: New position manager factory cannot be the null address
**RG0** - Registry::changeGovernance: New governance cannot be the null address
**RAE** - Registry::addNewContract: Entry already exists.
**RCE** - Registry::changeContract: Entry does not exist.
**RSE** - Registry::switchModuleState: Entry does not exist.
**RKW** - Registry::addKeeperToWhitelist: Keeper is already whitelisted.
**RKN** - Registry::removeKeeperFromWhitelist: Keeper is not whitelisted.
**RDE** - Registry::setDefaultValue: Entry does not exist.
**RD0** - Registry::setDefaultValue: Default data cannot be empty.
**RS0** - Registry::setDefaultActivation: Entry does not exist.
**RT0** - Registry::setTwapDuration: Twap duration cannot be 0.

#### PM - PositionManager.sol

**PM0** - PositionManager::onlyOwner: Only owner can call this function
**PMW** - PositionManager::onlyWhitelisted: Only whitelisted addresses can call this function
**PMI** - PositionManager::init: Only PositionManagerFactory can init this contract
**PMT** - PositionManager::onlyOwnedPosition: positionManager is not owner of the token
**PMM** - PositionManager::setModuleData: moduleData must be greater than 0%
**PMA** - PositionManager::getTokenIdFromAavePosition: positionShares does not exist
**PME** - PositionManager::withdrawERC20: ERC20 transfer failed.
**PM** - PositionManager::Fallback: Function does not exist

#### EH - ERC20Helper.sol

**EHB** - ERC20Helper::\_pullTokensIfNeeded: Not enough balance to pull tokens
**EHT** - ERC20Helper::\_pullTokensIfNeeded: Not enough token after pulling.

#### MH - MathHelper.sol

**MH1** - MathHelper::fromUint24ToInt24: value doesn't fit in 24 bits
**MH2** - MathHelper::fromInt24ToUint24: value doesn't fit in 24 bits
**MH3** - MathHelper::fromUint256ToUint24: value doesn't fit in 24 bits
**MH4** - MathHelper::fromUint256ToInt24: value doesn't fit in 24 bits
**MH5** - MathHelper::fromInt56ToInt24: value doesn't fit in 24 bits

#### SM - SafeInt24Math.sol && SafeInt56Math.sol

**SM0** - SafeInt24Math::mul: multiplication overflow
**SM1** - SafeInt24Math::mul: multiplication overflow
**SM2** - SafeInt24Math::div: division by zero
**SM3** - SafeInt24Math::div: division overflow
**SM4** - SafeInt24Math::sub: subtraction overflow
**SM5** - SafeInt24Math::add: addition overflow
**SM6** - SafeInt56Math::div: division by zero
**SM7** - SafeInt56Math::div: division overflow
**SM8** - SafeInt56Math::sub: subtraction overflow

#### BaseModule.sol

**WHL** - Module::onlyWhitelistedKeeper: Only whitelisted keepers can call this function
**MNA** - Module::activeModule: Module is inactive.
