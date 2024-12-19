import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import config from '../config.js';

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});
console.log(await client.getRoundNumber());
