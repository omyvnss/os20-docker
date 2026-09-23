import { createOpenRouterFreeFetch } from 'src/engine/core-modules/ai-provider/utils/openrouter-free-fetch.util';

const MODELS = {
  data: [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
    'openrouter/free',
  ].map((id) => ({
    id,
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['tools'],
  })),
};

const encoder = new TextEncoder();

const sse = (events: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        events.forEach((event) => controller.enqueue(encoder.encode(event)));
        controller.close();
      },
    }),
    { status: 200 },
  );

type Behavior = 'ok' | 'overloaded' | 'hang' | 'stream-error' | 'stream-ok';

const createFakeFetch = (behaviors: Record<string, Behavior>) => {
  const calls: string[] = [];

  const fakeFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith('/models')) {
      return new Response(JSON.stringify(MODELS));
    }

    const model = JSON.parse(String(init?.body)).model as string;

    calls.push(model);

    switch (behaviors[model] ?? 'ok') {
      case 'overloaded':
        return new Response(JSON.stringify({ error: { code: 502 } }), {
          status: 200,
        });
      case 'hang':
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        });
      case 'stream-error':
        return sse([
          ': OPENROUTER PROCESSING\n\n',
          'data: {"error":{"message":"Service temporarily overloaded"}}\n\n',
        ]);
      case 'stream-ok':
        return sse([
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: [DONE]\n\n',
        ]);
      default:
        return new Response(JSON.stringify({ choices: [{ message: {} }] }));
    }
  }) as typeof fetch;

  return { calls, fakeFetch };
};

const post = (fetcher: typeof fetch, body: object) =>
  fetcher('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('createOpenRouterFreeFetch', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('replaces a paid model with a free one', async () => {
    const { calls, fakeFetch } = createFakeFetch({});

    await post(createOpenRouterFreeFetch(fakeFetch), {
      model: 'openai/gpt-4o-mini',
    });

    expect(calls).toEqual(['nvidia/nemotron-3-super-120b-a12b:free']);
  });

  it('moves to the next free model when an error hides in a 200', async () => {
    const { calls, fakeFetch } = createFakeFetch({
      'nvidia/nemotron-3-super-120b-a12b:free': 'overloaded',
    });

    const response = await post(createOpenRouterFreeFetch(fakeFetch), {
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
    });

    expect(calls).toEqual([
      'nvidia/nemotron-3-super-120b-a12b:free',
      'google/gemma-4-31b-it:free',
    ]);
    expect(Array.isArray((await response.json()).choices)).toBe(true);
  });

  it('moves on when a stream starts with an error and replays a good stream', async () => {
    const { calls, fakeFetch } = createFakeFetch({
      'nvidia/nemotron-3-super-120b-a12b:free': 'stream-error',
      'google/gemma-4-31b-it:free': 'stream-ok',
    });

    const response = await post(createOpenRouterFreeFetch(fakeFetch), {
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      stream: true,
    });

    expect(calls).toHaveLength(2);
    expect(await response.text()).toContain('"content":"Hello"');
  });

  it('gives up on a free model that does not answer in time', async () => {
    jest.useFakeTimers();

    const { calls, fakeFetch } = createFakeFetch({
      'nvidia/nemotron-3-super-120b-a12b:free': 'hang',
    });

    const pending = post(createOpenRouterFreeFetch(fakeFetch), {
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
    });

    await jest.advanceTimersByTimeAsync(30_000);

    const response = await pending;

    expect(calls).toEqual([
      'nvidia/nemotron-3-super-120b-a12b:free',
      'google/gemma-4-31b-it:free',
    ]);
    expect(response.status).toBe(200);
  });
});
