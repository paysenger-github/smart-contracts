import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";

task("transferFromERC721", "To transfer tokens to target")
  .addParam("from", "The account's address")
  .addParam("to", "The account's address")
  .addParam("tokenId", "The account's address")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    console.log("Account:", accounts[1].address);

    const erc721 = await hre.ethers.getContract("Test721");
    console.log("ERC721 address:", erc721.address);

    let result = await erc721
      .connect(accounts[0])
      .transferFrom(taskArgs.from, taskArgs.to, taskArgs.tokenId);
    let receipt = await result.wait();

    console.log("Transaction hash", receipt.transactionHash);
  });
