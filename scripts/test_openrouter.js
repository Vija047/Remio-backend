require('dotenv').config();
const fetch = globalThis.fetch || require('node-fetch');

(async () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  console.log('Using baseUrl:', baseUrl);
  if (!apiKey) return console.error('No OPENROUTER_API_KEY');

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-5-chat',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });
    console.log('status', res.status, res.statusText);
    const txt = await res.text();
    console.log('body:', txt.slice(0, 1000));
  } catch (e) {
    console.error('Fetch error', e);
  }
})();
