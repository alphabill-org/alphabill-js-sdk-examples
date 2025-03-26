import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';
import { LockFeeCredit } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/LockFeeCredit.js';
import { UnlockFeeCredit } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnlockFeeCredit.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { TransactionStatus } from '@alphabill/alphabill-js-sdk/lib/transaction/record/TransactionStatus.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});
const round = (await client.getRoundInfo()).roundNumber;
const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).feeCreditRecords.at(0);
let feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);

// anything other than 0n means locked
const lockStatus = 5n;

console.log(`Locking fee credit with ID ${feeCreditRecordId}`);
const lockFeeCreditTransactionOrder = await LockFeeCredit.create({
  status: lockStatus,
  feeCredit: feeCreditRecord,
  version: 1n,
  networkIdentifier: config.networkIdentifier,
  partitionIdentifier: config.moneyPartitionIdentifier,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory);
const lockFeeCreditHash = await client.sendTransaction(lockFeeCreditTransactionOrder);
const lockFeeCreditProof = await client.waitTransactionProof(lockFeeCreditHash, LockFeeCredit);
console.log(
  `Locking fee credit response - ${TransactionStatus[lockFeeCreditProof.transactionRecord.serverMetadata.successIndicator]}`,
);

console.log('----------------------------------------------------------------------------------------');

feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);

console.log(`Unlocking fee credit with ID ${feeCreditRecordId}, current lock status is ${feeCreditRecord.locked}`);
const unlockFeeCreditTransactionOrder = await UnlockFeeCredit.create({
  feeCredit: feeCreditRecord,
  version: 1n,
  networkIdentifier: config.networkIdentifier,
  partitionIdentifier: config.moneyPartitionIdentifier,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory);
const unlockFeeCreditHash = await client.sendTransaction(unlockFeeCreditTransactionOrder);
const unlockFeeCreditProof = await client.waitTransactionProof(unlockFeeCreditHash, UnlockFeeCredit);
console.log(
  `Unlocking fee credit response - ${TransactionStatus[unlockFeeCreditProof.transactionRecord.serverMetadata.successIndicator]}`,
);
