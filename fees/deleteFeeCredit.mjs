import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';
import { DeleteFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/DeleteFeeCreditTransactionRecordWithProof.js';
import { UnsignedDeleteFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedDeleteFeeCreditTransactionOrder.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl),
});
const round = await client.getRoundNumber();
const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).feeCreditRecords.at(0);
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);

console.log('Deleting fee credit...');
const deleteFeeCreditTransactionOrder = await UnsignedDeleteFeeCreditTransactionOrder.create({
  feeCredit: { unitId: feeCreditRecordId, counter: feeCreditRecord.counter },
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory);

const deleteFeeCreditHash = await client.sendTransaction(deleteFeeCreditTransactionOrder);

console.log(
  (await client.waitTransactionProof(deleteFeeCreditHash, DeleteFeeCreditTransactionRecordWithProof)).toString(),
);
