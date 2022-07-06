import { ethers } from 'hardhat';
import { Config } from '../deploy-v2/000_Config';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON);
  const signer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY || '', provider);
  const AbiCoder = ethers.utils.defaultAbiCoder;

  const timelockAddress = '0xc64f6d596806F7D3893fB3c65729EdFF3597B2C9';
  const Timelock = await ethers.getContractAt('Timelock', timelockAddress, signer);

  // Specific call
  const RegistryAddress = Config.registry;
  const signature = 'addNewContract(bytes32,address,bytes32,bool)';

  const contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('PositionManagerFactory'));
  const contractAddress = '0x31196Fbda9111a345e133EE1C247C94EDb6A7a7A';
  const moduleData = ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32);
  const moduleState = true;

  // General call parameters
  const target = RegistryAddress;
  const msgValue = 0;
  const data = AbiCoder.encode(
    ['bytes32', 'address', 'bytes32', 'bool'],
    [contractIdKeccak, contractAddress, moduleData, moduleState]
  );
  const eta = Math.floor(Date.now() / 1000) + 21750;

  console.log(`ETA: ${new Date(eta * 1000)}`);
  console.log('ETA TIMESTAMP: KEEP THIS TO EXECUTE CALL: ', eta);

  const tx = await (
    await Timelock.queueTransaction(target, msgValue, signature, data, eta, {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    })
  ).wait();

  console.log(`Transaction queued: ${tx?.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
