import { ethers, network } from 'hardhat';
import OnchainID from '@onchain-id/solidity';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with the account:', deployer.address);
  console.log(`Target network: ${network.name}`);

  const outputPath = path.join(__dirname, '../deployed-addresses.json');
  let existingData: Record<string, unknown> = {};

  if (fs.existsSync(outputPath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch (e) {
      console.warn('Could not read existing deployed-addresses.json, creating a new one.');
    }
  }

  // Initialize or retrieve existing addresses for this network
  const deployedAddresses: Record<string, Record<string, string>> = (existingData[network.name] as Record<string, Record<string, string>>) || {
    implementations: {},
    authorities: {},
    proxies: {},
    factories: {},
    compliance: {},
    token: {},
  };

  // Ensure sub-objects exist
  deployedAddresses.implementations = deployedAddresses.implementations || {};
  deployedAddresses.authorities = deployedAddresses.authorities || {};
  deployedAddresses.proxies = deployedAddresses.proxies || {};
  deployedAddresses.factories = deployedAddresses.factories || {};
  deployedAddresses.compliance = deployedAddresses.compliance || {};
  deployedAddresses.token = deployedAddresses.token || {};

  // Helper to save state immediately after each deployment
  const saveAddresses = () => {
    existingData[network.name] = deployedAddresses;
    fs.writeFileSync(outputPath, JSON.stringify(existingData, null, 2));
  };

  try {
    // ---------------------------------------------------------
    // 1. DEPLOY IMPLEMENTATIONS
    // ---------------------------------------------------------
    console.log('\n--- 1. DEPLOY IMPLEMENTATIONS ---');

    let claimTopicsRegistryImplementation;
    if (deployedAddresses.implementations.claimTopicsRegistry) {
      console.log(`Reusing ClaimTopicsRegistry implementation at ${deployedAddresses.implementations.claimTopicsRegistry}`);
      claimTopicsRegistryImplementation = await ethers.getContractAt('ClaimTopicsRegistry', deployedAddresses.implementations.claimTopicsRegistry);
    } else {
      claimTopicsRegistryImplementation = await ethers.deployContract('ClaimTopicsRegistry', deployer);
      await claimTopicsRegistryImplementation.deployed();
      deployedAddresses.implementations.claimTopicsRegistry = claimTopicsRegistryImplementation.address;
      saveAddresses();
    }

    let trustedIssuersRegistryImplementation;
    if (deployedAddresses.implementations.trustedIssuersRegistry) {
      console.log(`Reusing TrustedIssuersRegistry implementation at ${deployedAddresses.implementations.trustedIssuersRegistry}`);
      trustedIssuersRegistryImplementation = await ethers.getContractAt(
        'TrustedIssuersRegistry',
        deployedAddresses.implementations.trustedIssuersRegistry,
      );
    } else {
      trustedIssuersRegistryImplementation = await ethers.deployContract('TrustedIssuersRegistry', deployer);
      await trustedIssuersRegistryImplementation.deployed();
      deployedAddresses.implementations.trustedIssuersRegistry = trustedIssuersRegistryImplementation.address;
      saveAddresses();
    }

    let identityRegistryStorageImplementation;
    if (deployedAddresses.implementations.identityRegistryStorage) {
      console.log(`Reusing IdentityRegistryStorage implementation at ${deployedAddresses.implementations.identityRegistryStorage}`);
      identityRegistryStorageImplementation = await ethers.getContractAt(
        'IdentityRegistryStorage',
        deployedAddresses.implementations.identityRegistryStorage,
      );
    } else {
      identityRegistryStorageImplementation = await ethers.deployContract('IdentityRegistryStorage', deployer);
      await identityRegistryStorageImplementation.deployed();
      deployedAddresses.implementations.identityRegistryStorage = identityRegistryStorageImplementation.address;
      saveAddresses();
    }

    let identityRegistryImplementation;
    if (deployedAddresses.implementations.identityRegistry) {
      console.log(`Reusing IdentityRegistry implementation at ${deployedAddresses.implementations.identityRegistry}`);
      identityRegistryImplementation = await ethers.getContractAt('IdentityRegistry', deployedAddresses.implementations.identityRegistry);
    } else {
      identityRegistryImplementation = await ethers.deployContract('IdentityRegistry', deployer);
      await identityRegistryImplementation.deployed();
      deployedAddresses.implementations.identityRegistry = identityRegistryImplementation.address;
      saveAddresses();
    }

    let modularComplianceImplementation;
    if (deployedAddresses.implementations.modularCompliance) {
      console.log(`Reusing ModularCompliance implementation at ${deployedAddresses.implementations.modularCompliance}`);
      modularComplianceImplementation = await ethers.getContractAt('ModularCompliance', deployedAddresses.implementations.modularCompliance);
    } else {
      modularComplianceImplementation = await ethers.deployContract('ModularCompliance', deployer);
      await modularComplianceImplementation.deployed();
      deployedAddresses.implementations.modularCompliance = modularComplianceImplementation.address;
      saveAddresses();
    }

    let tokenImplementation;
    if (deployedAddresses.implementations.token) {
      console.log(`Reusing Token implementation at ${deployedAddresses.implementations.token}`);
      tokenImplementation = await ethers.getContractAt('Token', deployedAddresses.implementations.token);
    } else {
      tokenImplementation = await ethers.deployContract('Token', deployer);
      await tokenImplementation.deployed();
      deployedAddresses.implementations.token = tokenImplementation.address;
      saveAddresses();
    }

    console.log('\nDeploying OnchainID implementations...');
    let identityImplementation;
    if (deployedAddresses.implementations.onchainIDIdentity) {
      console.log(`Reusing OnchainID Identity implementation at ${deployedAddresses.implementations.onchainIDIdentity}`);
      identityImplementation = await ethers.getContractAt(OnchainID.contracts.Identity.abi, deployedAddresses.implementations.onchainIDIdentity);
    } else {
      identityImplementation = await new ethers.ContractFactory(
        OnchainID.contracts.Identity.abi,
        OnchainID.contracts.Identity.bytecode,
        deployer,
      ).deploy(deployer.address, true);
      await identityImplementation.deployed();
      deployedAddresses.implementations.onchainIDIdentity = identityImplementation.address;
      saveAddresses();
    }

    let identityImplementationAuthority;
    if (deployedAddresses.implementations.onchainIDImplementationAuthority) {
      console.log(`Reusing OnchainID Implementation Authority at ${deployedAddresses.implementations.onchainIDImplementationAuthority}`);
      identityImplementationAuthority = await ethers.getContractAt(
        OnchainID.contracts.ImplementationAuthority.abi,
        deployedAddresses.implementations.onchainIDImplementationAuthority,
      );
    } else {
      identityImplementationAuthority = await new ethers.ContractFactory(
        OnchainID.contracts.ImplementationAuthority.abi,
        OnchainID.contracts.ImplementationAuthority.bytecode,
        deployer,
      ).deploy(identityImplementation.address);
      await identityImplementationAuthority.deployed();
      deployedAddresses.implementations.onchainIDImplementationAuthority = identityImplementationAuthority.address;
      saveAddresses();
    }

    let identityFactory;
    if (deployedAddresses.implementations.onchainIDFactory) {
      console.log(`Reusing OnchainID Factory at ${deployedAddresses.implementations.onchainIDFactory}`);
      identityFactory = await ethers.getContractAt(OnchainID.contracts.Factory.abi, deployedAddresses.implementations.onchainIDFactory);
    } else {
      identityFactory = await new ethers.ContractFactory(OnchainID.contracts.Factory.abi, OnchainID.contracts.Factory.bytecode, deployer).deploy(
        identityImplementationAuthority.address,
      );
      await identityFactory.deployed();
      deployedAddresses.implementations.onchainIDFactory = identityFactory.address;
      saveAddresses();
    }

    console.log('All implementations are ready.');

    // ---------------------------------------------------------
    // 2. DEPLOY & CONFIGURE TREX IMPLEMENTATION AUTHORITY
    // ---------------------------------------------------------
    console.log('\n--- 2. DEPLOY TREX IMPLEMENTATION AUTHORITY ---');
    let trexImplementationAuthority;
    if (deployedAddresses.authorities.trexImplementationAuthority) {
      console.log(`Reusing TREXImplementationAuthority at ${deployedAddresses.authorities.trexImplementationAuthority}`);
      trexImplementationAuthority = await ethers.getContractAt(
        'TREXImplementationAuthority',
        deployedAddresses.authorities.trexImplementationAuthority,
      );
    } else {
      trexImplementationAuthority = await ethers.deployContract(
        'TREXImplementationAuthority',
        [true, ethers.constants.AddressZero, ethers.constants.AddressZero],
        deployer,
      );
      await trexImplementationAuthority.deployed();
      deployedAddresses.authorities.trexImplementationAuthority = trexImplementationAuthority.address;
      saveAddresses();
      console.log(`TREXImplementationAuthority deployed at: ${trexImplementationAuthority.address}`);

      const versionStruct = { major: 4, minor: 0, patch: 0 };
      const contractsStruct = {
        tokenImplementation: tokenImplementation.address,
        ctrImplementation: claimTopicsRegistryImplementation.address,
        irImplementation: identityRegistryImplementation.address,
        irsImplementation: identityRegistryStorageImplementation.address,
        tirImplementation: trustedIssuersRegistryImplementation.address,
        mcImplementation: modularComplianceImplementation.address,
      };

      console.log('Adding and using new TREX version...');
      const addVersionTx = await trexImplementationAuthority.connect(deployer).addAndUseTREXVersion(versionStruct, contractsStruct);
      await addVersionTx.wait();
      console.log('TREX version set.');
    }

    // ---------------------------------------------------------
    // 3. DEPLOY PROXIES & FACTORY
    // ---------------------------------------------------------
    console.log('\n--- 3. DEPLOY PROXIES & FACTORY ---');
    let claimTopicsRegistry;
    if (deployedAddresses.proxies.claimTopicsRegistry) {
      console.log(`Reusing ClaimTopicsRegistry Proxy at ${deployedAddresses.proxies.claimTopicsRegistry}`);
      claimTopicsRegistry = await ethers.getContractAt('ClaimTopicsRegistry', deployedAddresses.proxies.claimTopicsRegistry);
    } else {
      const proxy = await ethers.deployContract('ClaimTopicsRegistryProxy', [trexImplementationAuthority.address], deployer);
      await proxy.deployed();
      claimTopicsRegistry = await ethers.getContractAt('ClaimTopicsRegistry', proxy.address);
      deployedAddresses.proxies.claimTopicsRegistry = proxy.address;
      saveAddresses();
      console.log(`ClaimTopicsRegistryProxy deployed at: ${claimTopicsRegistry.address}`);
    }

    let trustedIssuersRegistry;
    if (deployedAddresses.proxies.trustedIssuersRegistry) {
      console.log(`Reusing TrustedIssuersRegistry Proxy at ${deployedAddresses.proxies.trustedIssuersRegistry}`);
      trustedIssuersRegistry = await ethers.getContractAt('TrustedIssuersRegistry', deployedAddresses.proxies.trustedIssuersRegistry);
    } else {
      const proxy = await ethers.deployContract('TrustedIssuersRegistryProxy', [trexImplementationAuthority.address], deployer);
      await proxy.deployed();
      trustedIssuersRegistry = await ethers.getContractAt('TrustedIssuersRegistry', proxy.address);
      deployedAddresses.proxies.trustedIssuersRegistry = proxy.address;
      saveAddresses();
      console.log(`TrustedIssuersRegistryProxy deployed at: ${trustedIssuersRegistry.address}`);
    }

    let identityRegistryStorage;
    if (deployedAddresses.proxies.identityRegistryStorage) {
      console.log(`Reusing IdentityRegistryStorage Proxy at ${deployedAddresses.proxies.identityRegistryStorage}`);
      identityRegistryStorage = await ethers.getContractAt('IdentityRegistryStorage', deployedAddresses.proxies.identityRegistryStorage);
    } else {
      const proxy = await ethers.deployContract('IdentityRegistryStorageProxy', [trexImplementationAuthority.address], deployer);
      await proxy.deployed();
      identityRegistryStorage = await ethers.getContractAt('IdentityRegistryStorage', proxy.address);
      deployedAddresses.proxies.identityRegistryStorage = proxy.address;
      saveAddresses();
      console.log(`IdentityRegistryStorageProxy deployed at: ${identityRegistryStorage.address}`);
    }

    let identityRegistry;
    if (deployedAddresses.proxies.identityRegistry) {
      console.log(`Reusing IdentityRegistry Proxy at ${deployedAddresses.proxies.identityRegistry}`);
      identityRegistry = await ethers.getContractAt('IdentityRegistry', deployedAddresses.proxies.identityRegistry);
    } else {
      const proxy = await ethers.deployContract(
        'IdentityRegistryProxy',
        [trexImplementationAuthority.address, trustedIssuersRegistry.address, claimTopicsRegistry.address, identityRegistryStorage.address],
        deployer,
      );
      await proxy.deployed();
      identityRegistry = await ethers.getContractAt('IdentityRegistry', proxy.address);
      deployedAddresses.proxies.identityRegistry = proxy.address;
      saveAddresses();
      console.log(`IdentityRegistryProxy deployed at: ${identityRegistry.address}`);
    }

    let trexFactory;
    if (deployedAddresses.factories.trexFactory) {
      console.log(`Reusing TREXFactory at ${deployedAddresses.factories.trexFactory}`);
      trexFactory = await ethers.getContractAt('TREXFactory', deployedAddresses.factories.trexFactory);
    } else {
      trexFactory = await ethers.deployContract('TREXFactory', [trexImplementationAuthority.address, identityFactory.address], deployer);
      await trexFactory.deployed();
      // Use unknown casting to avoid any warnings
      const factoryWithSigner = identityFactory.connect(deployer) as unknown as { addTokenFactory(_address: string): Promise<unknown> };
      await factoryWithSigner.addTokenFactory(trexFactory.address);
      deployedAddresses.factories.trexFactory = trexFactory.address;
      saveAddresses();
      console.log(`TREXFactory deployed at: ${trexFactory.address}`);
    }

    // ---------------------------------------------------------
    // 4. DEPLOY MODULAR COMPLIANCE PROXY
    // ---------------------------------------------------------
    console.log('\n--- 4. DEPLOY MODULAR COMPLIANCE PROXY ---');

    let modularCompliance;
    if (deployedAddresses.compliance.modularComplianceProxy) {
      console.log(`Reusing ModularComplianceProxy at ${deployedAddresses.compliance.modularComplianceProxy}`);
      modularCompliance = await ethers.getContractAt('ModularCompliance', deployedAddresses.compliance.modularComplianceProxy);
    } else {
      // ModularComplianceProxy constructor takes the TREXImplementationAuthority address
      // and automatically calls init() via delegatecall during construction.
      const modularComplianceProxy = await ethers.deployContract('ModularComplianceProxy', [trexImplementationAuthority.address], deployer);
      await modularComplianceProxy.deployed();
      // Interact with the proxy through the ModularCompliance ABI
      modularCompliance = await ethers.getContractAt('ModularCompliance', modularComplianceProxy.address);
      deployedAddresses.compliance.modularComplianceProxy = modularComplianceProxy.address;
      saveAddresses();
      console.log(`ModularComplianceProxy deployed at: ${modularComplianceProxy.address}`);
      console.log(`  Implementation authority: ${trexImplementationAuthority.address}`);
      console.log(`  Owner: ${deployer.address}`);
    }

    // ---------------------------------------------------------
    // 5. DEPLOY TOKEN
    // ---------------------------------------------------------
    console.log('\n--- 5. DEPLOY TOKEN ---');
    const tokenName = 'My TREX Token';
    const tokenSymbol = 'TREX';
    const tokenDecimals = 18;

    let tokenOID;
    if (deployedAddresses.token.tokenOID) {
      console.log(`Reusing Token OnchainID at ${deployedAddresses.token.tokenOID}`);
      tokenOID = await ethers.getContractAt(OnchainID.contracts.IdentityProxy.abi, deployedAddresses.token.tokenOID);
    } else {
      tokenOID = await new ethers.ContractFactory(OnchainID.contracts.IdentityProxy.abi, OnchainID.contracts.IdentityProxy.bytecode, deployer).deploy(
        identityImplementationAuthority.address,
        deployer.address, // Management key for the token's ID
      );
      await tokenOID.deployed();
      deployedAddresses.token.tokenOID = tokenOID.address;
      saveAddresses();
      console.log(`Token OnchainID deployed at: ${tokenOID.address}`);
    }

    let token;
    if (deployedAddresses.token.trexTokenProxy) {
      console.log(`Reusing TREX Token Proxy at ${deployedAddresses.token.trexTokenProxy}`);
      token = await ethers.getContractAt('Token', deployedAddresses.token.trexTokenProxy);
    } else {
      const tokenProxy = await ethers.deployContract(
        'TokenProxy',
        [
          trexImplementationAuthority.address,
          identityRegistry.address,
          modularCompliance.address, // ← uses ModularComplianceProxy (not DefaultCompliance)
          tokenName,
          tokenSymbol,
          tokenDecimals,
          tokenOID.address,
        ],
        deployer,
      );
      await tokenProxy.deployed();
      deployedAddresses.token.trexTokenProxy = tokenProxy.address;
      saveAddresses();
      token = await ethers.getContractAt('Token', tokenProxy.address);
      console.log(`TREX Token deployed at: ${token.address}`);
    }

    // ---------------------------------------------------------
    // 6. DEPLOY CLAIM ISSUER
    // ---------------------------------------------------------
    console.log('\n--- 6. DEPLOY CLAIM ISSUER ---');
    let claimIssuerContract;
    if (deployedAddresses.token.claimIssuer) {
      console.log(`Reusing ClaimIssuer at ${deployedAddresses.token.claimIssuer}`);
      claimIssuerContract = await ethers.getContractAt('ClaimIssuer', deployedAddresses.token.claimIssuer);
    } else {
      claimIssuerContract = await ethers.deployContract('ClaimIssuer', [deployer.address], deployer);
      await claimIssuerContract.deployed();

      const claimIssuerSigningKey = deployedAddresses.address;
      // const claimIssuerSigningKey = ethers.Wallet.createRandom();
      // console.log('Private Key:', claimIssuerSigningKey.privateKey);

      // Mnemonic phrase (12 words) — only exists on createRandom() wallets
      // console.log('Mnemonic:   ', claimIssuerSigningKey.mnemonic.phrase);
      // Address (public)
      // console.log('Address:    ', claimIssuerSigningKey.address);

      // Match the frontend's static signing key. This is the address derived from ISSUER_PRIVATE_KEY
      // const claimIssuerSigningKey = '0xB5D24F6EbdAe0a2B0D11FA8f9c76178500CD7d2C';

      await claimIssuerContract
        .connect(deployer)
        .addKey(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address'], [claimIssuerSigningKey])), 3, 1);

      deployedAddresses.token.claimIssuer = claimIssuerContract.address;
      saveAddresses();
      console.log(`ClaimIssuer deployed at: ${claimIssuerContract.address}`);
    }

    // ---------------------------------------------------------
    // 7. POST-DEPLOYMENT CONFIGURATION
    // ---------------------------------------------------------
    // All steps are idempotent — safe to re-run on an existing deployment.
    console.log('\n--- 7. POST-DEPLOYMENT CONFIGURATION ---');

    // ── 7.1  Bind IdentityRegistryStorage → IdentityRegistry ──────────────
    // Required before any identity can be registered or tokens transferred.
    // try {
    //   await identityRegistryStorage.connect(deployer).bindIdentityRegistry(identityRegistry.address);
    //   console.log('✓ [7.1] IdentityRegistryStorage bound to IdentityRegistry.');
    // } catch (e: unknown) {
    //   const msg: string = e instanceof Error ? e.message : String(e);
    //   if (msg.includes('already bound') || msg.includes('storage already bound')) {
    //     console.log('  [7.1] IdentityRegistryStorage already bound — skipping.');
    //   } else {
    //     console.error('✗ [7.1] bindIdentityRegistry failed:', e);
    //     throw e;
    //   }
    // }

    // // ── 7.2  Add claim topic to ClaimTopicsRegistry ────────────────────────
    // // Tokens can only be transferred if the holder has a verified claim of
    // // a topic that is registered here.
    // const claimTopics = [ethers.utils.id('CLAIM_TOPIC')];
    // try {
    //   await claimTopicsRegistry.connect(deployer).addClaimTopic(claimTopics[0]);
    //   console.log(`✓ [7.2] Claim topic added: ${claimTopics[0]}`);
    // } catch (e: unknown) {
    //   const msg: string = e instanceof Error ? e.message : String(e);
    //   if (msg.includes('Claim topic already exists') || msg.includes('already exists')) {
    //     console.log('  [7.2] Claim topic already registered — skipping.');
    //   } else {
    //     console.error('✗ [7.2] addClaimTopic failed:', e);
    //     throw e;
    //   }
    // }

    // // ── 7.3  Register ClaimIssuer in TrustedIssuersRegistry ───────────────
    // // Without this step no claim issued by claimIssuerContract is trusted,
    // // meaning no investor identity will pass verification.
    // try {
    //   await trustedIssuersRegistry.connect(deployer).addTrustedIssuer(claimIssuerContract.address, claimTopics);
    //   console.log(`✓ [7.3] ClaimIssuer ${claimIssuerContract.address} added to TrustedIssuersRegistry.`);
    // } catch (e: unknown) {
    //   const msg: string = e instanceof Error ? e.message : String(e);
    //   if (msg.includes('already') || msg.includes('trusted issuer')) {
    //     console.log('  [7.3] ClaimIssuer already trusted — skipping.');
    //   } else {
    //     console.error('✗ [7.3] addTrustedIssuer failed:', e);
    //     throw e;
    //   }
    // }

    // // ── 7.4  Add deployer as IdentityRegistry agent ────────────────────────
    // // Agents can register/remove investor identities.
    // try {
    //   const isDeployerIRAgent = await identityRegistry.isAgent(deployer.address);
    //   if (!isDeployerIRAgent) {
    //     await identityRegistry.connect(deployer).addAgent(deployer.address);
    //     console.log(`✓ [7.4] Deployer ${deployer.address} added as IdentityRegistry agent.`);
    //   } else {
    //     console.log('  [7.4] Deployer already an IdentityRegistry agent — skipping.');
    //   }
    // } catch (e) {
    //   console.error('✗ [7.4] addAgent (deployer → IdentityRegistry) failed:', e);
    //   throw e;
    // }

    // // ── 7.5  Add token contract as IdentityRegistry agent ─────────────────
    // // The token itself needs agent rights so it can call registerIdentity
    // // during forced transfers / recovery flows.
    // try {
    //   const isTokenIRAgent = await identityRegistry.isAgent(token.address);
    //   if (!isTokenIRAgent) {
    //     await identityRegistry.connect(deployer).addAgent(token.address);
    //     console.log(`✓ [7.5] Token ${token.address} added as IdentityRegistry agent.`);
    //   } else {
    //     console.log('  [7.5] Token already an IdentityRegistry agent — skipping.');
    //   }
    // } catch (e) {
    //   console.error('✗ [7.5] addAgent (token → IdentityRegistry) failed:', e);
    //   throw e;
    // }

    // // ── 7.6  Add deployer as Token agent ──────────────────────────────────
    // // Token agents can mint, burn, freeze and force-transfer tokens.
    // try {
    //   const isTokenAgent = await token.isAgent(deployer.address);
    //   if (!isTokenAgent) {
    //     await token.connect(deployer).addAgent(deployer.address);
    //     console.log(`✓ [7.6] Deployer ${deployer.address} added as Token agent.`);
    //   } else {
    //     console.log('  [7.6] Deployer already a Token agent — skipping.');
    //   }
    // } catch (e) {
    //   console.error('✗ [7.6] addAgent (deployer → Token) failed:', e);
    //   throw e;
    // }

    // // ── 7.7  Unpause token ─────────────────────────────────────────────────
    // // Tokens are deployed in paused state; transfers are blocked until unpaused.
    // try {
    //   const isPaused = await token.paused();
    //   if (isPaused) {
    //     await token.connect(deployer).unpause();
    //     console.log('✓ [7.7] Token unpaused — transfers are now enabled.');
    //   } else {
    //     console.log('  [7.7] Token already unpaused — skipping.');
    //   }
    // } catch (e) {
    //   console.error('✗ [7.7] unpause failed:', e);
    //   throw e;
    // }

    console.log('\n✅ Deployment successful!');
    console.log('------------------------------------------');
    console.log('TREX Token Address:              ', token.address);
    console.log('Identity Registry Address:       ', identityRegistry.address);
    console.log('TREX Factory Address:            ', trexFactory.address);
    console.log('ModularCompliance Proxy Address: ', modularCompliance.address);
    console.log('------------------------------------------');
  } catch (error) {
    console.error('\nDeployment failed with error:');
    console.error(error);
  } finally {
    // Final save just to be safe
    saveAddresses();
    console.log(`\nAddresses saved to ${outputPath} under network: '${network.name}'`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
