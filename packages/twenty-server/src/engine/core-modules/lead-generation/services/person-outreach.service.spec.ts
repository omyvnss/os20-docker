import {
  AiLeadScoringService,
  OutreachAiUnavailableError,
} from 'src/engine/core-modules/lead-generation/services/ai-lead-scoring.service';
import {
  OutreachPersonNotFoundError,
  PersonOutreachService,
} from 'src/engine/core-modules/lead-generation/services/person-outreach.service';
import {
  buildOutreachPrompt,
  isOutreachTone,
  parseOutreachResponse,
} from 'src/engine/core-modules/lead-generation/utils/outreach-prompt.util';

jest.mock(
  'src/engine/core-modules/ai-provider/registry/provider.registry',
  () => ({ ProviderRegistry: class {} }),
);
jest.mock(
  'src/engine/core-modules/lead-generation/services/lead-byok.service',
  () => ({ LeadByokService: class {} }),
);
jest.mock(
  'src/engine/core-modules/lead-generation/services/lead-persistence.service',
  () => ({ LeadPersistenceService: class {} }),
);
jest.mock('src/engine/twenty-orm/utils/build-system-auth-context.util', () => ({
  buildSystemAuthContext: jest.fn(() => ({})),
}));

describe('outreach prompt', () => {
  it('lists only known facts and forbids invented ones', () => {
    const prompt = buildOutreachPrompt(
      {
        firstName: 'Jana',
        jobTitle: 'Head of Sales',
        companyName: 'Acme',
        companyWebsite: 'https://acme.de',
      },
      'short',
    );

    expect(prompt).toContain('- Recipient first name: Jana');
    expect(prompt).toContain('- Recipient job title: Head of Sales');
    expect(prompt).toContain('- Company website: https://acme.de');
    expect(prompt).not.toContain('Company description');
    expect(prompt).not.toContain('Recipient last name');
    expect(prompt).toContain('Do not invent');
    expect(prompt).toContain('under 70 words');
  });

  it('accepts only the supported tones', () => {
    expect(isOutreachTone('formal')).toBe(true);
    expect(isOutreachTone('pushy')).toBe(false);
    expect(isOutreachTone(undefined)).toBe(false);
  });
});

describe('parseOutreachResponse', () => {
  it('parses JSON wrapped in fences and reasoning', () => {
    expect(
      parseOutreachResponse(
        '<think>plan</think>```json\n{"subject":" Quick question ","body":"Hi Jana,\\nShort note."}\n```',
      ),
    ).toEqual({ subject: 'Quick question', body: 'Hi Jana,\nShort note.' });
  });

  it('falls back to a Subject: line format', () => {
    expect(
      parseOutreachResponse('Subject: Hello Acme\n\nHi Jana,\nThanks.'),
    ).toEqual({ subject: 'Hello Acme', body: 'Hi Jana,\nThanks.' });
  });

  it('returns null for unusable output', () => {
    expect(parseOutreachResponse('')).toBeNull();
    expect(parseOutreachResponse('{"subject":"x"}')).toBeNull();
    expect(parseOutreachResponse('just some text')).toBeNull();
  });
});

const buildAi = (content: string | null, hasKey = true) => {
  const generate = jest.fn(async () => ({
    model: 'm',
    choices: [{ message: { content } }],
  }));
  const providerRegistry = { resolve: jest.fn(() => ({ generate })) };
  const byok = {
    resolve: jest.fn(async () =>
      hasKey
        ? {
            provider: 'openrouter',
            model: 'free-model',
            apiKey: 'k',
            workspaceId: 'ws',
          }
        : null,
    ),
  };

  return {
    generate,
    byok,
    ai: new AiLeadScoringService(providerRegistry as never, byok as never),
  };
};

const buildOutreachService = (
  ai: AiLeadScoringService,
  person: unknown,
  company: unknown,
) => {
  const repositories = {
    person: { findOne: jest.fn(async () => person) },
    company: { findOne: jest.fn(async () => company) },
  };
  const workspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(async (fn: () => unknown) => fn()),
    getRepository: jest.fn((entity: { name: string }) =>
      entity.name === 'PersonWorkspaceEntity'
        ? repositories.person
        : repositories.company,
    ),
  };
  const leadPersistenceService = {
    list: jest.fn(async () => [
      {
        domain: 'acme.de',
        companyUrl: 'https://www.acme.de/',
        description: 'Acme builds CRM tools for bakeries.',
      },
    ]),
  };

  return new PersonOutreachService(
    workspaceOrmManager as never,
    leadPersistenceService as never,
    ai,
  );
};

describe('PersonOutreachService', () => {
  const person = {
    id: 'person-1',
    name: { firstName: 'Jana', lastName: 'Fischer' },
    jobTitle: 'CEO',
    companyId: 'company-1',
  };
  const company = {
    id: 'company-1',
    name: 'Acme',
    domainName: { primaryLinkUrl: 'https://acme.de' },
  };

  it('drafts subject and body from the person, company and saved description', async () => {
    const { ai, generate, byok } = buildAi(
      '{"subject":"Bakery CRM","body":"Hi Jana, ..."}',
    );
    const service = buildOutreachService(ai, person, company);

    const draft = await service.generate('ws', 'person-1', 'formal');

    expect(draft).toEqual({
      personId: 'person-1',
      companyId: 'company-1',
      subject: 'Bakery CRM',
      body: 'Hi Jana, ...',
    });
    expect(byok.resolve).toHaveBeenCalledWith('ws');

    const [[request]] = generate.mock.calls as unknown as [
      [{ model: string; messages: { content: string }[] }],
    ];

    expect(request.model).toBe('free-model');
    expect(request.messages[0].content).toContain(
      'Company description: Acme builds CRM tools for bakeries.',
    );
    expect(request.messages[0].content).toContain('Recipient job title: CEO');
    expect(request.messages[0].content).toContain('under 130 words');
  });

  it('fails clearly when no AI key is configured', async () => {
    const { ai, generate } = buildAi(null, false);
    const service = buildOutreachService(ai, person, company);

    await expect(service.generate('ws', 'person-1')).rejects.toBeInstanceOf(
      OutreachAiUnavailableError,
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it('fails when the person does not exist', async () => {
    const { ai } = buildAi('{}');
    const service = buildOutreachService(ai, null, null);

    await expect(service.generate('ws', 'missing')).rejects.toBeInstanceOf(
      OutreachPersonNotFoundError,
    );
  });

  it('fails when the model output cannot be parsed', async () => {
    const { ai } = buildAi('sorry, I cannot');
    const service = buildOutreachService(ai, person, company);

    await expect(service.generate('ws', 'person-1')).rejects.toThrow(
      'no usable email draft',
    );
  });
});
