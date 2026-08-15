-- AlterTable
ALTER TABLE "chain_infrastructure" ALTER COLUMN "implToken" DROP DEFAULT,
ALTER COLUMN "implIdentityRegistry" DROP DEFAULT,
ALTER COLUMN "implIdentityRegistryStorage" DROP DEFAULT,
ALTER COLUMN "implTrustedIssuersRegistry" DROP DEFAULT,
ALTER COLUMN "implClaimTopicsRegistry" DROP DEFAULT,
ALTER COLUMN "implModularCompliance" DROP DEFAULT,
ALTER COLUMN "implOIDIdentity" DROP DEFAULT,
ALTER COLUMN "oidImplementationAuthority" DROP DEFAULT,
ALTER COLUMN "oidIdFactory" DROP DEFAULT,
ALTER COLUMN "trexImplementationAuthority" DROP DEFAULT,
ALTER COLUMN "trexFactory" DROP DEFAULT,
ALTER COLUMN "deployedBy" DROP DEFAULT,
ALTER COLUMN "deployedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "token_ecosystem" ALTER COLUMN "salt" DROP DEFAULT,
ALTER COLUMN "tokenProxy" DROP DEFAULT,
ALTER COLUMN "identityRegistryProxy" DROP DEFAULT,
ALTER COLUMN "identityRegistryStorageProxy" DROP DEFAULT,
ALTER COLUMN "trustedIssuersRegistryProxy" DROP DEFAULT,
ALTER COLUMN "claimTopicsRegistryProxy" DROP DEFAULT,
ALTER COLUMN "modularComplianceProxy" DROP DEFAULT,
ALTER COLUMN "tokenOnchainID" DROP DEFAULT,
ALTER COLUMN "claimIssuer" DROP DEFAULT;
