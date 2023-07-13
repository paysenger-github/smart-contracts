import '@nomiclabs/hardhat-ethers';
import {utils} from 'ethers';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('grantRole', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[1].address);

  const erc20Token = await hre.ethers.getContract('EgoToken');
  const adminRole = hre.ethers.utils.solidityKeccak256(['string'], ['ADMIN_ROLE']);
  const validatorRole = hre.ethers.utils.solidityKeccak256(['string'], ['VALIDATOR_ROLE']);
  const bridgeMasterRole = hre.ethers.utils.solidityKeccak256(['string'], ['BRIDGE_MASTER_ROLE']);
  const gasPrice = await hre.ethers.provider.getGasPrice();
  const defaultAdmin = '0x0000000000000000000000000000000000000000000000000000000000000000';

  const tx1 = await erc20Token
    .connect(accounts[1])
    .grantRole(defaultAdmin, '0xB70c831790344589CC4ffa83dEE7dA3A046f6A26', {});
  await tx1.wait();
  console.log('tx1 receipt', tx1);

  const tx2 = await erc20Token
    .connect(accounts[1])
    .grantRole(defaultAdmin, '0x1BEe191bB939EEC95742e904E86273e59928E363', {});
  await tx2.wait();
  console.log('tx1 receipt', tx2);
});
