import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
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
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
