import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { SwapBillsWithDustCollector } from '@alphabill/alphabill-js-sdk/lib/money/transactions/SwapBillsWithDustCollector.js';
import { TransferBillToDustCollector } from '@alphabill/alphabill-js-sdk/lib/money/transactions/TransferBillToDustCollector.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});

const round = await client.getRoundNumber();
const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.feeCreditRecords.at(0);
const billUnitIds = units.bills;
const bill = await client.getUnit(billUnitIds.at(0), false, Bill);
const targetBill = await client.getUnit(billUnitIds.at(1), false, Bill);
if (!bill || !targetBill) {
  throw new Error('No bills available');
}
console.log(bill.toString());
console.log('Target ' + targetBill.toString());

console.log('Transferring bill to dust collector...');
const transferBillToDustCollectorTransactionOrder = await TransferBillToDustCollector.create({
  bill: bill,
  targetBill: targetBill,
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory);
const transferBillToDustCollectorHash = await client.sendTransaction(transferBillToDustCollectorTransactionOrder);
const transferBillToDustCollectorProof = await client.waitTransactionProof(
  transferBillToDustCollectorHash,
  TransferBillToDustCollector,
);

console.log('Swapping bill with dust collector...');
const swapBillWithDustCollectorTransactionOrder = await SwapBillsWithDustCollector.create({
  bill: targetBill,
  proofs: [transferBillToDustCollectorProof],
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, proofFactory);
const swapBillsWithDustCollectorHash = await client.sendTransaction(swapBillWithDustCollectorTransactionOrder);

console.log((await client.waitTransactionProof(swapBillsWithDustCollectorHash, SwapBillsWithDustCollector)).toString());
