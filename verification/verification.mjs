import { TransferFeeCredit } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/TransferFeeCredit.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { PartitionIdentifier } from '@alphabill/alphabill-js-sdk/lib/PartitionIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { DefaultVerificationPolicy } from '@alphabill/alphabill-js-sdk/lib/transaction/verification/DefaultVerificationPolicy.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});

const billIds = (await client.getUnitsByOwnerId(signingService.publicKey)).bills;
const bill = await client.getUnit(billIds[0], false, Bill);
const round = (await client.getRoundInfo()).roundNumber;

const transferFeeCreditTransactionOrder = await TransferFeeCredit.create({
  amount: 10n,
  targetPartitionIdentifier: PartitionIdentifier.MONEY,
  latestAdditionTime: round + 60n,
  feeCreditRecord: { ownerPredicate: await PayToPublicKeyHashPredicate.create(signingService.publicKey) },
  bill,
  version: 1n,
  networkIdentifier: config.networkIdentifier,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, null, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory);
const transferFeeCreditHash = await client.sendTransaction(transferFeeCreditTransactionOrder);
const transferFeeCreditProof = await client.waitTransactionProof(transferFeeCreditHash, TransferFeeCredit);

const context = {
  proof: transferFeeCreditProof,
  trustBase: await client.getTrustBase(round),
};

const result = await new DefaultVerificationPolicy().verify(context);
console.log(result.toString());
