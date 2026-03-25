/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billing from "../billing.js";
import type * as billingActions from "../billingActions.js";
import type * as comments from "../comments.js";
import type * as designs from "../designs.js";
import type * as government from "../government.js";
import type * as governmentActions from "../governmentActions.js";
import type * as governmentShared from "../governmentShared.js";
import type * as hotspots from "../hotspots.js";
import type * as http from "../http.js";
import type * as organizations from "../organizations.js";
import type * as reports from "../reports.js";
import type * as reviewThreads from "../reviewThreads.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  billing: typeof billing;
  billingActions: typeof billingActions;
  comments: typeof comments;
  designs: typeof designs;
  government: typeof government;
  governmentActions: typeof governmentActions;
  governmentShared: typeof governmentShared;
  hotspots: typeof hotspots;
  http: typeof http;
  organizations: typeof organizations;
  reports: typeof reports;
  reviewThreads: typeof reviewThreads;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
