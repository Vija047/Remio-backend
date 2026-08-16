import { BadGatewayException } from '@nestjs/common';
import { AiService, ParsedTaskResponse } from './ai.service';

describe('AiService JSON validation', () => {
  const service = Object.create(AiService.prototype) as AiService;

  it('parses valid AI task JSON', () => {
    const raw = JSON.stringify({
      title: 'Change water filter',
      category: 'home',
      description: null,
      recurrenceType: 'fixed',
      intervalDays: 90,
      reminderEnabled: true,
    });

    const result = service.parseAndValidateAiJson(ParsedTaskResponse, raw);
    expect(result.title).toBe('Change water filter');
    expect(result.intervalDays).toBe(90);
  });

  it('rejects invalid AI JSON', () => {
    expect(() =>
      service.parseAndValidateAiJson(ParsedTaskResponse, 'not-json'),
    ).toThrow(BadGatewayException);
  });

  it('rejects AI JSON with invalid shape', () => {
    const raw = JSON.stringify({
      title: 'x',
      category: 'home',
      description: null,
      recurrenceType: 'weekly',
      intervalDays: 7,
      reminderEnabled: true,
    });
    expect(() =>
      service.parseAndValidateAiJson(ParsedTaskResponse, raw),
    ).toThrow(BadGatewayException);
  });
});
