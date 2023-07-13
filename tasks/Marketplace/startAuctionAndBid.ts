import '@nomiclabs/hardhat-ethers';
import {parseEther} from 'ethers/lib/utils';
import {task} from 'hardhat/config';

task('startAuctionAndBid', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
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

  const bidAmount = parseEther('4');
  const tokenId = 5;
  const approveNftTx = await reqCreatorToken.connect(accounts[0]).approve(marketplace.address, tokenId);
  await approveNftTx.wait();

  const startPrice = parseEther('1');
  const _minIncreaseInterval = parseEther('0.1');
  const _instantBuyPrice = parseEther('5');
  const _endDate = (await hre.ethers.provider.getBlock(await hre.ethers.provider.getBlockNumber())).timestamp + 1000;

  const listTx = await marketplace
    .connect(accounts[0])
    .listMarketItemOnEnglishAuction(
      startPrice,
      _minIncreaseInterval,
      _instantBuyPrice,
      tokenId,
      _endDate,
      erc20Sample.address,
      reqCreatorToken.address
    );
  const receiptList = await listTx.wait();
  console.log('hash', receiptList.hash);

  const mintTx = await erc20Sample.connect(accounts[0]).mint(accounts[1].address, parseEther('1000'));
  await mintTx.wait();
  const approveTx = await erc20Sample.connect(accounts[1]).approve(marketplace.address, parseEther('1000'));
  await approveTx.wait();

  const bidTx = await marketplace
    .connect(accounts[1])
    .makeBidAtEnglishAuction(reqCreatorToken.address, tokenId, parseEther('4'));
  await bidTx.wait();
});
