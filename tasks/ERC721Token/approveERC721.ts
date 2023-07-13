import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";

task("approveERC721", "To transfer tokens to target")
  .addParam("to", "The account's address")
  .addParam("tokenId", "The account's address")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    console.log("Account:", accounts[2].address);

    const erc721 = await hre.ethers.getContract("Test721");
    console.log("ERC721 address:", erc721.address);

    let result = await erc721
      .connect(accounts[1])
      .approve(taskArgs.to, taskArgs.tokenId);
    let receipt = await result.wait();

    console.log("Transaction hash", receipt.transactionHash);
  });
