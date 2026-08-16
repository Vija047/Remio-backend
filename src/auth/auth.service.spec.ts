import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    findById: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('token'),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('secret'),
    get: jest.fn().mockReturnValue('7d'),
  };

  const service = new AuthService(
    usersService as unknown as UsersService,
    jwtService as unknown as JwtService,
    configService as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a new user and returns a JWT', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.createUser.mockResolvedValue({
      id: 'u1',
      name: 'Alex',
      email: 'alex@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register({
      name: 'Alex',
      email: 'alex@example.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('token');
    expect(result.user.email).toBe('alex@example.com');
    expect(usersService.createUser).toHaveBeenCalled();
  });

  it('rejects duplicate email registration', async () => {
    usersService.findByEmail.mockResolvedValue({ id: 'u1' });
    await expect(
      service.register({
        name: 'Alex',
        email: 'alex@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      name: 'Alex',
      email: 'alex@example.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.login({
      email: 'alex@example.com',
      password: 'password123',
    });
    expect(result.accessToken).toBe('token');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid login password', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'alex@example.com',
      passwordHash,
    });
    await expect(
      service.login({ email: 'alex@example.com', password: 'wrongpass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
