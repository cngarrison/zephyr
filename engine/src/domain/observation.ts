// engine/src/domain/observation.ts
// Re-exports from the canonical shared package.
// All engine code that needs Observation should import from here (not directly from @zephyr/shared)
// so that import paths within the engine package remain consistent.
export type { Observation } from '@zephyr/shared';
