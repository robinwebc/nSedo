import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isAdminEmail } from '../common/admin-email';
import { usernameError } from '../common/username';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAuthDto, RegisterDto, VerifyOtpDto } from './dto';
import { GoogleTokenVerifier } from './google.verifier';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

const USER_ID_ATTEMPTS = 8;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly google: GoogleTokenVerifier,
    private readonly config: ConfigService,
  ) {}

  private async session(user: User) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
    });
    const refreshToken = await this.tokens.issueRefresh(user.id);
    return { userId: user.userId, accessToken, refreshToken };
  }

  private adminEmails() {
    return this.config.get<string>('ADMIN_EMAILS');
  }

  private roleForEmail(email: string | null | undefined): Role {
    return isAdminEmail(email, this.adminEmails()) ? Role.ADMIN : Role.USER;
  }

  private uniqueTargets(error: Prisma.PrismaClientKnownRequestError): string[] {
    const target = error.meta?.target;
    if (Array.isArray(target)) return target.map((item) => String(item));
    if (typeof target === 'string') return [target];
    return [];
  }

  private conflictFor(targets: string[]) {
    const joined = targets.join(' ');
    if (joined.includes('email')) {
      return new ConflictException('Email already in use');
    }
    if (joined.includes('phone')) {
      return new ConflictException('Phone already in use');
    }
    if (joined.includes('username')) {
      return new ConflictException('Username already in use');
    }
    return new ConflictException('Account already exists');
  }

  private isUserIdCollision(targets: string[]) {
    return targets.some(
      (target) => target === 'userId' || target.includes('userId'),
    );
  }

  async createWithUserId(
    data: Omit<Prisma.UserCreateInput, 'userId'>,
  ): Promise<User> {
    let lastError: unknown;
    for (let attempt = 0; attempt < USER_ID_ATTEMPTS; attempt++) {
      const userId = 'nSedo' + Math.floor(100000 + Math.random() * 900000);
      try {
        return await this.prisma.user.create({
          data: { ...data, userId },
        });
      } catch (error) {
        lastError = error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const targets = this.uniqueTargets(error);
          if (this.isUserIdCollision(targets)) continue;
          throw this.conflictFor(targets);
        }
        throw error;
      }
    }
    if (lastError instanceof Error) {
      throw new ConflictException('Could not allocate a userId. Please try again.');
    }
    throw new ConflictException('Could not allocate a userId. Please try again.');
  }

  async promoteIfAdmin(user: User): Promise<User> {
    if (user.role === Role.ADMIN) return user;
    if (!isAdminEmail(user.email, this.adminEmails())) return user;
    return this.prisma.user.update({
      where: { id: user.id },
      data: { role: Role.ADMIN },
    });
  }

  private assertActive(user: User | null): asserts user is User {
    if (!user) {
      throw new UnauthorizedException('Invalid login details');
    }
    if (user.banned) {
      throw new UnauthorizedException('Account is banned');
    }
  }

  async register(dto: RegisterDto) {
    const username = dto.username.trim().toLowerCase();
    const nameError = usernameError(username);
    if (nameError) throw new BadRequestException(nameError);
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.createWithUserId({
      username,
      displayName: dto.displayName.trim(),
      email,
      phone,
      passwordHash,
      role: this.roleForEmail(email),
    });
    return {
      userId: user.userId,
      username: user.username,
      message: 'Account created successfully',
    };
  }

  async login(identifier: string, password: string) {
    const raw = identifier.trim();
    const lowered = raw.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: lowered }, { phone: raw }, { username: lowered }],
      },
    });
    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid login details');
    }
    if (user.banned) {
      throw new UnauthorizedException('Account is banned');
    }
    const current = await this.promoteIfAdmin(user);
    const accessToken = await this.jwt.signAsync({
      sub: current.id,
      role: current.role,
    });
    const refreshToken = await this.tokens.issueRefresh(current.id);
    return { userId: current.userId, accessToken, refreshToken };
  }

  async requestOtp(
    channel: 'SMS' | 'EMAIL',
    target: string,
    purpose: 'REGISTER' | 'LOGIN',
  ) {
    return this.otp.request(channel, target, purpose);
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const target = await this.otp.consume(
      dto.channel,
      dto.target,
      dto.purpose,
      dto.code,
    );
    const existing =
      dto.channel === 'EMAIL'
        ? await this.prisma.user.findUnique({ where: { email: target } })
        : await this.prisma.user.findUnique({ where: { phone: target } });
    if (existing) {
      this.assertActive(existing);
      const data =
        dto.channel === 'EMAIL'
          ? { emailVerified: true }
          : { phoneVerified: true };
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data,
      });
      const current = await this.promoteIfAdmin(updated);
      return this.session(current);
    }
    if (!dto.username) {
      throw new BadRequestException(
        'Choose a username to open your nSedo account',
      );
    }
    const username = dto.username.trim().toLowerCase();
    const nameError = usernameError(username);
    if (nameError) throw new BadRequestException(nameError);
    const displayName = (dto.displayName ?? username).trim();
    const user = await this.createWithUserId({
      username,
      displayName,
      email: dto.channel === 'EMAIL' ? target : null,
      phone: dto.channel === 'SMS' ? target : null,
      emailVerified: dto.channel === 'EMAIL',
      phoneVerified: dto.channel === 'SMS',
      role: this.roleForEmail(dto.channel === 'EMAIL' ? target : null),
    });
    return this.session(user);
  }

  async googleSignIn(dto: GoogleAuthDto) {
    const profile = await this.google.verify(dto.idToken);
    const byGoogle = await this.prisma.user.findUnique({
      where: { googleId: profile.sub },
    });
    const byEmail =
      byGoogle ??
      (await this.prisma.user.findUnique({ where: { email: profile.email } }));
    if (byEmail) {
      this.assertActive(byEmail);
      const updated = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.sub,
          emailVerified: true,
          avatarUrl: byEmail.avatarUrl ?? profile.picture,
        },
      });
      const current = await this.promoteIfAdmin(updated);
      return this.session(current);
    }
    const username = await this.uniqueUsername(profile.email.split('@')[0]);
    const user = await this.createWithUserId({
      username,
      displayName: profile.name,
      email: profile.email,
      googleId: profile.sub,
      emailVerified: true,
      avatarUrl: profile.picture,
      role: this.roleForEmail(profile.email),
    });
    return this.session(user);
  }

  private async uniqueUsername(seed: string) {
    const cleaned = seed.toLowerCase().replace(/[^a-z0-9_]/g, '');
    let base = cleaned.slice(0, 16);
    if (base.length < 3) base = `user${base}`.slice(0, 16);
    for (let index = 0; index < 40; index++) {
      const suffix = index === 0 ? '' : String(index);
      const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
      if (usernameError(candidate)) continue;
      const taken = await this.prisma.user.findUnique({
        where: { username: candidate },
      });
      if (!taken) return candidate;
    }
    throw new ConflictException('Could not allocate a username');
  }

  async refresh(refreshToken: string) {
    const rotated = await this.tokens.rotate(refreshToken);
    const current = await this.promoteIfAdmin(rotated.user);
    const accessToken = await this.jwt.signAsync({
      sub: current.id,
      role: current.role,
    });
    const next = await this.tokens.issueRefresh(current.id, rotated.familyId);
    return { userId: current.userId, accessToken, refreshToken: next };
  }

  async logout(refreshToken: string) {
    await this.tokens.revoke(refreshToken);
    return { ok: true };
  }

  async setPassword(user: User, currentPassword: string | undefined, next: string) {
    if (user.passwordHash) {
      if (
        !currentPassword ||
        !(await bcrypt.compare(currentPassword, user.passwordHash))
      ) {
        throw new UnauthorizedException('Invalid login details');
      }
    }
    const passwordHash = await bcrypt.hash(next, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { ok: true };
  }
}
