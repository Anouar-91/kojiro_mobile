export const DELETED_USER_NAME = 'Joueur supprimé';

export function isDeletedUser(
  user: { deletedAt?: string | null; name?: string } | null | undefined
): boolean {
  if (!user) return false;
  return Boolean(user.deletedAt) || user.name === DELETED_USER_NAME;
}
