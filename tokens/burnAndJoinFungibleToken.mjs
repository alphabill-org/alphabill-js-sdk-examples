import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { UnitId } from '@alphabill/alphabill-js-sdk/lib/UnitId.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { FungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/FungibleToken.js';
import {
  SplitFungibleTokenTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/SplitFungibleTokenTransactionRecordWithProof.js';
import {
  BurnFungibleTokenTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/BurnFungibleTokenTransactionRecordWithProof.js';
import {
  JoinFungibleTokenTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/JoinFungibleTokenTransactionRecordWithProof.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.FEE_CREDIT_RECORD);
const unitId = units.findLast((id) => id.type.toBase16() === TokenPartitionUnitType.FUNGIBLE_TOKEN);
const round = await client.getRoundNumber();
const token = await client.getUnit(unitId, false, FungibleToken);
const ownerPredicate = await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey)

// 1. split the fungible token
console.log("Original token's value before split: " + token.value);
const splitTransactionHash = await client.splitFungibleToken(
  {
    token,
    ownerPredicate: ownerPredicate,
    amount: 1n,
    nonce: null,
    type: { unitId: token.tokenType },
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);

// 1b. wait for transaction to finalize
const splitBillProof = await client.waitTransactionProof(splitTransactionHash, SplitFungibleTokenTransactionRecordWithProof);

// 2. find the token that was split
const splitTokenId = splitBillProof.transactionRecord.serverMetadata.targetUnits
  .map((bytes) => UnitId.fromBytes(bytes))
  .find(
    (id) =>
      id.type.toBase16() === TokenPartitionUnitType.FUNGIBLE_TOKEN &&
      Base16Converter.encode(id.bytes) !== Base16Converter.encode(token.unitId.bytes),
  );

const splitToken = await client.getUnit(splitTokenId, false, FungibleToken);
console.log('Split token ID: ' + Base16Converter.encode(splitTokenId.bytes));
console.log('Split token value: ' + splitToken?.value);

// 3. check that the original tokens value has been reduced
const originalTokenAfterSplit = await client.getUnit(unitId, false, FungibleToken);
console.log("Original token's value after split: " + originalTokenAfterSplit.value);

// 4. burn the split token using original fungible token as target
const burnTransactionHash = await client.burnFungibleToken(
  {
    token: splitToken,
    targetToken: originalTokenAfterSplit,
    type: { unitId: splitToken.tokenType },
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
const transactionRecordWithProof = await client.waitTransactionProof(burnTransactionHash, BurnFungibleTokenTransactionRecordWithProof);

// 5. join the split token back into the original fungible token
const joinTransactionHash = await client.joinFungibleTokens(
  {
    proofs: [transactionRecordWithProof],
    token: originalTokenAfterSplit,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);

// 5b. wait for transaction to finalize
await client.waitTransactionProof(joinTransactionHash, JoinFungibleTokenTransactionRecordWithProof);

// 6. check that the original tokens value has been increased
const originalTokenAfterJoin = await client.getUnit(unitId, false, FungibleToken);
console.log("Original token's value after join: " + originalTokenAfterJoin?.value);
