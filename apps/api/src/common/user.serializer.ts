import { Privacy, Role } from '@prisma/client';
import { expandPublicUrl } from '../media/media.rules';

export type PublicUserDto = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  role: Role;
  privacy: Privacy;
  verifiedBadge: boolean;
  createdAt: Date;
};

export type OwnerUserDto = PublicUserDto & {
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  usernameChangedAt: Date | null;
  birthday: Date | null;
  onboardedAt: Date | null;
};

type PublicSource = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  location?: string | null;
  website?: string | null;
  role: Role;
  privacy: Privacy;
  verifiedBadge: boolean;
  createdAt: Date;
};

type OwnerSource = PublicSource & {
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  usernameChangedAt: Date | null;
  birthday?: Date | null;
  onboardedAt?: Date | null;
};

export function toPublicUser(user: PublicSource): PublicUserDto {
  return {
    id: user.id,
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: expandPublicUrl(user.avatarUrl),
    coverUrl: expandPublicUrl(user.coverUrl),
    bio: user.bio,
    location: user.location ?? null,
    website: user.website ?? null,
    role: user.role,
    privacy: user.privacy,
    verifiedBadge: user.verifiedBadge,
    createdAt: user.createdAt,
  };
}

export function toOwnerUser(user: OwnerSource): OwnerUserDto {
  return {
    ...toPublicUser(user),
    email: user.email,
    phone: user.phone,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    usernameChangedAt: user.usernameChangedAt,
    birthday: user.birthday ?? null,
    onboardedAt: user.onboardedAt ?? null,
  };
}

export const publicUserSelect = {
  id: true,
  userId: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  coverUrl: true,
  bio: true,
  location: true,
  website: true,
  role: true,
  privacy: true,
  verifiedBadge: true,
  banned: true,
  createdAt: true,
} as const;
