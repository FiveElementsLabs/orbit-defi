import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';

async function qualcosa() {
  const testFactory = await ethers.getContractFactory('Test');
  const test = await testFactory.deploy();
  await test.deployed();

  await test.test('0x393b7cB1742A94a08B91451AE97041CF74793fE4', '0x646dB8ffC21e7ddc2B6327448dd9Fa560Df41087');
}

qualcosa();
