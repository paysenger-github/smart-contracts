import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';

task('burnERC20', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log('Account:', accounts[6].address);

  const erc20 = await hre.ethers.getContract('EgoToken');
  console.log('ERC20 address:', erc20.address);

  const result = await erc20.connect(accounts[6]).burn(parseEther('100000'));
  const receipt = await result.wait();

  console.log('Transaction hash', receipt.transactionHash);
});
