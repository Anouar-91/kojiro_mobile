import { create } from 'zustand';

import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendIds,
  fetchFriendRequests,
  getFriendshipState,
  sendFriendRequest,
} from '@/services/friends';
import { createNotification } from '@/services/notifications';
import { FriendRequest } from '@/types';

interface FriendState {
  friendIds: string[];
  requests: FriendRequest[];
  isLoading: boolean;
  fetchFriends: (userId: string) => Promise<void>;
  sendRequest: (fromUserId: string, toUserId: string, fromUserName: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  isFriend: (userId: string) => boolean;
  getState: (userId: string, otherUserId: string) => ReturnType<typeof getFriendshipState>;
  getIncomingRequests: (userId: string) => FriendRequest[];
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friendIds: [],
  requests: [],
  isLoading: false,

  fetchFriends: async (userId) => {
    set({ isLoading: true });
    try {
      const [friendIds, requests] = await Promise.all([
        fetchFriendIds(userId),
        fetchFriendRequests(userId),
      ]);
      set({ friendIds, requests, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  sendRequest: async (fromUserId, toUserId, fromUserName) => {
    await sendFriendRequest(fromUserId, toUserId);

    try {
      await createNotification(toUserId, {
        type: 'friend_request',
        title: 'Demande d\'ami',
        body: `${fromUserName} souhaite t\'ajouter en ami`,
        data: { fromUserId },
      });
    } catch {
      // optionnel
    }

    await get().fetchFriends(fromUserId);
  },

  acceptRequest: async (requestId) => {
    const request = get().requests.find((r) => r.id === requestId);
    await acceptFriendRequest(requestId);
    if (request) {
      await get().fetchFriends(request.toUserId);
    }
  },

  declineRequest: async (requestId) => {
    const request = get().requests.find((r) => r.id === requestId);
    await declineFriendRequest(requestId);
    if (request) {
      await get().fetchFriends(request.toUserId);
    }
  },

  isFriend: (userId) => get().friendIds.includes(userId),

  getState: (userId, otherUserId) => getFriendshipState(userId, otherUserId, get().requests),

  getIncomingRequests: (userId) =>
    get().requests.filter((r) => r.toUserId === userId && r.status === 'pending'),
}));
