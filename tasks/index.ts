import './DistributorERC20/createDistribution.ts';
import './DistributorERC20/claimERC20.ts';
import './AccessControl/revokeRole.ts';
import './AccessControl/grantRole.ts';
import './utils/checkBlockchain';
import './utils/decodeEventTransfer';

//tasks for ERC721 token
import './ERC721Token/getInfoERC721.ts';
import './ERC721Token/mintERC721.ts';
import './ERC721Token/approveERC721.ts';
import './ERC721Token/transferFromERC721.ts';
import './ERC721Token/mintSignatureERC721.ts';

//tasks for ERC20 token
import './ERC20Token/getInfoERC20.ts';
import './ERC20Token/mintERC20.ts';
import './ERC20Token/transferERC20.ts';
import './ERC20Token/approveERC20.ts';
import './ERC20Token/burnERC20.ts';
import './ERC20Token/transferFromERC20.ts';
import './ERC20Token/migrateERC20.ts';
import './ERC20Token/testMigrationERC20.ts';

import './Marketplace/buyItemOnFixedPriceMarket.ts';
import './Marketplace/listFixedPriceMarketItem.ts';
import './Marketplace/startAuctionAndBid.ts';
import './Marketplace/finishEnglishAuction.ts';
import './Marketplace/finishEnglishAuction.ts';

import './CrossChain/transferRemoteERC20.ts';
import './CrossChain/transferRemoteERC721.ts';
import './CrossChain/transferRemoteERC721VRS.ts';
import './CrossChain/setTrustedRemote.ts';
import './CrossChain/changeBridgeStatus.ts';

import './utils/sendNative.ts';
import './utils/decodeEventOfferMade.ts';

import './UniswapV2/addLiquidity.ts';
