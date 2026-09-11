export type PermissionContext = { userId?: string; ownerId?: string; visibility?: string; communityId?: string; isCommunityMember?: boolean; followsOwner?: boolean; isAdmin?: boolean };

export function canReadContent(ctx: PermissionContext): boolean {
  if (ctx.isAdmin) return true;
  switch (ctx.visibility) {
    case 'private':
    case 'owner': return Boolean(ctx.userId && ctx.ownerId && ctx.userId === ctx.ownerId);
    case 'followers': return Boolean(ctx.userId && ctx.followsOwner);
    case 'community': return Boolean(ctx.userId && ctx.isCommunityMember);
    case 'authenticated': return Boolean(ctx.userId);
    case 'public':
    case '':
    case undefined: return true;
    default: return false;
  }
}

export function filterAuthorizedContent<T extends { visibility?: string; authorId?: string; communityId?: string }>(items: T[], ctx: PermissionContext): T[] {
  return items.filter(item => canReadContent({ ...ctx, visibility: item.visibility, ownerId: item.authorId, communityId: item.communityId }));
}
