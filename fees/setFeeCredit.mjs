import { SetFeeCredit } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/SetFeeCredit.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';
import { PartitionIdentifier } from '@alphabill/alphabill-js-sdk/lib/PartitionIdentifier.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl),
});
const round = await client.getRoundNumber();

console.log('Setting fee credit...');
const setFeeCreditTransactionOrder = await SetFeeCredit.create({
  targetPartitionIdentifier: PartitionIdentifier.TOKEN,
  ownerPredicate: await PayToPublicKeyHashPredicate.create(signingService.publicKey),
  amount: 100n,
  feeCreditRecord: { unitId: null, counter: null },
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory);

const setFeeCreditHash = await client.sendTransaction(setFeeCreditTransactionOrder);

console.log((await client.waitTransactionProof(setFeeCreditHash, SetFeeCredit)).toString());
