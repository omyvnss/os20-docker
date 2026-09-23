import { Logger } from '@nestjs/common';

const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const MODELS_CACHE_MS = 60 * 60 * 1000;
const FALLBACK_CACHE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const ATTEMPT_TIMEOUT_MS = 30_000;
const RETRYABLE_STATUSES = new Set([402, 404, 408, 429, 500, 502, 503, 504]);
const RETRYABLE_400 =
  /no endpoints|not a valid model|tool use|does not support tools/i;

// Tried first, in this order, when they are still free and listed by OpenRouter.
export const PREFERRED_FREE_OPENROUTER_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'poolside/laguna-s-2.1:free',
  'openrouter/free',
];

type OpenRouterModel = {
  id: string;
  pricing?: { prompt?: string; completion?: string; request?: string };
  supported_parameters?: string[];
};

type FreeModels = { expiresAt: number; all: string[]; withTools: string[] };

const logger = new Logger('OpenRouterFreeModels');

let freeModelsCache: FreeModels | null = null;

export const isFreeOpenRouterModel = (modelId: string): boolean =>
  modelId.endsWith(':free') || modelId === 'openrouter/free';

const isZero = (value: string | undefined) =>
  value === undefined || Number(value) === 0;

const loadFreeModels = async (baseFetch: typeof fetch): Promise<FreeModels> => {
  if (freeModelsCache && freeModelsCache.expiresAt > Date.now()) {
    return freeModelsCache;
  }

  try {
    const response = await baseFetch(MODELS_URL, {
      signal: AbortSignal.timeout(5000),
    });
    const { data } = (await response.json()) as { data: OpenRouterModel[] };
    const free = data.filter(
      (model) =>
        isFreeOpenRouterModel(model.id) &&
        isZero(model.pricing?.prompt) &&
        isZero(model.pricing?.completion) &&
        isZero(model.pricing?.request),
    );

    freeModelsCache = {
      expiresAt: Date.now() + MODELS_CACHE_MS,
      all: free.map((model) => model.id),
      withTools: free
        .filter((model) => model.supported_parameters?.includes('tools'))
        .map((model) => model.id),
    };
  } catch (error) {
    logger.warn(
      `Could not load the OpenRouter model list, using the built-in free list: ${error instanceof Error ? error.message : String(error)}`,
    );
    freeModelsCache = {
      expiresAt: Date.now() + FALLBACK_CACHE_MS,
      all: PREFERRED_FREE_OPENROUTER_MODELS,
      withTools: PREFERRED_FREE_OPENROUTER_MODELS,
    };
  }

  return freeModelsCache;
};

const rankFreeModels = (requested: string, pool: string[]): string[] => {
  const preferred = PREFERRED_FREE_OPENROUTER_MODELS.filter((id) =>
    pool.includes(id),
  );
  const rest = pool.filter(
    (id) => !preferred.includes(id) && id !== 'openrouter/free',
  );
  const ordered = [
    ...(isFreeOpenRouterModel(requested) ? [requested] : []),
    ...preferred.filter((id) => id !== 'openrouter/free'),
    ...rest,
  ];

  return [...new Set(ordered)];
};

const parseJsonBody = (body: unknown): Record<string, unknown> | null => {
  if (typeof body !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(body);

    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
};

// The body is rewritten with another model id, so a length computed for the
// original body would no longer match and the request would be rejected.
const withoutContentLength = (headers: HeadersInit | undefined): Headers => {
  const result = new Headers(headers);

  result.delete('content-length');

  return result;
};

// OpenRouter can answer 200 with only an error object when the upstream
// provider of a free model is overloaded, so non-streaming bodies are checked.
const describeFailure = async (
  response: Response,
  isStreaming: boolean,
): Promise<string | null> => {
  if (RETRYABLE_STATUSES.has(response.status)) {
    return `status ${response.status}`;
  }

  if (response.status === 400) {
    const text = await response
      .clone()
      .text()
      .catch(() => '');

    return RETRYABLE_400.test(text)
      ? `status 400: ${text.slice(0, 160)}`
      : null;
  }

  if (response.status !== 200 || isStreaming) {
    return null;
  }

  const payload = await response
    .clone()
    .json()
    .catch(() => null);

  if (payload && !Array.isArray(payload.choices) && payload.error) {
    return `error in 200 response: ${JSON.stringify(payload.error).slice(0, 160)}`;
  }

  return null;
};

type StreamPeek = { failure: string | null; response: Response };

const MAX_PEEK_BYTES = 256 * 1024;

const findFirstStreamEvent = (text: string): 'error' | 'data' | null => {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('data:')) {
      continue;
    }

    const data = trimmed.slice(5).trim();

    if (data === '[DONE]') {
      return 'data';
    }

    try {
      const event = JSON.parse(data);

      return event?.error ? 'error' : 'data';
    } catch {
      return null;
    }
  }

  return null;
};

// A free model that is overloaded often answers 200 and then sends the error
// as the first stream event, so the start of the stream is read before the
// response is handed to the caller. Consumed bytes are replayed.
const peekStream = async (response: Response): Promise<StreamPeek> => {
  if (response.status !== 200 || !response.body) {
    return { failure: null, response };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let text = '';
  let size = 0;
  let finished = false;
  let first: 'error' | 'data' | null = null;

  while (first === null && size < MAX_PEEK_BYTES) {
    const { done, value } = await reader.read();

    if (done) {
      finished = true;
      break;
    }

    chunks.push(value);
    size += value.byteLength;
    text += decoder.decode(value, { stream: true });

    const lastNewline = text.lastIndexOf('\n');

    if (lastNewline >= 0) {
      first = findFirstStreamEvent(text.slice(0, lastNewline));
    }
  }

  if (first === null && finished) {
    first = findFirstStreamEvent(text);
  }

  if (first === 'error') {
    await reader.cancel().catch(() => undefined);

    return {
      failure: `error in stream: ${text.slice(0, 160).replace(/\s+/g, ' ')}`,
      response,
    };
  }

  const replay = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));

      if (finished) {
        controller.close();
      }
    },
    async pull(controller) {
      const { done, value } = await reader.read();

      if (done) {
        controller.close();

        return;
      }

      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return {
    failure: null,
    response: new Response(replay, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  };
};

// OS20 only ever spends free OpenRouter capacity: paid model ids are swapped
// for free ones, and a rate-limited or unavailable free model falls through to
// the next free model instead of failing the request.
export const createOpenRouterFreeFetch =
  (baseFetch: typeof fetch = fetch): typeof fetch =>
  async (input, init) => {
    const body = parseJsonBody(init?.body);

    if (!body || typeof body.model !== 'string') {
      return baseFetch(input, init);
    }

    const requested = body.model;
    const { all, withTools } = await loadFreeModels(baseFetch);
    const pool =
      Array.isArray(body.tools) && body.tools.length > 0 ? withTools : all;
    const ranked = rankFreeModels(requested, pool).filter(
      (id) => id !== 'openrouter/free',
    );
    const candidates = [
      ...ranked.slice(0, MAX_ATTEMPTS - 1),
      'openrouter/free',
    ];

    if (!isFreeOpenRouterModel(requested)) {
      logger.log(
        `Paid OpenRouter model ${requested} replaced with free model ${candidates[0]}`,
      );
    }

    let response: Response | undefined;

    for (const [index, model] of candidates.entries()) {
      const isLast = index === candidates.length - 1;

      if (isLast) {
        return baseFetch(input, {
          ...init,
          headers: withoutContentLength(init?.headers),
          body: JSON.stringify({ ...body, model }),
        });
      }

      // A slow free model would otherwise use up the caller's whole timeout,
      // so each non-final attempt gets its own deadline until it starts answering.
      const attempt = new AbortController();
      const timer = setTimeout(
        () => attempt.abort(new Error('attempt timed out')),
        ATTEMPT_TIMEOUT_MS,
      );
      const signal = init?.signal
        ? AbortSignal.any([init.signal, attempt.signal])
        : attempt.signal;
      let failure: string | null;

      try {
        response = await baseFetch(input, {
          ...init,
          signal,
          headers: withoutContentLength(init?.headers),
          body: JSON.stringify({ ...body, model }),
        });

        failure = await describeFailure(response, body.stream === true);

        if (!failure && body.stream === true) {
          const peek = await peekStream(response);

          if (!peek.failure) {
            clearTimeout(timer);

            return peek.response;
          }

          failure = peek.failure;
        } else if (!failure) {
          clearTimeout(timer);

          return response;
        } else {
          await response.body?.cancel().catch(() => undefined);
        }
      } catch (error) {
        clearTimeout(timer);

        if (init?.signal?.aborted) {
          throw error;
        }

        failure = attempt.signal.aborted
          ? `no answer within ${ATTEMPT_TIMEOUT_MS / 1000}s`
          : 'could not be reached';
      }

      clearTimeout(timer);
      logger.warn(
        `Free OpenRouter model ${model} failed (${failure}), trying the next free model`,
      );
    }

    return response as Response;
  };
