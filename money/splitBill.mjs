import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { SplitBill } from '@alphabill/alphabill-js-sdk/lib/money/transactions/SplitBill.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { TransactionStatus } from '@alphabill/alphabill-js-sdk/lib/transaction/record/TransactionStatus.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);
const ownerPredicate = await PayToPublicKeyHashPredicate.create(signingService.publicKey);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.feeCreditRecords.at(0);
const billId = units.bills.at(0);
const round = (await client.getRoundInfo()).roundNumber;
const bill = await client.getUnit(billId, false, Bill);

console.log(`Splitting bill with ID ${bill.unitId}`);

// in example, new bill's owner is same for ease of use. change here if needed.
const newOwnerPredicate = ownerPredicate;
const splitBill1 = { value: 2n, ownerPredicate: newOwnerPredicate };
const splitBill2 = { value: 1n, ownerPredicate: newOwnerPredicate };
const splits = [splitBill1, splitBill2];

const splitBillTransactionOrder = await SplitBill.create({
  splits: splits,
  bill: bill,
  version: 1n,
  networkIdentifier: config.networkIdentifier,
  partitionIdentifier: config.moneyPartitionIdentifier,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory);
const splitBillHash = await client.sendTransaction(splitBillTransactionOrder);
const splitBillProof = await client.waitTransactionProof(splitBillHash, SplitBill);
console.log(
  `Split bill response - ${TransactionStatus[splitBillProof.transactionRecord.serverMetadata.successIndicator]}`,
);
