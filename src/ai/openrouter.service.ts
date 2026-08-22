import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class OpenRouterService {
  constructor(private readonly configService: ConfigService) {}

  async chatCompletion(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.configService.getOrThrow<string>('OPENROUTER_API_KEY');
    const baseUrl =
      this.configService.get<string>('OPENROUTER_BASE_URL') ??
      'https://openrouter.ai/api/v1';
    const model =
      this.configService.get<string>('OPENROUTER_MODEL') ??
      'openai/gpt-4o-mini';

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI provider is not configured',
      );
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://routineai.app',
        'X-Title': 'RoutineAI',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const msg = `AI provider request failed: ${response.status} ${response.statusText} ${text}`;
      throw new ServiceUnavailableException(msg);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException('AI provider returned empty response');
    }
    return content;
  }
}
