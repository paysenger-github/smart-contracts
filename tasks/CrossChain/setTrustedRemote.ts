import '@nomiclabs/hardhat-ethers';
import {task} from 'hardhat/config';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

task('setTrustedRemote', 'To mint tokens to target').setAction(async (taskArgs, hre) => {
  const supportedChains = ['Polygon', 'binance', 'Ethereum', 'Avalanche', 'Moonbeam', 'arbitrum'];
  const chainIds = [137, 56, 1, 43114, 1284, 42161];

  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[1].address);

  let trustedRemoteLookup;
  const egoToken = await hre.ethers.getContract('EgoToken');
  const gasPrice = await hre.ethers.provider.getGasPrice();
  for (let i = 0; i < supportedChains.length; i++) {
    const tx = await egoToken.connect(accounts[1]).setTrustedRemote(supportedChains[i], true, chainIds[i]);
    await tx.wait();
    trustedRemoteLookup = await egoToken.trustedRemotes(supportedChains[i]);

    console.log('-----They-must-be-the-same------');
    console.log(trustedRemoteLookup);
    console.log('Trusted remote set for network', supportedChains[i]);
    console.log('--------------------------------');
  }

  console.log('Remote successfully set');
});
