import '@nomiclabs/hardhat-ethers';
import {utils} from 'ethers';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('createDistribution', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[1].address);

  const amount = utils.parseUnits('1000000', 18);

  const erc20Token = await hre.ethers.getContract('EgoToken');
  const transferTx = await erc20Token.connect(accounts[6]).transfer(accounts[1].address, amount);
  await transferTx.wait();

  const distributor = await hre.ethers.getContract('DistributorERC20');
  console.log('DistributorERC20V2 address:', distributor.address);

  const approveTx = await erc20Token.connect(accounts[1]).approve(distributor.address, amount);
  await approveTx.wait();
  console.log('approve');

  const tx = await distributor.connect(accounts[1]).createDistribution(amount);
  console.log(await tx.wait());
});
