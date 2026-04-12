// Runs the provider-agnostic contract tests against MockStorageAdapter.
// No real MySQL server required — this validates the contract shape and
// in-memory logic. For real MySQL integration, set MYSQL_* env vars and
// import the mysql adapter instead.
import { runAdapterContractTests } from './adapter-contract.test.ts';
import { createMockAdapter } from './mock-adapter.ts';

await runAdapterContractTests('mock-adapter', async () => {
  const adapter = createMockAdapter();
  await adapter.init();
  return adapter;
});
