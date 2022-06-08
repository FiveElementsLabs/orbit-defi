import { ethers } from 'hardhat';
import { Config } from '../deploy/000_Config';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON);
  const signer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY || '', provider);

  const Registry = await ethers.getContractAt('Registry', '0x38B2c4da0F5d1a3512e4CBfb24DbA1652674b7ea', signer);
  const contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('PositionManagerFactory'));

  // Change these as needed to perform specific calls
  const ContractToQuery = Registry;
  const functionName = 'modules';
  const args = [contractIdKeccak];

  const tx = await ContractToQuery[functionName](...args, {
    gasPrice: Config.gasPrice,
    gasLimit: Config.gasLimit,
  });

  console.log(tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
