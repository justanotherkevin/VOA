// Barrel re-export — keeps `@/main/store` as the single import path while the
// implementation is split across `store/` by concern (schema, migrations,
// meetings CRUD, preferences, dismissed keys, legacy compat). See
// `main/CLAUDE.md` for the module map.

export * from './store/schema';
export * from './store/instance';
export * from './store/migrations';
export * from './store/meetings';
export * from './store/preferences';
export * from './store/dismissed-meetings';
export * from './store/legacy';
