const { assert, expect, AssertionError } = require("chai")
const { BigNumber } = require("ethers")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NFT Marketplace Tests", function () {
          let nftMarketplace, nftMarketplaceContract, basicNft, basicNftContract
          const PRICE = ethers.utils.parseEther("0.1")
          const NEW_PRICE = ethers.utils.parseEther("0.5")
          const TOKEN_ID = 0

          beforeEach(async () => {
              accounts = await ethers.getSigners() // could also do with getNamedAccounts
              deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplaceContract = await ethers.getContract("NftMarketplace")
              nftMarketplace = nftMarketplaceContract.connect(deployer)
              basicNftContract = await ethers.getContract("BasicNft")
              basicNft = await basicNftContract.connect(deployer)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplaceContract.address, TOKEN_ID)
          })

          describe("ListItem", function () {
              it("emits an event after listing an item", async function () {
                  expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })

              it("Lists and can be bought", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  const playerConnectedNFTMktPlace = nftMarketplace.connect(player)
                  await playerConnectedNFTMktPlace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert(newOwner.toString() == player.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })

              it("should revert if price <= 0", async function () {
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, 0)
                  ).to.be.revertedWith("NftMarketPlace__PriceMustBeAboveZero()")
              })

              it("should revert if NFT already listed", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(
                      `NftMarketPlace__AlreadyListed("${basicNft.address}", ${TOKEN_ID})`
                  )
              })

              it("should revert if NFT is not approved for mkt place", async function () {
                  const unapprovedTokenId = TOKEN_ID + 1
                  await basicNft.mintNft()
                  await expect(
                      nftMarketplace.listItem(basicNft.address, unapprovedTokenId, PRICE)
                  ).to.be.revertedWith("NftMarketPlace__NotApprovedForMarketplace()")
              })
          })

          describe("BuyItem", function () {
              it("emits an event after buying the item an item", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(
                      await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit("ItemBought")
              })

              it("should revert if it's not listed", async function () {
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.be.revertedWith(
                      `NftMarketPlace__NotListed("${basicNft.address}", ${TOKEN_ID})`
                  )
              })

              it("should revert if price not met", async function () {
                  const unsufficientPay = ethers.utils.parseEther("0.04")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: unsufficientPay,
                      })
                  ).to.be.revertedWith(
                      `NftMarketPlace__PriceNotMet("${basicNft.address}", ${TOKEN_ID}, ${PRICE})`
                  )
              })

              it("buys the item and updates state", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace.connect(player).buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert(newOwner.toString() == player.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })

          describe("Update & Cancel Listing", function () {
              it("emits an event after canceling the item", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID))
                      .to.emit("ItemCancelled")
                      .withArgs(deployer.address, basicNft.address, TOKEN_ID)
              })
          })

          it("should revert if it's not the owner of the item", async function () {
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
              await expect(
                  nftMarketplace.connect(player).cancelListing(basicNft.address, TOKEN_ID)
              ).to.be.revertedWith("NftMarketPlace__NotOwner()")
          })

          it("should revert cancelling if it's not listed", async function () {
              await expect(
                  nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
              ).to.be.revertedWith(`NftMarketPlace__NotListed("${basicNft.address}", ${TOKEN_ID})`)
          })

          it("should remove listing", async function () {
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
              await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
              const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
              assert(listing.price.toString() == "0")
          })

          it("should emit an event on update", async function () {
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
              expect(await nftMarketplace.updateListings(basicNft.address, TOKEN_ID, NEW_PRICE))
                  .to.emit("IteItemListedEvent")
                  .withArgs(deployer.address, basicNft.address, TOKEN_ID, NEW_PRICE)
          })

          it("should revert update if is not owner", async function () {
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
              await expect(
                  nftMarketplace
                      .connect(player)
                      .updateListings(basicNft.address, TOKEN_ID, NEW_PRICE)
              ).to.be.revertedWith("NftMarketPlace__NotOwner()")
          })

          it("should revert update if is not listed", async function () {
              await expect(
                  nftMarketplace.updateListings(basicNft.address, TOKEN_ID, NEW_PRICE)
              ).to.be.revertedWith(`NftMarketPlace__NotListed("${basicNft.address}", ${TOKEN_ID})`)
          })

          it("should update the price of the listing", async function () {
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
              await nftMarketplace.updateListings(basicNft.address, TOKEN_ID, NEW_PRICE)
              const updatedListing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
              assert(updatedListing.price.toString() == NEW_PRICE)
          })

          describe("Withdraw Proceeds", function () {
              it("should revert if there's no proceeds", async function () {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
                      "NftMarketPlace__NoProceeds()"
                  )
              })

              it("should transfer proceeds to nft seller", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace.connect(player).buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })

                  const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer.address)
                  await nftMarketplace.connect(deployer).withdrawProceeds()
                  const deployerProceedsAfterWitdhraw = await nftMarketplace.getProceeds(
                      deployer.address
                  )
                  assert(deployerProceedsBefore.toString() == PRICE.toString())
                  assert(deployerProceedsAfterWitdhraw == 0)
              })
          })
      })
