import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';

task('finishEnglishAuction', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log('Account:', accounts[0].address);

  const erc20Sample = await hre.ethers.getContract('ERC20Sample');
  const reqCreatorToken = await hre.ethers.getContract('ERC721ReqCreator');
  const marketplace = await hre.ethers.getContract('ERC721Market');
  console.log('ERC721 address:', marketplace.address);

  const mintTx = await erc20Sample.connect(accounts[0]).mint(accounts[1].address, parseEther('1000'));
  await mintTx.wait();
  const approveTx = await erc20Sample.connect(accounts[1]).approve(marketplace.address, parseEther('1000'));
  await approveTx.wait();

  const tokenId = 5;
  console.log(await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId));

  const buyTx = await marketplace.connect(accounts[0]).finishEnglishAuction(reqCreatorToken.address, tokenId);
  await buyTx.wait();

  console.log('hash', buyTx.hash);
});
