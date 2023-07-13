import '@nomiclabs/hardhat-ethers';
import {task} from 'hardhat/config';

task('transferFromERC20', 'To transfer tokens to target')
  .addParam('from', "The account's address")
  .addParam('to', "The account's address")
  .addParam('amount', "The account's address")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    console.log('Account:', accounts[1].address);

    const erc20 = await hre.ethers.getContract('Test20');
    console.log('ERC20 address:', erc20.address);

    const result = await erc20.connect(accounts[1]).transferFrom(taskArgs.from, taskArgs.to, taskArgs.amount);
    const receipt = await result.wait();

    console.log('Transaction hash', receipt.transactionHash);
  });
