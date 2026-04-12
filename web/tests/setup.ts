// Global test setup for web/ tests.
// Initialises a happy-dom browser environment so DOM globals are available
// to any test file that needs them (islands, theme logic, etc.).
import { setupTestEnvironment } from './lib/test-env.ts';

setupTestEnvironment();
