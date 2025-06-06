import { SetFeeCredit } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/SetFeeCredit.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { TransactionStatus } from '@alphabill/alphabill-js-sdk/lib/transaction/record/TransactionStatus.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createTokenClient({
  transport: http(config.permissionedTokenPartitionUrl),
});
const round = (await client.getRoundInfo()).roundNumber;

const feeCreditAmount = 100n;
const feeCreditOwnerPredicate = await PayToPublicKeyHashPredicate.create(signingService.publicKey);
const partitionIdentifier = config.permissionedTokenPartitionIdentifier;

// if following variables are null, a new fee credit record is created.
// in order to use existing fee credit record, use these variables.
const fcrId = null;
const fcrCounter = null;

if (fcrId == null && fcrCounter == null) {
  console.log('Creating new fee credit record');
} else {
  console.log(`Using fee credit record with ID ${fcrId}`);
}

console.log(`Setting ${feeCreditAmount} fee credit to partition ID ${partitionIdentifier}`);
const setFeeCreditTransactionOrder = await SetFeeCredit.create({
  targetPartitionIdentifier: partitionIdentifier,
  ownerPredicate: feeCreditOwnerPredicate,
  amount: feeCreditAmount,
  feeCreditRecord: { unitId: fcrId, counter: fcrCounter },
  version: 1n,
  networkIdentifier: config.networkIdentifier,
  partitionIdentifier: partitionIdentifier,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory);
const setFeeCreditHash = await client.sendTransaction(setFeeCreditTransactionOrder);
const setFeeCreditProof = await client.waitTransactionProof(setFeeCreditHash, SetFeeCredit);
console.log(
  `Set fee credit response - ${TransactionStatus[setFeeCreditProof.transactionRecord.serverMetadata.successIndicator]}`,
);
