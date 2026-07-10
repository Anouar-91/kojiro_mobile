import { Router } from 'expo-router';

export function openUserProfile(router: Router, userId: string) {
  router.push({ pathname: '/profile/[id]', params: { id: userId } });
}
