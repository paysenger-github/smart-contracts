//const { ethers } = require("hardhat");
import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';

task('addLiquidity', 'To transfer tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log('Account:', accounts[1].address);

  const factory = await hre.ethers.getContractAt('IUniswapV2Factory', '0x69004509291F4a4021fA169FafdCFc2d92aD02Aa');

  const router = await hre.ethers.getContractAt('IUniswapV2Router01', '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506');

  const erc20Test = await hre.ethers.getContractAt('EgoToken', '0xaEb60264907F764a423DD874f8fCc3c95178b337');
  const erc20Ego = await hre.ethers.getContractAt('EgoToken', '0x4143fD4A642D7B9B4E418dD1ab60f52F8627F44f');

  console.log('ERC20 address:', (await erc20Test.balanceOf(accounts[1].address)).toString());
  console.log('ERC20 address:', (await erc20Ego.balanceOf(accounts[1].address)).toString());

  await erc20Test.connect(accounts[1]).approve(router.address, parseEther('1000'));
  await erc20Ego.connect(accounts[1]).approve(router.address, parseEther('1000'));
  const addLiq = await router
    .connect(accounts[1])
    .addLiquidity(
      erc20Test.address,
      erc20Ego.address,
      parseEther('1000'),
      parseEther('1000'),
      1,
      1,
      accounts[1].address,
      1000000000000000,
      {gasPrice: 100000000000}
    );

    
  console.log('liqudity added', addLiq);
  // const result = await erc20.connect(accounts[0]).approve(taskArgs.to, taskArgs.amount);
  // const tx = await hre.ethers.provider.getTransaction(result.hash);
  // const receipt = await tx.wait();

  // console.log('Transaction hash', receipt.transactionHash);
});
