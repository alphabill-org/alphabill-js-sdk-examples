import { AddFeeCredit } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/AddFeeCredit.js';
import { TransferFeeCredit } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/TransferFeeCredit.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { PartitionIdentifier } from '@alphabill/alphabill-js-sdk/lib/PartitionIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { TransactionStatus } from '@alphabill/alphabill-js-sdk/lib/transaction/record/TransactionStatus.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const moneyClient = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});

const tokenClient = createTokenClient({
  transport: http(config.tokenPartitionUrl),
});

const billIds = (await moneyClient.getUnitsByOwnerId(signingService.publicKey)).bills;
if (billIds.length === 0) {
  throw new Error('No bills available');
}

const partitions = [
  {
    client: moneyClient,
    partitionIdentifier: PartitionIdentifier.MONEY,
  },
  {
    client: tokenClient,
    partitionIdentifier: PartitionIdentifier.TOKEN,
  },
];

for (const { client, partitionIdentifier } of partitions) {
  const bill = await moneyClient.getUnit(billIds[0], false, Bill);
  const round = (await moneyClient.getRoundInfo()).roundNumber;
  const ownerPredicate = await PayToPublicKeyHashPredicate.create(signingService.publicKey);

  const feeAmount = 100n;

  // if following variables are null, a new fee credit record is created.
  // in order to use existing fee credit record, use these variables.
  const fcrId = null;
  const fcrCounter = null;

  if (fcrId == null && fcrCounter == null) {
    console.log('Creating new fee credit record');
  } else {
    console.log(`Using fee credit record with ID ${fcrId}`);
  }

  console.log(`Transferring ${feeAmount} fee credit to partition ID ${partitionIdentifier}`);
  const transferFeeCreditTransactionOrder = await TransferFeeCredit.create({
    amount: feeAmount,
    targetPartitionIdentifier: partitionIdentifier,
    latestAdditionTime: round + 60n,
    feeCreditRecord: { ownerPredicate: ownerPredicate, unitId: fcrId, counter: fcrCounter },
    bill,
    version: 1n,
    networkIdentifier: NetworkIdentifier.LOCAL,
    stateLock: null,
    metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
    stateUnlock: new AlwaysTruePredicate(),
  }).sign(proofFactory);
  const transferFeeCreditHash = await moneyClient.sendTransaction(transferFeeCreditTransactionOrder);
  const transferFeeCreditProof = await moneyClient.waitTransactionProof(transferFeeCreditHash, TransferFeeCredit);
  console.log(
    `Transfer fee credit response - ${TransactionStatus[transferFeeCreditProof.transactionRecord.serverMetadata.successIndicator]}`,
  );
  const feeCreditRecordId = transferFeeCreditTransactionOrder.payload.attributes.targetUnitId;

  console.log('----------------------------------------------------------------------------------------');

  console.log(`Adding fee credit to partition ID ${partitionIdentifier}`);
  const addFeeCreditTransactionOrder = await AddFeeCredit.create({
    targetPartitionIdentifier: partitionIdentifier,
    ownerPredicate: ownerPredicate,
    proof: transferFeeCreditProof,
    feeCreditRecord: { unitId: feeCreditRecordId },
    version: 1n,
    networkIdentifier: NetworkIdentifier.LOCAL,
    stateLock: null,
    metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
    stateUnlock: new AlwaysTruePredicate(),
  }).sign(proofFactory);
  const addFeeCreditHash = await client.sendTransaction(addFeeCreditTransactionOrder);
  const addFeeCreditProof = await client.waitTransactionProof(addFeeCreditHash, AddFeeCredit);
  console.log(
    `Add fee credit response - ${TransactionStatus[addFeeCreditProof.transactionRecord.serverMetadata.successIndicator]}`,
  );

  console.log('----------------------------------------------------------------------------------------');
}
