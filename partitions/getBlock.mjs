import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl),
});
const round = (await client.getRoundInfo()).roundNumber - 1n;
console.log(Base16Converter.encode(await client.getBlock(round)));
