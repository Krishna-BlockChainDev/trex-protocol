-- CreateTable
CREATE TABLE "token_transaction" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL DEFAULT '0',
    "operatorAddress" TEXT,
    "ecosystemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_transaction_ecosystemId_idx" ON "token_transaction"("ecosystemId");

-- CreateIndex
CREATE INDEX "token_transaction_txHash_idx" ON "token_transaction"("txHash");

-- CreateIndex
CREATE INDEX "token_transaction_fromAddress_idx" ON "token_transaction"("fromAddress");

-- CreateIndex
CREATE INDEX "token_transaction_toAddress_idx" ON "token_transaction"("toAddress");

-- CreateIndex
CREATE INDEX "token_transaction_timestamp_idx" ON "token_transaction"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "token_transaction_ecosystemId_txHash_eventType_fromAddress_toAddress_key" ON "token_transaction"("ecosystemId", "txHash", "eventType", "fromAddress", "toAddress");

-- AddForeignKey
ALTER TABLE "token_transaction" ADD CONSTRAINT "token_transaction_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "token_ecosystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
