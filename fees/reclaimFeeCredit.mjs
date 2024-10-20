import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { TransactionOrderFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/TransactionOrderFactory.js';
import { UnitType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';
import { waitTransactionProof } from '../waitTransactionProof.mjs';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const transactionOrderFactory = new TransactionOrderFactory(cborCodec, signingService);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
  transactionOrderFactory: transactionOrderFactory,
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const targetBillId = units.findLast((id) => id.type.toBase16() === UnitType.MONEY_PARTITION_BILL_DATA);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === UnitType.MONEY_PARTITION_FEE_CREDIT_RECORD);

if (!feeCreditRecordId) {
  throw new Error('No fee credit available');
}

/**
 * @type {Bill|null}
 */
const bill = await client.getUnit(targetBillId, false);
/**
 * @type {FeeCreditRecord|null}
 */
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false);
const round = await client.getRoundNumber();

const closeFeeCreditHash = await client.closeFeeCredit(
  {
    bill,
    feeCreditRecord,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
  },
);
const proof = await waitTransactionProof(client, closeFeeCreditHash);

const reclaimFeeCreditHash = await client.reclaimFeeCredit(
  {
    proof,
    bill,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
  },
);
console.log((await waitTransactionProof(client, reclaimFeeCreditHash))?.toString());
