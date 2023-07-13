import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';

task('transferERC20', 'To transfer tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log('Account:', accounts[1].address);

  const erc20 = await hre.ethers.getContract('EgoToken');
  console.log('ERC20 address:', erc20.address);

  console.log(await erc20.balanceOf(accounts[0].address));

  const result = await erc20
    .connect(accounts[1])
    .transfer('0x23970719f7F141C06734f5276045a7551f993730', parseEther('100000'));
  const receipt = await result.wait();

  console.log('Transaction hash', receipt.transactionHash);
});
