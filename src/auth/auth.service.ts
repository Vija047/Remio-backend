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
      throw new ConflictException('Email already registered');
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
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async googleAuth(dto: GoogleAuthDto) {
    const email = dto.email.toLowerCase().trim();
    let user = await this.usersService.findByEmail(email);

    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10) + '!Routine123';
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const name = dto.name?.trim() || email.split('@')[0];

      const created = await this.usersService.createUser({
        name,
        email,
        passwordHash,
      });

      user = await this.usersService.findByEmail(email);
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
