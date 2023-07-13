import '@nomiclabs/hardhat-ethers';
import {task} from 'hardhat/config';

task('mintERC20', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log('Account:', accounts[1].address);

  const erc20 = await hre.ethers.getContract('ERC20Sample');
  console.log('ERC20 address:', erc20.address);

  const result = await erc20.connect(accounts[1]).mint(accounts[1].address, 100, {nonce: 29});
  const receipt = await result.wait();

  console.log('Transaction hash', receipt.transactionHash);
});
