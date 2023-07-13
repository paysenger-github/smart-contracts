import '@nomiclabs/hardhat-ethers';
import {utils} from 'ethers';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('hasRole', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[1].address);

  const erc20Token = await hre.ethers.getContract('EgoToken');

  const adminRole = hre.ethers.utils.solidityKeccak256(['string'], ['ADMIN_ROLE']);
  const validatorRole = hre.ethers.utils.solidityKeccak256(['string'], ['VALIDATOR_ROLE']);
  const bridgeMasterRole = hre.ethers.utils.solidityKeccak256(['string'], ['BRIDGE_MASTER_ROLE']);
  const gasPrice = await hre.ethers.provider.getGasPrice();

  const hasRoleAdmin = await erc20Token.hasRole(adminRole, accounts[1].address);
  const hasRoleValidator = await erc20Token.hasRole(adminRole, accounts[1].address);
  const hasRoleBridge = await erc20Token.hasRole(adminRole, accounts[1].address);
  const hasRoleDefaultAdmin = await erc20Token.hasRole(bridgeMasterRole, accounts[1].address);
  console.log('hasRoleAdmin', hasRoleAdmin);
  console.log('hasRoleValidator', hasRoleValidator);
  console.log('hasRoleBridge', hasRoleBridge);
  console.log('hasRoleDefaultAdmin', hasRoleDefaultAdmin);
});
