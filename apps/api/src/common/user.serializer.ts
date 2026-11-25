import { Privacy, Role } from '@prisma/client';

export type PublicUserDto = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
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
};

type PublicSource = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
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
};

export function toPublicUser(user: PublicSource): PublicUserDto {
  return {
    id: user.id,
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
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
  role: true,
  privacy: true,
  verifiedBadge: true,
  banned: true,
  createdAt: true,
} as const;
