import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';
import { UnlockFeeCredit } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnlockFeeCredit.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});

const round = await client.getRoundNumber();
const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).feeCreditRecords.at(0);
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);
console.log(feeCreditRecord.toString());

console.log('Unlocking fee credit...');
const unlockFeeCreditTransactionOrder = await UnlockFeeCredit.create({
  feeCredit: feeCreditRecord,
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory);

const unlockFeeCreditHash = await client.sendTransaction(unlockFeeCreditTransactionOrder);

console.log((await client.waitTransactionProof(unlockFeeCreditHash, UnlockFeeCredit)).toString());
