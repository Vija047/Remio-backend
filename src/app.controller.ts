import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'API Root & Health Check' })
  getRoot() {
    return {
      status: 'ok',
      service: 'Routine AI API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      docs: '/api/docs',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health Check' })
  async getHealth(@Res({ passthrough: true }) res: Response) {
    let dbStatus = 'connected';
    let dbError: string | null = null;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      dbStatus = 'disconnected';
      dbError = err?.message || 'Database connection error';
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
      database: dbStatus,
      ...(dbError ? { error: dbError } : {}),
      timestamp: new Date().toISOString(),
    };
  }
}

