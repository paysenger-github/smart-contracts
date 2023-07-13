import '@nomiclabs/hardhat-ethers';
import {task} from 'hardhat/config';

task('updateTokenList', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log('Account:', accounts[0].address);

  const egoToken = await hre.ethers.getContract('EgoToken');
  const erc20Sample = await hre.ethers.getContract('ERC20Sample');
  const marketplace = await hre.ethers.getContract('ERC721Market');
  console.log('MArketPlace address:', marketplace.address);

  const tx1 = await marketplace.connect(accounts[0]).updateTokenList(egoToken.address, 2);
  const tx2 = await marketplace.connect(accounts[0]).updateTokenList(erc20Sample.address, 1);

  console.log('Receipt1', await tx1.wait());
  console.log('Receipt2', await tx2.wait());
});
