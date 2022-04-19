import '@nomiclabs/hardhat-ethers';
import { ContractFactory, Contract } from 'ethers';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const NFPMjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const PMjson = require('../artifacts/contracts/PositionManager.sol/PositionManager.json');
const ERC20 = require('../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json');

const deploy = async function (contractName: string, constructorArgs: Array<any>) {
  const user = (await ethers.getSigners())[0];

  const contractFactory = await ethers.getContractFactory(contractName);
  const contractInstance = await contractFactory.deploy(...constructorArgs);
  await contractInstance.deployed();

  console.log('address of ' + contractName + ': ', contractInstance.address);
};

const deployPositionManager = async function () {
  const user = (await ethers.getSigners())[0];

  //deploy the PositionManagerFactory => deploy PositionManager
  const PositionManagerFactory = await ethers.getContractAt(
    'PositionManagerFactory',
    '0xB717C31a9cF41485771e9c5D7CFCeF9Ca089532a'
  );

  await PositionManagerFactory.create(
    user.address,
    '0x1b025669feE0BB63d91Eb31949A595D2e4B678c4',
    '0x8082BF0cdCCd19De8Eea995Dbf077cf0A8b1dEeA',
    {
      gasLimit: 5000000,
    }
  );

  const contractsDeployed = await PositionManagerFactory.positionManagers(0);
  console.log(contractsDeployed);
};

// get function selectors from ABI
export async function getSelectors(contract: any) {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = signatures.reduce((acc: any, val: any) => {
    if (val !== 'init(bytes)') {
      acc.push(contract.interface.getSighash(val));
    }
    return acc;
  }, []);
  selectors.contract = contract;

  return selectors;
}

const addCutFunction = async function (actionName: string, actionAddress: string, PositionManagerAddress: string) {
  const cut = [];
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  const action = await ethers.getContractAt(actionName, actionAddress);

  cut.push({
    facetAddress: actionAddress,
    action: FacetCutAction.Add,
    functionSelectors: await getSelectors(action),
  });

  const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManagerAddress);

  const tx = await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);
  console.log(tx.hash);
};

const createPosition = async function () {
  const user = (await ethers.getSigners())[0];

  const tokenMatic = await ethers.getContractAtFromArtifact(ERC20, '0x9c3c9283d3e44854697cd22d3faa240cfb032889');
  console.log(await tokenMatic.balanceOf(user.address));

  const NonFungiblePositionManager = await ethers.getContractAtFromArtifact(
    NFPMjson,
    '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
  );
  const mintTx = await NonFungiblePositionManager.mint(
    {
      token0: '0x9c3c9283d3e44854697cd22d3faa240cfb032889',
      token1: '0xa6fa4fb5f76172d178d61b04b0ecd319c5d1c0aa',
      fee: 3000,
      tickLower: 0 - 60 * 10,
      tickUpper: 0 + 60 * 10,
      amount0Desired: 1000,
      amount1Desired: 1000,
      amount0Min: 0,
      amount1Min: 0,
      recipient: user.address,
      deadline: Date.now() + 1000,
    },
    { gasLimit: 3000000 }
  );
  console.log(mintTx);
  const receipt: any = await mintTx.wait();
};

const deposit = async function () {
  const user = (await ethers.getSigners())[0];

  const NonFungiblePositionManager = await ethers.getContractAtFromArtifact(
    NFPMjson,
    '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
  );

  const PositionManager = await ethers.getContractAtFromArtifact(PMjson, '0xd9e1eAF3AFA2c5C041339e0D39f848FF80d8Ef62 ');

  await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);

  //await PositionManager.depositUniNft(user.address, [1517], { gasLimit: 3000000 });
};

//deploy('DepositRecipes', []);
//deployPositionManager();
/* addCutFunction(
  'UpdateUncollectedFees',
  '0x7239d79585Fe89a69066f3538064c1431535e07A',
  '0x0706B0f415aF0D9324fA0E73b4E10295e1b09ed8'
); */
//createPosition();

//deposit();

// Actions
// Modules
// Timelock
// Registry (needs timelock)
// Diamond Cut Facet
// PositionManagerFactory (needs Diamond cut facet)
// add actions using diamond cut
/*
// add actions to position manager using diamond pattern
    const cut = [];
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    cut.push({
      facetAddress: collectFeesAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(collectFeesAction),
    });
    cut.push({
      facetAddress: increaseLiquidityAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(increaseLiquidityAction),
    });
    cut.push({
      facetAddress: decreaseLiquidityAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(decreaseLiquidityAction),
    });
    cut.push({
      facetAddress: updateFeesAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(updateFeesAction),
    });

    const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

    const tx = await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);
*/
