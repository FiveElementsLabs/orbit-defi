import { ethers } from 'hardhat';
import { Config } from '../deploy/000_Config';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON);
  const signer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY || '', provider);

  const PM = await ethers.getContractAt('PositionManager', '0x0960Cf66bEd733c3272077188fA7EDD0A3494187', signer);
  const contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('PositionManagerFactory'));

  // Change these as needed to perform specific calls
  const ContractToQuery = PM;
  const functionName = 'getModuleInfo';
  const args: any = [178120, '0xAC4031ba573a30CC9530C1dC5F19a89a390A6955'];

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
