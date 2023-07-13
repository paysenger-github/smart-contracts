import '@nomiclabs/hardhat-ethers';
import {task} from 'hardhat/config';

task('getInfoERC20', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[1].address);
  const erc20 = await hre.ethers.getContract('EgoToken');
  console.log('ERC20 address:', erc20.address);
  const name = await erc20.name();
  const symbol = await erc20.symbol();
  const decimals = await erc20.decimals();
  const totalSupply = await erc20.totalSupply();
  const balanceOfAcc0 = await erc20.connect(accounts[1]).balanceOf(accounts[0].address);
  const balanceOfAcc1 = await erc20.connect(accounts[1]).balanceOf(accounts[1].address);
  const balanceOfAcc2 = await erc20.connect(accounts[1]).balanceOf(accounts[2].address);
  const allowance = await erc20.allowance(accounts[2].address, accounts[0].address);

  console.log('----------------Start_-----------------');
  console.log('Name', name);
  console.log('---------------------------------------');
  console.log('Symbol', symbol);
  console.log('---------------------------------------');
  console.log('decimals', decimals);
  console.log('---------------------------------------');
  console.log('totalSupply', totalSupply);
  console.log('---------------------------------------');
  console.log('balanceOf', balanceOfAcc0, ' of address', accounts[0].address);
  console.log('balanceOf', balanceOfAcc1, ' of address', accounts[1].address);
  console.log('balanceOf', balanceOfAcc2, ' of address', accounts[3].address);
  console.log('---------------------------------------');
  console.log('allowance', allowance);
  console.log('----------------End--------------------');
});
