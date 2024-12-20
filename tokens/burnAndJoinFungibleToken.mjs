import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { FungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/FungibleToken.js';
import { BurnFungibleTokenTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/BurnFungibleTokenTransactionRecordWithProof.js';
import { JoinFungibleTokenTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/JoinFungibleTokenTransactionRecordWithProof.js';
import { SplitFungibleTokenTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/SplitFungibleTokenTransactionRecordWithProof.js';
import { UnsignedBurnFungibleTokenTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedBurnFungibleTokenTransactionOrder.js';
import { UnsignedJoinFungibleTokenTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedJoinFungibleTokenTransactionOrder.js';
import { UnsignedSplitFungibleTokenTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedSplitFungibleTokenTransactionOrder.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { AlwaysTrueProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/AlwaysTrueProofFactory.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { UnitId } from '@alphabill/alphabill-js-sdk/lib/UnitId.js';
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

// 1. split the fungible token
console.log("Original token's value before split: " + token.value);
const splitFungibleTokenTransactionOrder = await UnsignedSplitFungibleTokenTransactionOrder.create({
  token: token,
  ownerPredicate: await PayToPublicKeyHashPredicate.create(signingService.publicKey),
  amount: 1n,
  type: { unitId: token.typeId },
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory, [alwaysTrueProofFactory]);
const splitFungibleTokenHash = await client.sendTransaction(splitFungibleTokenTransactionOrder);

// 1b. wait for transaction to finalize
const splitFungibleTokenProof = await client.waitTransactionProof(
  splitFungibleTokenHash,
  SplitFungibleTokenTransactionRecordWithProof,
);

// 2. find the token that was split
console.log(splitFungibleTokenProof.transactionRecord.serverMetadata.targetUnitIds);
const splitTokenId = splitFungibleTokenProof.transactionRecord.serverMetadata.targetUnitIds.find(
  (id) => !UnitId.equals(id, token.unitId),
);

const splitToken = await client.getUnit(splitTokenId, false, FungibleToken);
console.log('Split token ID: ' + Base16Converter.encode(splitTokenId.bytes));
console.log('Split token value: ' + splitToken.value);

// 3. check that the original tokens value has been reduced
const originalTokenAfterSplit = await client.getUnit(tokenId, false, FungibleToken);
console.log("Original token's value after split: " + originalTokenAfterSplit.value);

// 4. burn the split token using original fungible token as target
const burnFungibleTokenTransactionOrder = await UnsignedBurnFungibleTokenTransactionOrder.create({
  type: { unitId: splitToken.typeId },
  token: splitToken,
  targetToken: originalTokenAfterSplit,
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory, [alwaysTrueProofFactory]);
const burnFungibleTokenHash = await client.sendTransaction(burnFungibleTokenTransactionOrder);
const burnFungibleTokenProof = await client.waitTransactionProof(
  burnFungibleTokenHash,
  BurnFungibleTokenTransactionRecordWithProof,
);

// 5. join the split token back into the original fungible token
const joinFungibleTokenTransactionOrder = await UnsignedJoinFungibleTokenTransactionOrder.create({
  token: originalTokenAfterSplit,
  proofs: [burnFungibleTokenProof],
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory, [alwaysTrueProofFactory]);
const joinFungibleTokenHash = await client.sendTransaction(joinFungibleTokenTransactionOrder);

// 5b. wait for transaction to finalize
await client.waitTransactionProof(joinFungibleTokenHash, JoinFungibleTokenTransactionRecordWithProof);

// 6. check that the original tokens value has been increased
const originalTokenAfterJoin = await client.getUnit(tokenId, false, FungibleToken);
console.log("Original token's value after join: " + originalTokenAfterJoin.value);
