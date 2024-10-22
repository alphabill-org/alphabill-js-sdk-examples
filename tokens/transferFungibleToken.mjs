import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { FungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/FungibleToken.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { TransferFungibleTokenTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/TransferFungibleTokenTransactionRecordWithProof.js';
import { UnsignedTransferFungibleTokenTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedTransferFungibleTokenTransactionOrder.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { AlwaysTrueProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/AlwaysTrueProofFactory.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService, cborCodec);
const alwaysTrueProofFactory = new AlwaysTrueProofFactory(cborCodec);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const tokenId = units.findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([TokenPartitionUnitType.FUNGIBLE_TOKEN])),
);
const feeCreditRecordId = units.findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([TokenPartitionUnitType.FEE_CREDIT_RECORD])),
);
const round = await client.getRoundNumber();
const token = await client.getUnit(tokenId, false, FungibleToken);
if (token === null) {
  throw new Error('Token does not exist');
}

const transferFungibleTokenTransactionOrder = await UnsignedTransferFungibleTokenTransactionOrder.create(
  {
    token: token,
    ownerPredicate: await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey),
    type: { unitId: token.tokenType },
    networkIdentifier: NetworkIdentifier.LOCAL,
    stateLock: null,
    metadata: {
      timeout: round + 60n,
      maxTransactionFee: 5n,
      feeCreditRecordId: feeCreditRecordId,
      referenceNumber: new Uint8Array(),
    },
    stateUnlock: new AlwaysTruePredicate(),
  },
  cborCodec,
).then((transactionOrder) => transactionOrder.sign(proofFactory, proofFactory, [alwaysTrueProofFactory]));

const transferFungibleTokenHash = await client.sendTransaction(transferFungibleTokenTransactionOrder);

console.log(
  (
    await client.waitTransactionProof(transferFungibleTokenHash, TransferFungibleTokenTransactionRecordWithProof)
  )?.toString(),
);
