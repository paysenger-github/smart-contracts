import {expect} from './chai-setup';
import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {ERC721ReqCreator, ERC721Market, EgoToken, ERC721Sample} from '../typechain';
import {getCurrentTimestamp, setupUser, setupUsers, zeroAddr} from './utils';
import {parseEther} from 'ethers/lib/utils';
import {BigNumber} from 'ethers';
import errors from './utils/errors.json';

//yarn test
const setup = deployments.createFixture(async () => {
  await deployments.fixture(['ERC721ReqCreator', 'ERC721Market', 'EgoToken', 'ERC721Sample']);
  const {admin, validator} = await getNamedAccounts();

  const contracts = {
    reqCreatorToken: <ERC721ReqCreator>await ethers.getContract('ERC721ReqCreator'),
    erc721Sample: <ERC721Sample>await ethers.getContract('ERC721Sample'),
    EgoToken: <EgoToken>await ethers.getContract('EgoToken'),
    marketplace: <ERC721Market>await ethers.getContract('ERC721Market'),
  };

  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    ...contracts,
    users,
    admin: await setupUser(admin, contracts),
    validator: await setupUser(validator, contracts),
  };
});

describe('Marketplace', () => {
  const uri = 'just simple uri';

  const tokenId = 0;
  const price = parseEther('10');
  const bidPrice = parseEther('12');
  const instantBuyPrice = parseEther('20');
  const minIncreaseInterval = parseEther('1');

  const royaltyFeeNumerator = 750;
  const marketplaceFeeNumerator = 500;
  const royaltyFeeAmountFixed = calculatePercent(BigNumber.from(royaltyFeeNumerator), BigNumber.from(price));
  const marketplaceFeeAmountFixed = calculatePercent(BigNumber.from(marketplaceFeeNumerator), BigNumber.from(price));

  before(async () => {
    const {admin, EgoToken} = await setup();
    await admin.marketplace.updateTokenList(EgoToken.address, 1);
  });

  it('mint token', async () => {
    const {users, reqCreatorToken} = await setup();
    const amount = 1000;

    await expect(users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[0].address))
      .to.emit(reqCreatorToken, 'Transfer')
      .withArgs(zeroAddr, users[1].address, tokenId);
    const royaltyInfo = await users[0].reqCreatorToken.royaltyInfo(tokenId, amount);

    expect(await users[0].reqCreatorToken.balanceOf(users[1].address)).to.eq(1);
    expect(await users[0].reqCreatorToken.ownerOf(tokenId)).to.eq(users[1].address);
    expect(await users[0].reqCreatorToken.tokenURI(tokenId)).to.eq(uri);
    expect(royaltyInfo[0]).to.eq(users[0].address);
    expect(royaltyInfo[1]).to.eq(calculatePercent(BigNumber.from(royaltyFeeNumerator), BigNumber.from(amount)));
  });

  it('listFixedPriceMarketItem by user', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[0].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await expect(
      users[1].marketplace.listFixedPriceMarketItem(reqCreatorToken.address, tokenId, 0, EgoToken.address)
    ).to.be.revertedWith('AmountCanNotBeZero()');

    await expect(
      users[1].marketplace.listFixedPriceMarketItem(reqCreatorToken.address, tokenId, price, EgoToken.address)
    )
      .to.emit(marketplace, 'FixedPriceMarketItemListed')
      .withArgs(reqCreatorToken.address, tokenId, price, EgoToken.address)
      .and.to.emit(reqCreatorToken, 'Transfer')
      .withArgs(users[1].address, marketplace.address, tokenId);

    const idToMarketItem = await marketplace.getLatestMarketItem(reqCreatorToken.address, tokenId);
    expect(idToMarketItem.price).to.eq(price);
    expect(idToMarketItem.erc20Token).to.eq(EgoToken.address);
    expect(idToMarketItem.seller).to.eq(users[1].address);
    expect(idToMarketItem.isActive).to.eq(true);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(marketplace.address);
  });

  it('buyItemOnFixedPriceMarket by user', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);
    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[3].address);
    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);
    await admin.EgoToken.transfer(users[0].address, price);

    await users[0].EgoToken.approve(marketplace.address, price);

    await users[1].marketplace.listFixedPriceMarketItem(reqCreatorToken.address, tokenId, price, EgoToken.address);

    await expect(users[0].marketplace.buyItemOnFixedPriceMarket(reqCreatorToken.address, tokenId))
      .to.emit(EgoToken, 'Transfer')
      .withArgs(users[0].address, marketplace.address, price)
      .and.to.emit(EgoToken, 'Transfer')
      .withArgs(marketplace.address, users[3].address, royaltyFeeAmountFixed)
      .and.to.emit(EgoToken, 'Transfer')
      .withArgs(marketplace.address, users[1].address, price.sub(marketplaceFeeAmountFixed.add(royaltyFeeAmountFixed)))
      .and.to.emit(reqCreatorToken, 'Transfer')
      .withArgs(marketplace.address, users[0].address, tokenId);

    const idToMarketItem = await marketplace.getLatestMarketItem(reqCreatorToken.address, tokenId);
    expect(idToMarketItem.price).to.eq(price);
    expect(idToMarketItem.erc20Token).to.eq(EgoToken.address);
    expect(idToMarketItem.seller).to.eq(users[1].address);
    expect(idToMarketItem.isActive).to.eq(false);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(marketplaceFeeAmountFixed);
    expect(await EgoToken.balanceOf(users[3].address)).to.eq(royaltyFeeAmountFixed);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(
      price.sub(marketplaceFeeAmountFixed.add(royaltyFeeAmountFixed))
    );
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(users[0].address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(users[0].address);
  });

  it('delistFixedPriceMarketItem by user', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[0].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listFixedPriceMarketItem(reqCreatorToken.address, tokenId, price, EgoToken.address);

    await users[1].marketplace.delistFixedPriceMarketItem(reqCreatorToken.address, tokenId);

    const idToMarketItem = await marketplace.getLatestMarketItem(reqCreatorToken.address, tokenId);
    expect(idToMarketItem.price).to.eq(price);
    expect(idToMarketItem.erc20Token).to.eq(EgoToken.address);
    expect(idToMarketItem.seller).to.eq(users[1].address);
    expect(idToMarketItem.isActive).to.eq(false);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(users[1].address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(users[1].address);
  });

  it('listMarketItemOnEnglishAuction by user', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);

    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[0].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    //Check that address can not list someone else's token
    await expect(
      users[0].marketplace.listMarketItemOnEnglishAuction(
        price,
        minIncreaseInterval,
        instantBuyPrice,
        tokenId,
        endDate,
        EgoToken.address,
        reqCreatorToken.address
      )
    ).to.be.revertedWith('ERC721: transfer from incorrect owner');

    await expect(
      users[1].marketplace.listMarketItemOnEnglishAuction(
        price,
        minIncreaseInterval,
        instantBuyPrice,
        tokenId,
        endDate,
        EgoToken.address,
        reqCreatorToken.address
      )
    )
      .to.emit(marketplace, 'EnglishAuctionStarted')
      .withArgs(
        price,
        minIncreaseInterval,
        instantBuyPrice,
        tokenId,
        endDate,
        EgoToken.address,
        reqCreatorToken.address,
        users[1].address
      )
      .and.to.emit(reqCreatorToken, 'Transfer')
      .withArgs(users[1].address, marketplace.address, tokenId);

    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(price.sub(minIncreaseInterval));
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.minIncreaseInterval).to.eq(minIncreaseInterval);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(zeroAddr);
    expect(auction.state).to.eq(1);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(1);
    expect(await reqCreatorToken.balanceOf(users[1].address)).to.eq(0);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(marketplace.address);
  });

  it('makeBidAtEnglishAuction by user', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);

    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[0].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await admin.EgoToken.approve(marketplace.address, bidPrice);

    await expect(admin.marketplace.makeBidAtEnglishAuction(reqCreatorToken.address, tokenId, bidPrice))
      .to.emit(EgoToken, 'Transfer')
      .withArgs(admin.address, marketplace.address, bidPrice)
      .and.to.emit(marketplace, 'BidMade')
      .withArgs(admin.address, bidPrice, reqCreatorToken.address, tokenId);

    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(bidPrice);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(admin.address);
    expect(auction.state).to.eq(1);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(1);
    expect(await reqCreatorToken.balanceOf(users[1].address)).to.eq(0);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(marketplace.address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(bidPrice);
  });

  it('makeBidAtEnglishAuction by user', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();
    //put this to before block

    await admin.marketplace.updateTokenList(EgoToken.address, 1);

    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[0].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await admin.EgoToken.approve(marketplace.address, bidPrice);

    await expect(admin.marketplace.makeBidAtEnglishAuction(reqCreatorToken.address, tokenId, bidPrice))
      .to.emit(EgoToken, 'Transfer')
      .withArgs(admin.address, marketplace.address, bidPrice)
      .and.to.emit(marketplace, 'BidMade')
      .withArgs(admin.address, bidPrice, reqCreatorToken.address, tokenId);

    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(bidPrice);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(admin.address);
    expect(auction.state).to.eq(1);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(1);
    expect(await reqCreatorToken.balanceOf(users[1].address)).to.eq(0);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(marketplace.address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(bidPrice);
  });

  it('instantBuyAtEnglishAuction by token owner', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);
    const royaltyFeeAmountAuction = calculatePercent(
      BigNumber.from(royaltyFeeNumerator),
      BigNumber.from(instantBuyPrice)
    );
    const marketplaceFeeAmount = calculatePercent(
      BigNumber.from(marketplaceFeeNumerator),
      BigNumber.from(instantBuyPrice)
    );

    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[3].address);
    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await admin.EgoToken.approve(marketplace.address, bidPrice);
    await admin.EgoToken.transfer(users[0].address, instantBuyPrice);
    await users[0].EgoToken.approve(marketplace.address, instantBuyPrice);
    await admin.marketplace.makeBidAtEnglishAuction(reqCreatorToken.address, tokenId, bidPrice);

    await expect(users[0].marketplace.instantBuyAtEnglishAuction(reqCreatorToken.address, tokenId))
      .to.emit(EgoToken, 'Transfer')
      .withArgs(marketplace.address, admin.address, bidPrice)
      .and.to.emit(EgoToken, 'Transfer')
      .withArgs(users[0].address, marketplace.address, instantBuyPrice)
      .and.to.emit(EgoToken, 'Transfer')
      .withArgs(
        marketplace.address,
        users[1].address,
        instantBuyPrice.sub(marketplaceFeeAmount.add(royaltyFeeAmountAuction))
      )
      .and.to.emit(reqCreatorToken, 'Transfer')
      .withArgs(marketplace.address, users[0].address, tokenId)
      .and.to.emit(marketplace, 'AuctionFinished')
      .withArgs(users[1].address, users[0].address, reqCreatorToken.address, tokenId, instantBuyPrice);

    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(bidPrice);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(admin.address);
    expect(auction.state).to.eq(2);

    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(users[0].address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(users[0].address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(marketplaceFeeAmount);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(
      instantBuyPrice.sub(marketplaceFeeAmount).sub(royaltyFeeAmountAuction)
    );
    expect(await EgoToken.balanceOf(users[3].address)).to.eq(royaltyFeeAmountAuction);

    await expect(
      admin.marketplace.makeBidAtEnglishAuction(reqCreatorToken.address, tokenId, bidPrice)
    ).to.be.revertedWith(errors.InvalidBidAmount);
    await expect(users[1].marketplace.finishEnglishAuction(reqCreatorToken.address, tokenId)).to.be.revertedWith(
      errors.InvalidTimeForFunction
    );
    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);
    await expect(users[1].marketplace.finishEnglishAuction(reqCreatorToken.address, tokenId)).to.be.revertedWith(
      errors.InvalidAuctionState
    );
  });

  it('finishEnglishAuction', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);
    const royaltyFeeAmountAuction = calculatePercent(BigNumber.from(royaltyFeeNumerator), BigNumber.from(bidPrice));
    const marketplaceFeeAmount = calculatePercent(BigNumber.from(marketplaceFeeNumerator), BigNumber.from(bidPrice));

    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[3].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await admin.EgoToken.approve(marketplace.address, bidPrice);
    await admin.marketplace.makeBidAtEnglishAuction(reqCreatorToken.address, tokenId, bidPrice);

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await expect(users[0].marketplace.finishEnglishAuction(reqCreatorToken.address, tokenId))
      .to.emit(EgoToken, 'Transfer')
      .withArgs(marketplace.address, users[3].address, royaltyFeeAmountAuction)
      .and.to.emit(EgoToken, 'Transfer')
      .withArgs(marketplace.address, users[1].address, bidPrice.sub(marketplaceFeeAmount.add(royaltyFeeAmountAuction)))
      .and.to.emit(reqCreatorToken, 'Transfer')
      .withArgs(marketplace.address, admin.address, tokenId)
      .and.to.emit(marketplace, 'AuctionFinished')
      .withArgs(users[1].address, admin.address, reqCreatorToken.address, tokenId, bidPrice);

    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(bidPrice);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(admin.address);
    expect(auction.state).to.eq(2);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(admin.address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(admin.address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(marketplaceFeeAmount);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(
      bidPrice.sub(marketplaceFeeAmount).sub(royaltyFeeAmountAuction)
    );
    expect(await EgoToken.balanceOf(users[3].address)).to.eq(royaltyFeeAmountAuction);
  });

  it('finishUnsuccessfulAuction by user', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);

    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[0].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await expect(users[1].marketplace.finishUnsuccessfulAuction(reqCreatorToken.address, tokenId))
      .to.emit(reqCreatorToken, 'Transfer')
      .withArgs(marketplace.address, users[1].address, tokenId)
      .and.to.emit(marketplace, 'AuctionFinished')
      .withArgs(users[1].address, users[1].address, reqCreatorToken.address, tokenId, 0);

    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(price.sub(minIncreaseInterval));
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(zeroAddr);
    expect(auction.state).to.eq(3);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(users[1].address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(users[1].address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(0);
  });

  it('Scenario: successful auction', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    const amountOfBids = 5;
    const lastBidAmount = price.add(minIncreaseInterval.mul(amountOfBids - 1));
    await admin.marketplace.updateTokenList(EgoToken.address, 1);
    const royaltyFeeAmountAuction = calculatePercent(
      BigNumber.from(royaltyFeeNumerator),
      BigNumber.from(lastBidAmount)
    );
    const marketplaceFeeAmount = calculatePercent(
      BigNumber.from(marketplaceFeeNumerator),
      BigNumber.from(lastBidAmount)
    );
    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[2].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    for (let i = 0; i < amountOfBids; i++) {
      await admin.EgoToken.transfer(users[i + 3].address, instantBuyPrice.mul(10));
      await users[i + 3].EgoToken.approve(marketplace.address, instantBuyPrice.mul(10));
      await users[i + 3].marketplace.makeBidAtEnglishAuction(
        reqCreatorToken.address,
        tokenId,
        price.add(minIncreaseInterval.mul(i))
      );
    }

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await users[0].marketplace.finishEnglishAuction(reqCreatorToken.address, tokenId);
    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(lastBidAmount);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(users[amountOfBids + 2].address);
    expect(auction.state).to.eq(2);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(users[amountOfBids + 2].address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(users[amountOfBids + 2].address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(marketplaceFeeAmount);
    expect(await marketplace.collectedFee(EgoToken.address)).to.eq(marketplaceFeeAmount);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(
      lastBidAmount.sub(marketplaceFeeAmount).sub(royaltyFeeAmountAuction)
    );
    expect(await EgoToken.balanceOf(users[2].address)).to.eq(royaltyFeeAmountAuction);

    await expect(admin.marketplace.withdrawFee(EgoToken.address, admin.address, marketplaceFeeAmount))
      .to.emit(EgoToken, 'Transfer')
      .withArgs(marketplace.address, admin.address, marketplaceFeeAmount);
    expect(await marketplace.collectedFee(EgoToken.address)).to.eq(0);
  });

  it('Scenario: instant buy using great bid', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    const lastBidAmount = instantBuyPrice;
    await admin.marketplace.updateTokenList(EgoToken.address, 1);
    const royaltyFeeAmountAuction = calculatePercent(
      BigNumber.from(royaltyFeeNumerator),
      BigNumber.from(lastBidAmount)
    );
    const marketplaceFeeAmount = calculatePercent(
      BigNumber.from(marketplaceFeeNumerator),
      BigNumber.from(lastBidAmount)
    );
    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[2].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await admin.EgoToken.transfer(users[4].address, instantBuyPrice.mul(10));
    await users[4].EgoToken.approve(marketplace.address, instantBuyPrice.mul(10));
    await users[4].marketplace.makeBidAtEnglishAuction(reqCreatorToken.address, tokenId, instantBuyPrice.mul(2));

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await expect(users[0].marketplace.finishEnglishAuction(reqCreatorToken.address, tokenId)).to.be.revertedWith(
      errors.InvalidAuctionState
    );
    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(lastBidAmount);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(users[4].address);
    expect(auction.state).to.eq(2);

    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(users[4].address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(users[4].address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(marketplaceFeeAmount);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(
      lastBidAmount.sub(marketplaceFeeAmount).sub(royaltyFeeAmountAuction)
    );
    expect(await EgoToken.balanceOf(users[2].address)).to.eq(royaltyFeeAmountAuction);
  });

  it('Scenario: successful auction, but users trying to make bids after endDate', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    const amountOfBids = 5;
    await admin.marketplace.updateTokenList(EgoToken.address, 1);
    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[2].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    for (let i = 0; i < amountOfBids; i++) {
      await admin.EgoToken.transfer(users[i + 3].address, instantBuyPrice.mul(10));
      await users[i + 3].EgoToken.approve(marketplace.address, instantBuyPrice.mul(10));
      await expect(
        users[i + 3].marketplace.makeBidAtEnglishAuction(
          reqCreatorToken.address,
          tokenId,
          price.add(minIncreaseInterval.mul(i))
        )
      ).to.be.revertedWith(errors.InvalidTimeForFunction);
    }

    await expect(users[0].marketplace.finishEnglishAuction(reqCreatorToken.address, tokenId)).to.be.revertedWith(
      errors.IncorrectProcessingOfTheAuctionResult
    );

    await users[0].marketplace.finishUnsuccessfulAuction(reqCreatorToken.address, tokenId);

    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(price.sub(minIncreaseInterval));
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(zeroAddr);
    expect(auction.state).to.eq(3);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(users[1].address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(users[1].address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(0);
    expect(await EgoToken.balanceOf(users[2].address)).to.eq(0);
  });

  it('Scenario: trying to list item on fixed price sale and auction', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);

    let startDate = await getCurrentTimestamp();
    let endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[2].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await expect(
      users[1].marketplace.listFixedPriceMarketItem(reqCreatorToken.address, tokenId, price, EgoToken.address)
    ).to.be.revertedWith('ERC721: transfer from incorrect owner');

    await expect(users[1].marketplace.delistFixedPriceMarketItem(reqCreatorToken.address, tokenId)).to.be.revertedWith(
      errors.ItemDidNotListed
    );

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await users[1].marketplace.finishUnsuccessfulAuction(reqCreatorToken.address, tokenId);

    startDate = await getCurrentTimestamp();
    endDate = startDate + 100;

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listFixedPriceMarketItem(reqCreatorToken.address, tokenId, price, EgoToken.address);

    await expect(
      users[1].marketplace.listMarketItemOnEnglishAuction(
        price,
        minIncreaseInterval,
        instantBuyPrice,
        tokenId,
        endDate,
        EgoToken.address,
        reqCreatorToken.address
      )
    ).to.be.revertedWith('ERC721: transfer from incorrect owner');
  });

  it('Scenario: trying to bid after instant buy', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    await admin.marketplace.updateTokenList(EgoToken.address, 1);

    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[2].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    await admin.EgoToken.transfer(users[0].address, instantBuyPrice);
    await users[0].EgoToken.approve(marketplace.address, instantBuyPrice);

    await users[0].marketplace.instantBuyAtEnglishAuction(reqCreatorToken.address, tokenId);

    await expect(
      admin.marketplace.makeBidAtEnglishAuction(reqCreatorToken.address, tokenId, bidPrice)
    ).to.be.revertedWith(errors.InvalidAuctionState);

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await expect(users[1].marketplace.finishEnglishAuction(reqCreatorToken.address, tokenId)).to.be.revertedWith(
      errors.InvalidAuctionState
    );
  });

  it('Scenario: successful auction, ERC20 token without fee', async () => {
    const {admin, users, reqCreatorToken, marketplace, EgoToken} = await setup();

    const amountOfBids = 5;
    const lastBidAmount = price.add(minIncreaseInterval.mul(amountOfBids - 1));
    await admin.marketplace.updateTokenList(EgoToken.address, 2);
    const royaltyFeeAmountAuction = calculatePercent(
      BigNumber.from(royaltyFeeNumerator),
      BigNumber.from(lastBidAmount)
    );
    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].reqCreatorToken.safeMint(users[1].address, uri, royaltyFeeNumerator, users[2].address);

    await users[1].reqCreatorToken.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      reqCreatorToken.address
    );

    for (let i = 0; i < amountOfBids; i++) {
      await admin.EgoToken.transfer(users[i + 3].address, instantBuyPrice.mul(10));
      await users[i + 3].EgoToken.approve(marketplace.address, instantBuyPrice.mul(10));
      await users[i + 3].marketplace.makeBidAtEnglishAuction(
        reqCreatorToken.address,
        tokenId,
        price.add(minIncreaseInterval.mul(i))
      );
    }

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await users[0].marketplace.finishEnglishAuction(reqCreatorToken.address, tokenId);
    const auction = await marketplace.getLatestEnglishAuction(reqCreatorToken.address, tokenId);

    expect(auction.currentPrice).to.eq(lastBidAmount);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(reqCreatorToken.address);
    expect(auction.latestBidder).to.eq(users[amountOfBids + 2].address);
    expect(auction.state).to.eq(2);
    expect(await reqCreatorToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await reqCreatorToken.balanceOf(users[amountOfBids + 2].address)).to.eq(1);
    expect(await reqCreatorToken.ownerOf(tokenId)).to.eq(users[amountOfBids + 2].address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(lastBidAmount.sub(royaltyFeeAmountAuction));
    expect(await EgoToken.balanceOf(users[2].address)).to.eq(royaltyFeeAmountAuction);
  });

  it('Scenario: successful auction, ERC721 token without royalty', async () => {
    const {admin, users, marketplace, EgoToken, erc721Sample} = await setup();

    const amountOfBids = 5;
    const lastBidAmount = price.add(minIncreaseInterval.mul(amountOfBids - 1));
    await admin.marketplace.updateTokenList(EgoToken.address, 1);
    const marketplaceFeeAmount = calculatePercent(
      BigNumber.from(marketplaceFeeNumerator),
      BigNumber.from(lastBidAmount)
    );
    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].erc721Sample.safeMint(users[1].address, uri);

    await users[1].erc721Sample.approve(marketplace.address, tokenId);

    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      erc721Sample.address
    );

    for (let i = 0; i < amountOfBids; i++) {
      await admin.EgoToken.transfer(users[i + 3].address, instantBuyPrice.mul(10));
      await users[i + 3].EgoToken.approve(marketplace.address, instantBuyPrice.mul(10));
      await users[i + 3].marketplace.makeBidAtEnglishAuction(
        erc721Sample.address,
        tokenId,
        price.add(minIncreaseInterval.mul(i))
      );
    }

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await users[0].marketplace.finishEnglishAuction(erc721Sample.address, tokenId);
    const auction = await marketplace.getLatestEnglishAuction(erc721Sample.address, tokenId);

    expect(auction.currentPrice).to.eq(lastBidAmount);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(erc721Sample.address);
    expect(auction.latestBidder).to.eq(users[amountOfBids + 2].address);
    expect(auction.state).to.eq(2);
    expect(await erc721Sample.balanceOf(marketplace.address)).to.eq(0);
    expect(await erc721Sample.balanceOf(users[amountOfBids + 2].address)).to.eq(1);
    expect(await erc721Sample.ownerOf(tokenId)).to.eq(users[amountOfBids + 2].address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(marketplaceFeeAmount);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(lastBidAmount.sub(marketplaceFeeAmount));
    expect(await EgoToken.balanceOf(users[2].address)).to.eq(0);
  });

  it('Scenario: successful auction, ERC721 token without royalty and ERC20 token without fee', async () => {
    const {admin, users, marketplace, EgoToken, erc721Sample} = await setup();

    const amountOfBids = 5;
    const lastBidAmount = price.add(minIncreaseInterval.mul(amountOfBids - 1));
    await admin.marketplace.updateTokenList(EgoToken.address, 2);
    const startDate = await getCurrentTimestamp();
    const endDate = startDate + 100;

    await users[0].erc721Sample.safeMint(users[1].address, uri);
    await users[1].erc721Sample.approve(marketplace.address, tokenId);
    await users[1].marketplace.listMarketItemOnEnglishAuction(
      price,
      minIncreaseInterval,
      instantBuyPrice,
      tokenId,
      endDate,
      EgoToken.address,
      erc721Sample.address
    );

    for (let i = 0; i < amountOfBids; i++) {
      await admin.EgoToken.transfer(users[i + 3].address, instantBuyPrice.mul(10));
      await users[i + 3].EgoToken.approve(marketplace.address, instantBuyPrice.mul(10));
      await users[i + 3].marketplace.makeBidAtEnglishAuction(
        erc721Sample.address,
        tokenId,
        price.add(minIncreaseInterval.mul(i))
      );
    }

    await ethers.provider.send('evm_setNextBlockTimestamp', [endDate + 1]);
    await ethers.provider.send('evm_mine', []);

    await users[0].marketplace.finishEnglishAuction(erc721Sample.address, tokenId);
    const auction = await marketplace.getLatestEnglishAuction(erc721Sample.address, tokenId);

    expect(auction.currentPrice).to.eq(lastBidAmount);
    expect(auction.instantBuyPrice).to.eq(instantBuyPrice);
    expect(auction.tokenId).to.eq(tokenId);
    expect(auction.endDate).to.eq(endDate);
    expect(auction.tokenOwner).to.eq(users[1].address);
    expect(auction.erc20Token).to.eq(EgoToken.address);
    expect(auction.erc721Token).to.eq(erc721Sample.address);
    expect(auction.latestBidder).to.eq(users[amountOfBids + 2].address);
    expect(auction.state).to.eq(2);
    expect(await erc721Sample.balanceOf(marketplace.address)).to.eq(0);
    expect(await erc721Sample.balanceOf(users[amountOfBids + 2].address)).to.eq(1);
    expect(await erc721Sample.ownerOf(tokenId)).to.eq(users[amountOfBids + 2].address);
    expect(await EgoToken.balanceOf(marketplace.address)).to.eq(0);
    expect(await EgoToken.balanceOf(users[1].address)).to.eq(lastBidAmount);
    expect(await EgoToken.balanceOf(users[2].address)).to.eq(0);
  });

  it('Scenario: buy and sell some times in fixed price market', async () => {
    const {admin, users, marketplace, EgoToken, reqCreatorToken} = await setup();

    const amountOfSales = 10;
    await admin.marketplace.updateTokenList(EgoToken.address, 2);

    await users[0].reqCreatorToken.safeMint(users[0].address, uri, royaltyFeeNumerator, users[2].address);

    for (let i = 0; i < amountOfSales; i++) {
      await users[i].reqCreatorToken.approve(marketplace.address, 0);
      await admin.EgoToken.transfer(users[i + 1].address, price);

      await users[i + 1].EgoToken.approve(marketplace.address, price);

      await users[i].marketplace.listFixedPriceMarketItem(reqCreatorToken.address, tokenId, price, EgoToken.address);

      await users[i + 1].marketplace.buyItemOnFixedPriceMarket(reqCreatorToken.address, tokenId);
    }
  });
});

function calculatePercent(percent: BigNumber, sum: BigNumber) {
  return ethers.BigNumber.from(sum.mul(percent).div(10000));
}
