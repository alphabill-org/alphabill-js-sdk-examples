import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});

const billIds = (await client.getUnitsByOwnerId(signingService.publicKey)).bills;
if (billIds.length > 0) {
  const bill = await client.getUnit(billIds.at(0), true, Bill);
  console.log(bill.toString());
} else {
  console.log('No bills available');
}
