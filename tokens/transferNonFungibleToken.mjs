import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { NonFungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/NonFungibleToken.js';
import { TransferNonFungibleTokenTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/TransferNonFungibleTokenTransactionRecordWithProof.js';
import { UnsignedTransferNonFungibletokenTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedTransferNonFungibletokenTransactionOrder.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { AlwaysTrueProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/AlwaysTrueProofFactory.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);
const alwaysTrueProofFactory = new AlwaysTrueProofFactory();

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const tokenId = units.nonFungibleTokens.at(0);
const feeCreditRecordId = units.feeCreditRecords.at(0);
const round = await client.getRoundNumber();
const token = await client.getUnit(tokenId, false, NonFungibleToken);
if (token === null) {
  throw new Error('Token does not exist');
}

const transferNonFungibleTokenTransactionOrder = await UnsignedTransferNonFungibletokenTransactionOrder.create({
  token: token,
  counter: token.counter,
  ownerPredicate: await PayToPublicKeyHashPredicate.create(signingService.publicKey),
  nonce: null,
  type: { unitId: token.typeId },
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory, [alwaysTrueProofFactory]);
const transferNonFungibleTokenHash = await client.sendTransaction(transferNonFungibleTokenTransactionOrder);

console.log(
  (
    await client.waitTransactionProof(transferNonFungibleTokenHash, TransferNonFungibleTokenTransactionRecordWithProof)
  ).toString(),
);
