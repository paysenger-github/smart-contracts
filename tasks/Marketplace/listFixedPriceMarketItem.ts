import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';

task('listFixedPriceMarketItem', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log('Account:', accounts[0].address);

  const egoToken = await hre.ethers.getContract('EgoToken');
  const erc20Sample = await hre.ethers.getContract('ERC20Sample');
  const reqCreatorToken = await hre.ethers.getContract('ERC721ReqCreator');
  const marketplace = await hre.ethers.getContract('ERC721Market');
  console.log('ERC721 address:', marketplace.address);

  const feeNumerator = 1000;
  const creator = '0x56Dc3F6E88a3DE1E8Abb76c44a7c614AB7961dE1';
  const result = await reqCreatorToken
    .connect(accounts[0])
    .safeMint(
      accounts[0].address,
      'https://gateway.pinata.cloud/ipfs/QmaLxPr4e6b9DVuh4mxGL2wHzG15raaBhvRS65dDeYU8aU',
      feeNumerator,
      creator
    );
  const receipt = await result.wait();

  const tokenId = 1;
  const approveTx = await reqCreatorToken.connect(accounts[0]).approve(marketplace.address, tokenId);
  await approveTx.wait();

  const price = parseEther('0.001');
  const listTx = await marketplace
    .connect(accounts[0])
    .listFixedPriceMarketItem(reqCreatorToken.address, tokenId, price, erc20Sample.address);
  const receiptList = await listTx.wait();
  console.log('hash', receiptList.hash);
});
