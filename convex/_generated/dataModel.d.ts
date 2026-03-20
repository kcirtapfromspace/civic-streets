/* eslint-disable */
/**
 * Generated stub — run `npx convex dev` to regenerate.
 */

import type { DataModelFromSchemaDefinition } from 'convex/server';
import type schema from '../schema.js';

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

import type { GenericId } from 'convex/values';
export type Id<TableName extends string> = GenericId<TableName>;

import type { DocumentByName } from 'convex/server';
export type Doc<TableName extends keyof DataModel> = DocumentByName<DataModel, TableName>;
