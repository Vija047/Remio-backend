import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (existing) {
      if (existing.avatarUrl && existing.avatarUrl.includes('googleusercontent.com')) {
        throw new ConflictException(
          'This email is already registered with Google — please sign in with Google instead.',
        );
      }
      throw new ConflictException(
        'An account with this email already exists — please log in or use password reset.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createUser({
      name: dto.name.trim(),
      email: dto.email.toLowerCase(),
      passwordHash,
    });

    const accessToken = await this.signToken(user.id, user.email);
    return { accessToken, user };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.signToken(user.id, user.email);
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async googleAuth(dto: GoogleAuthDto) {
    if (!dto.idToken) {
      throw new UnauthorizedException('Google ID token is required');
    }

    let verifiedEmail: string;
    let verifiedName = dto.name?.trim();
    let verifiedPhoto = dto.photoUrl;

    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`,
      );
      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google ID token');
      }

      const payload = (await response.json()) as {
        email?: string;
        name?: string;
        picture?: string;
        email_verified?: string | boolean;
      };

      if (!payload.email) {
        throw new UnauthorizedException('Google ID token payload missing email');
      }

      verifiedEmail = payload.email.toLowerCase().trim();
      verifiedName = payload.name || verifiedName;
      verifiedPhoto = payload.picture || verifiedPhoto;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Google ID token verification failed');
    }

    let user = await this.usersService.findByEmail(verifiedEmail);

    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10) + '!Routine123';
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const name = verifiedName || verifiedEmail.split('@')[0];

      await this.usersService.createUser({
        name,
        email: verifiedEmail,
        passwordHash,
        avatarUrl: verifiedPhoto,
      });

      user = await this.usersService.findByEmail(verifiedEmail);
    }

    if (!user) {
      throw new UnauthorizedException('Could not authenticate with Google');
    }

    const accessToken = await this.signToken(user.id, user.email);
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async devLogin(email: string) {
    const allowDev = this.configService.get<string>('ALLOW_DEV_LOGIN') === 'true';
    if (!allowDev) {
      throw new UnauthorizedException('Dev login is disabled in this environment');
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10) + '!Routine123';
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const name = normalizedEmail.split('@')[0];

      await this.usersService.createUser({
        name,
        email: normalizedEmail,
        passwordHash,
      });

      user = await this.usersService.findByEmail(normalizedEmail);
    }

    if (!user) {
      throw new UnauthorizedException('Could not create dev user');
    }

    const accessToken = await this.signToken(user.id, user.email);
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private signToken(userId: string, email: string) {
    const expiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') ?? '7d';
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: expiresIn as `${number}d`,
      },
    );
  }
}
