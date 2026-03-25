import { v } from 'convex/values';
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { ensureUser } from './users';

type OrganizationRole = 'owner' | 'admin' | 'member' | 'billing_admin';
type OrganizationType =
  | 'individual'
  | 'town'
  | 'city'
  | 'transit_agency'
  | 'consultancy'
  | 'advocacy';
type PopulationBand =
  | 'individual'
  | 'under_50k'
  | '50k_to_500k'
  | 'over_500k_or_regional';
type ProcurementState =
  | 'none'
  | 'pilot'
  | 'security_review'
  | 'contracting'
  | 'active';
type InvoiceMode = 'self_serve' | 'annual_invoice' | 'purchase_order';
type MembershipSelection = {
  organization: Doc<'organizations'>;
  membership: Doc<'organizationMembers'>;
};

const CONTRACT_TIER_PRIORITY: Record<string, number> = {
  civic_free: 0,
  town_essential: 1,
  city_standard: 2,
  agency_enterprise: 3,
};

const MEMBERSHIP_ROLE_PRIORITY: Record<OrganizationRole, number> = {
  owner: 3,
  billing_admin: 2,
  admin: 2,
  member: 1,
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function listMembershipsByUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
) {
  return await ctx.db
    .query('organizationMembers')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(32);
}

function compareSelections(
  a: MembershipSelection,
  b: MembershipSelection,
) {
  const sharedOrgDiff =
    Number(b.organization.organizationType !== 'individual') -
    Number(a.organization.organizationType !== 'individual');
  if (sharedOrgDiff !== 0) return sharedOrgDiff;

  const contractTierDiff =
    (CONTRACT_TIER_PRIORITY[b.organization.contractTier] ?? 0) -
    (CONTRACT_TIER_PRIORITY[a.organization.contractTier] ?? 0);
  if (contractTierDiff !== 0) return contractTierDiff;

  const roleDiff =
    (MEMBERSHIP_ROLE_PRIORITY[b.membership.role as OrganizationRole] ?? 0) -
    (MEMBERSHIP_ROLE_PRIORITY[a.membership.role as OrganizationRole] ?? 0);
  if (roleDiff !== 0) return roleDiff;

  const orgUpdatedDiff = b.organization.updatedAt - a.organization.updatedAt;
  if (orgUpdatedDiff !== 0) return orgUpdatedDiff;

  const membershipUpdatedDiff = b.membership.updatedAt - a.membership.updatedAt;
  if (membershipUpdatedDiff !== 0) return membershipUpdatedDiff;

  return String(a.organization._id).localeCompare(String(b.organization._id));
}

export async function getDefaultOrganizationContext(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<MembershipSelection | null> {
  const memberships = await listMembershipsByUser(ctx, userId);
  if (memberships.length === 0) {
    return null;
  }

  const selections: MembershipSelection[] = [];
  for (const membership of memberships) {
    const organization = await ctx.db.get(membership.organizationId);
    if (organization) {
      selections.push({
        organization,
        membership,
      });
    }
  }

  if (selections.length === 0) {
    return null;
  }

  selections.sort(compareSelections);
  return selections[0] ?? null;
}

async function findDefaultWorkspace(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
) {
  const workspaces = await ctx.db
    .query('workspaces')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .take(8);

  return (
    workspaces.find((workspace) => workspace.isDefault) ??
    workspaces[0] ??
    null
  );
}

function defaultOrganizationName(user: Doc<'users'>): string {
  if (user.email) {
    const localPart = user.email.split('@')[0]?.trim();
    if (localPart) {
      return `${localPart.replace(/[._-]+/g, ' ')} civic team`;
    }
  }
  return `${user.displayName} civic studio`;
}

async function createDefaultWorkspace(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
) {
  const now = Date.now();
  const workspaceId = await ctx.db.insert('workspaces', {
    organizationId,
    name: 'Shared Workspace',
    slug: 'shared-workspace',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });

  return await ctx.db.get(workspaceId);
}

export async function ensureOrganizationForUser(
  ctx: MutationCtx,
  user: Doc<'users'>,
) {
  const existingContext = await getDefaultOrganizationContext(ctx, user._id);
  if (existingContext) {
    const workspace =
      (await findDefaultWorkspace(ctx, existingContext.organization._id)) ??
      (await createDefaultWorkspace(ctx, existingContext.organization._id));

    return {
      organization: existingContext.organization,
      membership: existingContext.membership,
      workspace,
    };
  }

  const now = Date.now();
  const name = defaultOrganizationName(user);
  const slug = `${slugify(name)}-${String(user._id).slice(-6)}`;
  const organizationId = await ctx.db.insert('organizations', {
    ownerUserId: user._id,
    name,
    slug,
    organizationType: 'individual',
    populationBand: 'individual',
    contractTier: 'civic_free',
    procurementState: 'none',
    invoiceMode: 'self_serve',
    createdAt: now,
    updatedAt: now,
  });

  const membershipId = await ctx.db.insert('organizationMembers', {
    organizationId,
    userId: user._id,
    role: 'owner',
    createdAt: now,
    updatedAt: now,
  });

  const organization = await ctx.db.get(organizationId);
  const membership = await ctx.db.get(membershipId);
  const workspace = await createDefaultWorkspace(ctx, organizationId);

  if (!organization || !membership || !workspace) {
    throw new Error('Unable to provision organization defaults');
  }

  return {
    organization,
    membership,
    workspace,
  };
}

async function requireOrganizationRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
  allowedRoles: OrganizationRole[],
) {
  const membership = await ctx.db
    .query('organizationMembers')
    .withIndex('by_org_user', (q) =>
      q.eq('organizationId', organizationId).eq('userId', userId),
    )
    .unique();

  if (!membership || !allowedRoles.includes(membership.role as OrganizationRole)) {
    throw new Error('Not authorized for this organization');
  }

  return membership;
}

function buildContextPayload(args: {
  organization: Doc<'organizations'>;
  membership: Doc<'organizationMembers'>;
  workspace: Doc<'workspaces'> | null;
}) {
  return {
    organizationId: args.organization._id,
    workspaceId: args.workspace?._id ?? null,
    name: args.organization.name,
    slug: args.organization.slug,
    organizationType: args.organization.organizationType,
    jurisdictionName: args.organization.jurisdictionName ?? null,
    populationBand: args.organization.populationBand,
    contractTier: args.organization.contractTier,
    procurementState: args.organization.procurementState,
    invoiceMode: args.organization.invoiceMode,
    purchaseOrderNumber: args.organization.purchaseOrderNumber ?? null,
    contractRenewalDate: args.organization.contractRenewalDate ?? null,
    memberRole: args.membership.role,
    workspaceName: args.workspace?.name ?? null,
  };
}

export const bootstrapCurrentOrganization = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);
    const context = await ensureOrganizationForUser(ctx, user);

    return buildContextPayload(context);
  },
});

export const getCurrentOrganizationContext = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_session', (q) => q.eq('sessionToken', args.sessionToken))
      .unique();
    if (!user) {
      return null;
    }

    const organizationContext = await getDefaultOrganizationContext(ctx, user._id);
    if (!organizationContext) {
      return null;
    }

    const workspace = await findDefaultWorkspace(
      ctx,
      organizationContext.organization._id,
    );
    return buildContextPayload({
      organization: organizationContext.organization,
      membership: organizationContext.membership,
      workspace,
    });
  },
});

export const updateCurrentOrganizationProfile = mutation({
  args: {
    sessionToken: v.string(),
    name: v.optional(v.string()),
    organizationType: v.optional(
      v.union(
        v.literal('individual'),
        v.literal('town'),
        v.literal('city'),
        v.literal('transit_agency'),
        v.literal('consultancy'),
        v.literal('advocacy'),
      ),
    ),
    jurisdictionName: v.optional(v.string()),
    populationBand: v.optional(
      v.union(
        v.literal('individual'),
        v.literal('under_50k'),
        v.literal('50k_to_500k'),
        v.literal('over_500k_or_regional'),
      ),
    ),
    procurementState: v.optional(
      v.union(
        v.literal('none'),
        v.literal('pilot'),
        v.literal('security_review'),
        v.literal('contracting'),
        v.literal('active'),
      ),
    ),
    invoiceMode: v.optional(
      v.union(
        v.literal('self_serve'),
        v.literal('annual_invoice'),
        v.literal('purchase_order'),
      ),
    ),
    purchaseOrderNumber: v.optional(v.string()),
    contractRenewalDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.sessionToken);
    const context = await ensureOrganizationForUser(ctx, user);
    await requireOrganizationRole(ctx, context.organization._id, user._id, [
      'owner',
      'admin',
      'billing_admin',
    ]);

    const updates: Partial<Doc<'organizations'>> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name.trim() || context.organization.name;
      updates.slug = `${slugify(updates.name)}-${String(context.organization._id).slice(-6)}`;
    }
    if (args.organizationType !== undefined) {
      updates.organizationType = args.organizationType as OrganizationType;
    }
    if (args.jurisdictionName !== undefined) {
      updates.jurisdictionName = args.jurisdictionName.trim() || undefined;
    }
    if (args.populationBand !== undefined) {
      updates.populationBand = args.populationBand as PopulationBand;
    }
    if (args.procurementState !== undefined) {
      updates.procurementState = args.procurementState as ProcurementState;
    }
    if (args.invoiceMode !== undefined) {
      updates.invoiceMode = args.invoiceMode as InvoiceMode;
    }
    if (args.purchaseOrderNumber !== undefined) {
      updates.purchaseOrderNumber = args.purchaseOrderNumber.trim() || undefined;
    }
    if (args.contractRenewalDate !== undefined) {
      updates.contractRenewalDate = args.contractRenewalDate;
    }

    await ctx.db.patch(context.organization._id, updates);
    const updatedOrganization = await ctx.db.get(context.organization._id);
    if (!updatedOrganization) {
      throw new Error('Unable to reload organization');
    }

    return buildContextPayload({
      organization: updatedOrganization,
      membership: context.membership,
      workspace: context.workspace,
    });
  },
});

export const logAuditEvent = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    workspaceId: v.optional(v.id('workspaces')),
    projectId: v.optional(v.id('projects')),
    actorUserId: v.optional(v.id('users')),
    eventType: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert('auditEvents', {
      organizationId: args.organizationId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      actorUserId: args.actorUserId,
      eventType: args.eventType,
      entityType: args.entityType,
      entityId: args.entityId,
      metadataJson: args.metadataJson,
      createdAt: Date.now(),
    });

    return await ctx.db.get(eventId);
  },
});
