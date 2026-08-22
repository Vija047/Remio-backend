import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Sign in or sign up with Google' })
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }

  @Post('dev-login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Dev-only login bypass (gated by ALLOW_DEV_LOGIN env var)' })
  devLogin(@Body() dto: { email: string }) {
    return this.authService.devLogin(dto.email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user account' })
  deleteMe(@CurrentUser() user: AuthUser) {
    return this.usersService.deleteAccount(user.id);
  }
}
