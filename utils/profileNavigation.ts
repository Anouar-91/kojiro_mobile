import { Router } from 'expo-router';

import { User } from '@/types';
import { isDeletedUser } from '@/utils/deletedUser';

export function openUserProfile(
  router: Router,
  userId: string,
  user?: Pick<User, 'deletedAt' | 'name'> | null
) {
  if (user && isDeletedUser(user)) return;
  router.push({ pathname: '/profile/[id]', params: { id: userId } });
}

export function canOpenUserProfile(user?: Pick<User, 'deletedAt' | 'name'> | null): boolean {
  return Boolean(user) && !isDeletedUser(user);
}
