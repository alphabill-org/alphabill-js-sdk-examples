import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { FungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/FungibleToken.js';
import { LockToken } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/LockToken.js';
import { UnlockToken } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnlockToken.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { TransactionStatus } from '@alphabill/alphabill-js-sdk/lib/transaction/record/TransactionStatus.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const tokenId = units.fungibleTokens.at(0);
const feeCreditRecordId = units.feeCreditRecords.at(0);
const round = (await client.getRoundInfo()).roundNumber;
let token = await client.getUnit(tokenId, false, FungibleToken);

const lockStatus = 5n;

console.log(`Locking fungible token with ID ${tokenId}`);
const lockFungibleTokenTransactionOrder = await LockToken.create({
  status: lockStatus,
  token: token,
  version: 1n,
  networkIdentifier: config.networkIdentifier,
  partitionIdentifier: config.tokenPartitionIdentifier,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory);
const lockFungibleTokenHash = await client.sendTransaction(lockFungibleTokenTransactionOrder);
const lockFungibleTokenProof = await client.waitTransactionProof(lockFungibleTokenHash, LockToken);
console.log(
  `Lock fungible token response - ${TransactionStatus[lockFungibleTokenProof.transactionRecord.serverMetadata.successIndicator]}`,
);

console.log('----------------------------------------------------------------------------------------');

token = await client.getUnit(tokenId, false, FungibleToken);

console.log(`Unlocking fungible token with ID ${tokenId}, current lock status is ${token.locked}`);
const unlockFungibleTokenTransactionOrder = await UnlockToken.create({
  token: {
    unitId: token.unitId,
    counter: token.counter,
  },
  version: 1n,
  networkIdentifier: config.networkIdentifier,
  partitionIdentifier: config.tokenPartitionIdentifier,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory);
const unlockFungibleTokenHash = await client.sendTransaction(unlockFungibleTokenTransactionOrder);
const unlockFungibleTokenProof = await client.waitTransactionProof(unlockFungibleTokenHash, UnlockToken);
console.log(
  `Unlock fungible token response - ${TransactionStatus[unlockFungibleTokenProof.transactionRecord.serverMetadata.successIndicator]}`,
);
