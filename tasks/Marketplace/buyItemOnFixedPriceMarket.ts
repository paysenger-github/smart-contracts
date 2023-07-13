import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';

task('buyItemOnFixedPriceMarket', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log('Account:', accounts[0].address);

  const egoToken = await hre.ethers.getContract('EgoToken');
  const erc20Sample = await hre.ethers.getContract('ERC20Sample');
  const reqCreatorToken = await hre.ethers.getContract('ERC721ReqCreator');
  const marketplace = await hre.ethers.getContract('ERC721Market');
  console.log('ERC721 address:', marketplace.address);

  const mintTx = await erc20Sample.connect(accounts[0]).mint(accounts[1].address, parseEther('1000'));
  await mintTx.wait();
  const approveTx = await erc20Sample.connect(accounts[1]).approve(marketplace.address, parseEther('1000'));
  await approveTx.wait();

  const price = parseEther('0.001');
  const tokenId = 1;
  const buyTx = await marketplace.connect(accounts[1]).buyItemOnFixedPriceMarket(reqCreatorToken.address, tokenId);

  await buyTx.wait();

  console.log('hash', buyTx.hash);
});
