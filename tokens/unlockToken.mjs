import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { FungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/FungibleToken.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import {
  PayToPublicKeyHashProofFactory
} from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import {
  UnlockTokenTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnlockTokenTransactionRecordWithProof.js';
import {
  UnsignedUnlockTokenTransactionOrder
} from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedUnlockTokenTransactionOrder.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService, cborCodec);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, new CborCodecNode())
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const tokenId = units.findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([TokenPartitionUnitType.FUNGIBLE_TOKEN]))
);
const feeCreditRecordId = units.findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([TokenPartitionUnitType.FEE_CREDIT_RECORD]))
);
const round = await client.getRoundNumber();
const token = await client.getUnit(tokenId, false, FungibleToken);

const unlockFungibleTokenTransactionOrder = await UnsignedUnlockTokenTransactionOrder.create(
  {
    token: {
      unitId: token.unitId,
      counter: token.counter
    },
    networkIdentifier: NetworkIdentifier.LOCAL,
    stateLock: null,
    metadata: {
      timeout: round + 60n,
      maxTransactionFee: 5n,
      feeCreditRecordId: feeCreditRecordId,
      referenceNumber: new Uint8Array()
    },
    stateUnlock: new AlwaysTruePredicate()
  },
  cborCodec
).then((transactionOrder) => transactionOrder.sign(proofFactory, proofFactory));
const unlockFungibleTokenHash = await client.sendTransaction(unlockFungibleTokenTransactionOrder);

console.log(
  (await client.waitTransactionProof(unlockFungibleTokenHash, UnlockTokenTransactionRecordWithProof))?.toString()
);
