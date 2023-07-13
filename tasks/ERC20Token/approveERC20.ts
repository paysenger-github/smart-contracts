//const { ethers } = require("hardhat");
import '@nomiclabs/hardhat-ethers';
import {task} from 'hardhat/config';

task('approveERC20', 'To transfer tokens to target')
  .addParam('to', "The account's address")
  .addParam('amount', "The account's address")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    console.log('Account:', accounts[1].address);

    const erc20 = await hre.ethers.getContract('Test20');
    console.log('ERC20 address:', erc20.address);

    const result = await erc20.connect(accounts[0]).approve(taskArgs.to, taskArgs.amount);
    const tx = await hre.ethers.provider.getTransaction(result.hash);
    const receipt = await tx.wait();

    console.log('Transaction hash', receipt.transactionHash);
  });
