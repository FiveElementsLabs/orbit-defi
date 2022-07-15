import { ethers } from 'hardhat';
import { Config } from '../deploy/000_Config';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON);
  const signer = new ethers.Wallet(process.env.TEST_PRIVATE_KEY || '', provider);

  const Registry = await ethers.getContractAt('Registry', '0xa896b6Be8ac9287d3bF6d71d336514DD0db4b037', signer);
  const contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('AutoCompoundModule'));
  const moduleData = ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32);

  // Change these as needed to perform specific calls
  const ContractToQuery = Registry;
  const functionName = 'getModuleInfo';
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
