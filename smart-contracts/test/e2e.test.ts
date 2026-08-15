import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployFullSuiteFixture, deployIdentityProxy } from './fixtures/deploy-full-suite.fixture';

describe('End-to-End Flow with Deployed Addresses', () => {
  it('should complete the full flow from creating identity, adding claim, to transfer', async () => {
    const {
      suite: { token, claimTopicsRegistry, trustedIssuersRegistry, identityRegistry, claimIssuerContract },
      accounts: { deployer, aliceWallet, davidWallet, claimIssuerSigningKey, tokenAgent },
      authorities: { identityImplementationAuthority },
    } = await loadFixture(deployFullSuiteFixture);

    // We will use David as our new user
    const davidActionKey = ethers.Wallet.createRandom();
    const CLAIM_TOPIC = ethers.utils.id('CLAIM_TOPIC'); // using the topic already registered in fixture

    // 1. Create Identity for David
    const davidIdentity = await deployIdentityProxy(identityImplementationAuthority.address, davidWallet.address, deployer);

    // 2. Add Key to David's Identity
    await davidIdentity
      .connect(davidWallet)
      .addKey(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address'], [davidActionKey.address])), 2, 1);

    // 3. Register David's Identity in the Registry (done by agent)
    // tokenAgent is already an agent on identityRegistry from the fixture
    await identityRegistry.connect(tokenAgent).registerIdentity(davidWallet.address, davidIdentity.address, 42); // 42 is the country code

    // 4. Add Claim to David's Identity (from Claim Issuer)
    const claimForDavid = {
      data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes('David is verified.')),
      issuer: claimIssuerContract.address,
      topic: CLAIM_TOPIC,
      scheme: 1,
      identity: davidIdentity.address,
      signature: '',
    };

    claimForDavid.signature = await claimIssuerSigningKey.signMessage(
      ethers.utils.arrayify(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [claimForDavid.identity, claimForDavid.topic, claimForDavid.data]),
        ),
      ),
    );

    await davidIdentity
      .connect(davidWallet)
      .addClaim(claimForDavid.topic, claimForDavid.scheme, claimForDavid.issuer, claimForDavid.signature, claimForDavid.data, '');

    // 5. Check if David is verified
    const isDavidVerified = await identityRegistry.isVerified(davidWallet.address);
    expect(isDavidVerified).to.be.true;

    // 6. Mint tokens to David
    const mintAmount = ethers.utils.parseUnits('100', 0);
    await token.connect(tokenAgent).mint(davidWallet.address, mintAmount);
    expect(await token.balanceOf(davidWallet.address)).to.equal(mintAmount);

    // 7. Transfer from David to Alice (Alice is already verified in fixture)
    const transferAmount = ethers.utils.parseUnits('10', 0);
    const initialAliceBalance = await token.balanceOf(aliceWallet.address);

    await token.connect(davidWallet).transfer(aliceWallet.address, transferAmount);

    expect(await token.balanceOf(davidWallet.address)).to.equal(mintAmount.sub(transferAmount));
    expect(await token.balanceOf(aliceWallet.address)).to.equal(initialAliceBalance.add(transferAmount));
  });
});
