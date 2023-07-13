import '@nomiclabs/hardhat-ethers';
import {utils} from 'ethers';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('revokeRole', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  const targetAddress = '0x74F1cA9cebC362af4EBC691660Ba34B44e33e38b';

  console.log('Account:', accounts[1].address);
  const erc20Token = await hre.ethers.getContract('EgoToken');

  const adminRole = hre.ethers.utils.solidityKeccak256(['string'], ['ADMIN_ROLE']);
  const validatorRole = hre.ethers.utils.solidityKeccak256(['string'], ['VALIDATOR_ROLE']);
  const bridgeMasterRole = hre.ethers.utils.solidityKeccak256(['string'], ['BRIDGE_MASTER_ROLE']);
  const defaultAdmin = '0x0000000000000000000000000000000000000000000000000000000000000000';

  let tx1 = await erc20Token
    .connect(accounts[1])
    .revokeRole(adminRole, '0x1D2489BA705265A033367Ba7912808241Cfb7193', {});
  await tx1.wait();
  console.log('tx1 receipt', tx1);

  tx1 = await erc20Token
    .connect(accounts[1])
    .revokeRole(validatorRole, '0x1D2489BA705265A033367Ba7912808241Cfb7193', {});
  await tx1.wait();
  console.log('tx1 receipt', tx1);

  tx1 = await erc20Token
    .connect(accounts[1])
    .revokeRole(bridgeMasterRole, '0x1D2489BA705265A033367Ba7912808241Cfb7193', {});
  await tx1.wait();
  console.log('tx1 receipt', tx1);

  tx1 = await erc20Token
    .connect(accounts[1])
    .revokeRole(defaultAdmin, '0x1D2489BA705265A033367Ba7912808241Cfb7193', {});
  await tx1.wait();
  console.log('tx1 receipt', tx1);
});
