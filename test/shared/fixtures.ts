import { Contract } from "ethers";
import { ethers } from "hardhat";
import { ContractFactory } from "ethers";
import { sign } from "crypto";
const UniswapV3Factory = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
const UniswapV3Pool = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");
const NonFungiblePositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");

interface TokensFixture {
  token0: Contract;
  token1: Contract;
}

export async function tokensFixture(): Promise<TokensFixture> {
  const tokenFactory = await ethers.getContractFactory("MockToken");
  const token0 = await tokenFactory.deploy("USDC", "USDC", 6);
  const token1 = await tokenFactory.deploy("WETH", "WETH", 18);
  return { token0, token1 };
}

export async function poolFixture(
  token0: Contract,
  token1: Contract
): Promise<any> {
  const signers = await ethers.getSigners();
  const uniswapFactoryFactory = new ContractFactory(
    UniswapV3Factory["abi"],
    UniswapV3Factory["bytecode"],
    signers[0]
  );
  const factory = await uniswapFactoryFactory.deploy();
  await factory.deployed();
  const tx = await factory.createPool(token0.address, token1.address, 3000);
  const receipt = await tx.wait();
  const pool = new ethers.Contract(
    await receipt.events[0]["args"]["pool"],
    UniswapV3Pool["abi"],
    signers[0]
  );

  const NonfungiblePositionManagerFactory = new ContractFactory(
    NonFungiblePositionManager["abi"],
    NonFungiblePositionManager["bytecode"],
    signers[0]
  );
  const NonfungiblePositionManager =
    await NonfungiblePositionManagerFactory.deploy(
      factory.address,
      token1.address,
      token1.address
    );

  return { pool, NonfungiblePositionManager };
}
