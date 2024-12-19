import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { FungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/FungibleToken.js';
import { TransferFungibleTokenTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/TransferFungibleTokenTransactionRecordWithProof.js';
import { UnsignedTransferFungibleTokenTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedTransferFungibleTokenTransactionOrder.js';
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
const tokenId = units.fungibleTokens.at(0);
const feeCreditRecordId = units.feeCreditRecords.at(0);
const round = await client.getRoundNumber();
const token = await client.getUnit(tokenId, false, FungibleToken);
if (token === null) {
  throw new Error('Token does not exist');
}

const transferFungibleTokenTransactionOrder = await UnsignedTransferFungibleTokenTransactionOrder.create({
  token: token,
  ownerPredicate: await PayToPublicKeyHashPredicate.create(signingService.publicKey),
  type: { unitId: token.typeId },
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory, [alwaysTrueProofFactory]);

const transferFungibleTokenHash = await client.sendTransaction(transferFungibleTokenTransactionOrder);

console.log(
  (
    await client.waitTransactionProof(transferFungibleTokenHash, TransferFungibleTokenTransactionRecordWithProof)
  ).toString(),
);
