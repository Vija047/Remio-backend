import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
        subscription: true,
      },
    });
  }

  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
  }) {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        settings: {
          create: {},
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
      },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
        subscription: true,
      },
    });
  }

  async updateSettings(userId: string, data: UpdateSettingsDto) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        notificationsEnabled: data.notificationsEnabled ?? true,
        darkMode: data.darkMode ?? false,
        smartPredictionsEnabled: data.smartPredictionsEnabled ?? true,
        timezone: data.timezone ?? 'UTC',
      },
      update: {
        ...(data.notificationsEnabled !== undefined
          ? { notificationsEnabled: data.notificationsEnabled }
          : {}),
        ...(data.darkMode !== undefined ? { darkMode: data.darkMode } : {}),
        ...(data.smartPredictionsEnabled !== undefined
          ? { smartPredictionsEnabled: data.smartPredictionsEnabled }
          : {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
      },
    });

    return settings;
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Account deleted successfully' };
  }
}
