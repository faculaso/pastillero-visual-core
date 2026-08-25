import type { Migration } from '../migration-runner';
import { MIGRATION_001_INITIAL_SCHEMA_SQL } from './001-initial-schema.migration';
import { MIGRATION_002_ANMAT_CATALOG_FIELDS_SQL } from './002-anmat-catalog-fields.migration';
import { MIGRATION_003_CAPSULE_BICOLOR_SHAPE_SQL } from './003-capsule-bicolor-shape.migration';

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: '001_initial_schema', sql: MIGRATION_001_INITIAL_SCHEMA_SQL },
  { version: 2, name: '002_anmat_catalog_fields', sql: MIGRATION_002_ANMAT_CATALOG_FIELDS_SQL },
  { version: 3, name: '003_capsule_bicolor_shape', sql: MIGRATION_003_CAPSULE_BICOLOR_SHAPE_SQL },
];
