import crypto from 'crypto';
import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { NonFungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/NonFungibleToken.js';
import { NonFungibleTokenData } from '@alphabill/alphabill-js-sdk/lib/tokens/NonFungibleTokenData.js';
import { UnsignedUpdateNonFungibleTokenTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedUpdateNonFungibleTokenTransactionOrder.js';
import { UpdateNonFungibleTokenTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UpdateNonFungibleTokenTransactionRecordWithProof.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
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
const tokenId = units.nonFungibleTokens.at(0);
const feeCreditRecordId = units.feeCreditRecords.at(0);
const round = await client.getRoundNumber();
const token = await client.getUnit(tokenId, false, NonFungibleToken);

const updateNonFungibleTokenTransactionOrder = await UnsignedUpdateNonFungibleTokenTransactionOrder.create(
  {
    token: token,
    data: await NonFungibleTokenData.create(cborCodec, [crypto.getRandomValues(new Uint8Array(32))]),
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
).sign(alwaysTrueProofFactory, proofFactory, [alwaysTrueProofFactory]);
const updateNonFungibleTokenHash = await client.sendTransaction(updateNonFungibleTokenTransactionOrder);

console.log(
  (
    await client.waitTransactionProof(updateNonFungibleTokenHash, UpdateNonFungibleTokenTransactionRecordWithProof)
  )?.toString(),
);
