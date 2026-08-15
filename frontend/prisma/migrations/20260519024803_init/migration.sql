-- CreateTable
CREATE TABLE "token_ecosystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "deployerAddress" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL,
    "addresses" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_ecosystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "identityAddress" TEXT NOT NULL,
    "countryCode" INTEGER NOT NULL DEFAULT 0,
    "claimTopics" INTEGER[],
    "ecosystemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_rule" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "params" JSONB NOT NULL,
    "ecosystemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_ecosystem_chainId_idx" ON "token_ecosystem"("chainId");

-- CreateIndex
CREATE INDEX "token_ecosystem_deployerAddress_idx" ON "token_ecosystem"("deployerAddress");

-- CreateIndex
CREATE UNIQUE INDEX "token_ecosystem_chainId_symbol_deployerAddress_key" ON "token_ecosystem"("chainId", "symbol", "deployerAddress");

-- CreateIndex
CREATE INDEX "identity_ecosystemId_idx" ON "identity"("ecosystemId");

-- CreateIndex
CREATE INDEX "identity_walletAddress_idx" ON "identity"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "identity_ecosystemId_walletAddress_key" ON "identity"("ecosystemId", "walletAddress");

-- CreateIndex
CREATE INDEX "compliance_rule_ecosystemId_idx" ON "compliance_rule"("ecosystemId");

-- CreateIndex
CREATE INDEX "compliance_rule_module_idx" ON "compliance_rule"("module");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_rule_ecosystemId_module_key" ON "compliance_rule"("ecosystemId", "module");

-- AddForeignKey
ALTER TABLE "identity" ADD CONSTRAINT "identity_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "token_ecosystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_rule" ADD CONSTRAINT "compliance_rule_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "token_ecosystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
