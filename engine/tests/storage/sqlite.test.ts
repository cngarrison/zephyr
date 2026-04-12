import { runAdapterContractTests } from './adapter-contract.test.ts';
import { createAdapter } from '../../src/storage/providers/sqlite/index.ts';

const tmpFile = await Deno.makeTempFile({ suffix: '.db' });

await runAdapterContractTests(
  'sqlite',
  async () => {
    Deno.env.set('SQLITE_PATH', tmpFile);
    const adapter = await createAdapter();
    await adapter.init();
    return adapter;
  },
  async () => {
    await Deno.remove(tmpFile).catch(() => {});
  },
);
