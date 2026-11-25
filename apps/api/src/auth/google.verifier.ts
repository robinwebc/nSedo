import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

@Injectable()
export class GoogleTokenVerifier {
  private client: OAuth2Client | null = null;

  constructor(private readonly config: ConfigService) {}

  async verify(idToken: string): Promise<GoogleProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }
    this.client ??= new OAuth2Client(clientId);
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google token');
      }
      if (payload.email_verified === false) {
        throw new UnauthorizedException('Google email is not verified');
      }
      return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        name: (payload.name ?? payload.email.split('@')[0]).slice(0, 50),
        picture: payload.picture,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Google token');
    }
  }
}
