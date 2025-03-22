import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { TransferBill } from '@alphabill/alphabill-js-sdk/lib/money/transactions/TransferBill.js';
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

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.feeCreditRecords.at(0);
const billId = units.bills.at(0);
const round = (await client.getRoundInfo()).roundNumber;
const bill = await client.getUnit(billId, false, Bill);

console.log(`Transferring bill with ID ${bill.unitId}`);

// in example, transferred to self for ease of use. change here if needed.
const newOwnerPredicate = await PayToPublicKeyHashPredicate.create(signingService.publicKey);

const transferBillTransactionOrder = await TransferBill.create({
  ownerPredicate: newOwnerPredicate,
  bill: bill,
  version: 1n,
  networkIdentifier: config.networkIdentifier,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory);
const transferBillHash = await client.sendTransaction(transferBillTransactionOrder);
const transferBillProof = await client.waitTransactionProof(transferBillHash, TransferBill);
console.log(
  `Transfer bill response - ${TransactionStatus[transferBillProof.transactionRecord.serverMetadata.successIndicator]}`,
);
