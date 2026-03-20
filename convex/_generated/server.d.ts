/* eslint-disable */
/**
 * Generated stub — run `npx convex dev` to regenerate.
 */

import type { DataModel } from './dataModel.js';
import type {
  GenericQueryCtx,
  GenericMutationCtx,
  GenericActionCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
  QueryBuilder,
  MutationBuilder,
  ActionBuilder,
  HttpActionBuilder,
} from 'convex/server';

export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;

export type DatabaseReader = GenericDatabaseReader<DataModel>;
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;

export declare const query: QueryBuilder<DataModel, 'public'>;
export declare const internalQuery: QueryBuilder<DataModel, 'internal'>;
export declare const mutation: MutationBuilder<DataModel, 'public'>;
export declare const internalMutation: MutationBuilder<DataModel, 'internal'>;
export declare const action: ActionBuilder<DataModel, 'public'>;
export declare const internalAction: ActionBuilder<DataModel, 'internal'>;
export declare const httpAction: HttpActionBuilder;
