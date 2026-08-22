import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as { message?: string | string[] }).message ??
            exception.message);

      response.status(status).json({
        statusCode: status,
        message: Array.isArray(message) ? message.join(', ') : message,
        error: exception.name,
      });
      return;
    }

    const err = exception as Error;
    const isProduction = process.env.NODE_ENV === 'production';
    const logDetails = err?.stack || String(exception);

    this.logger.error(`Unhandled Exception: ${err?.message || String(exception)}`, logDetails);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProduction
        ? 'Internal server error'
        : err?.message || 'Internal server error',
      error: 'InternalServerError',
    });
  }
}
