import { Contract, ContractReceipt } from 'ethers';
import { ethers } from 'hardhat';
import { ContractFactory } from 'ethers';
import { MockToken, IUniswapV3Pool, IUniswapV3Factory } from '../../typechain';

const UniswapV3Pool = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');

interface TokensFixture {
  tokenFixture: MockToken;
}

interface PoolFixture {
  pool: IUniswapV3Pool;
}

export async function tokensFixture(name: string, decimal: number): Promise<TokensFixture> {
  const tokenFactory = await ethers.getContractFactory('MockToken');
  const tokenFixture: MockToken = (await tokenFactory.deploy(name, name, decimal)) as MockToken;
  return { tokenFixture };
}

export async function poolFixture(
  token0: MockToken,
  token1: MockToken,
  fee: number,
  factory: IUniswapV3Factory
): Promise<PoolFixture> {
  const signers = await ethers.getSigners();

  const tx = await factory.createPool(token0.address, token1.address, fee);
  const receipt = (await tx.wait()) as any;

  const pool = new ethers.Contract(receipt.events[0].args.pool, UniswapV3Pool['abi'], signers[0]) as IUniswapV3Pool;

  let startTick = 0;
  const price = Math.pow(1.0001, startTick);
  await pool.initialize('0x' + (Math.sqrt(price) * Math.pow(2, 96)).toString(16));
  await pool.increaseObservationCardinalityNext(100);

  return { pool };
}

export async function mintSTDAmount(token: MockToken, amount?: string) {
  const signers = await ethers.getSigners();
  await token.mint(signers[0].address, ethers.utils.parseEther(amount || '1000000000000'));
  await token.mint(signers[1].address, ethers.utils.parseEther(amount || '1000000000000'));
  await token.mint(signers[2].address, ethers.utils.parseEther(amount || '1000000000000'));
}

export async function mintLpStandardPosition() {}
