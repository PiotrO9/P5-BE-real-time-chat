export interface User {
  id: string;
  username: string;
  email: string;
  isOnline: boolean;
  lastSeen: Date | null;
  createdAt: Date;
}

export interface Friend extends User {
  friendshipCreatedAt: Date;
}

export interface FriendInviteResponse {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Date;
  sender?: User;
  receiver?: User;
}

export interface SentInvite extends FriendInviteResponse {
  receiver: User;
}

export interface ReceivedInvite extends FriendInviteResponse {
  sender: User;
}

export interface InvitesResponse {
  sentInvites: SentInvite[];
  receivedInvites: ReceivedInvite[];
  totalSent: number;
  totalReceived: number;
  totalPending: number;
}

export interface FriendshipResponse {
  requester: User;
  addressee: User;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
