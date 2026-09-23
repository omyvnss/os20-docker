export const OUTREACH_TONES = ['short', 'friendly', 'formal'] as const;

export type OutreachTone = (typeof OUTREACH_TONES)[number];

export type OutreachContext = {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  companyName?: string;
  companyWebsite?: string;
  companyDescription?: string;
};

export type OutreachDraft = {
  subject: string;
  body: string;
};

const TONE_INSTRUCTIONS: Record<OutreachTone, string> = {
  short: 'Keep the body under 70 words. Plain and direct.',
  friendly: 'Keep the body under 110 words. Warm and conversational.',
  formal: 'Keep the body under 130 words. Polite and professional.',
};

const MAX_DESCRIPTION_LENGTH = 600;

const clean = (value: string | undefined) =>
  value?.replace(/\s+/g, ' ').trim() || undefined;

export const isOutreachTone = (value: unknown): value is OutreachTone =>
  typeof value === 'string' &&
  (OUTREACH_TONES as readonly string[]).includes(value);

export const buildOutreachPrompt = (
  context: OutreachContext,
  tone: OutreachTone = 'friendly',
): string => {
  const facts = [
    ['Recipient first name', clean(context.firstName)],
    ['Recipient last name', clean(context.lastName)],
    ['Recipient job title', clean(context.jobTitle)],
    ['Company name', clean(context.companyName)],
    ['Company website', clean(context.companyWebsite)],
    [
      'Company description',
      clean(context.companyDescription)?.slice(0, MAX_DESCRIPTION_LENGTH),
    ],
  ]
    .filter(([, value]) => !!value)
    .map(([label, value]) => `- ${label}: ${value}`)
    .join('\n');

  return [
    'Write a first-touch sales outreach email to the person below.',
    '',
    'Known facts (the ONLY facts you may use):',
    facts || '- none',
    '',
    'Rules:',
    '- Use only the facts listed above. Do not invent numbers, customers, news, funding, products, locations, mutual contacts or anything else.',
    '- If a fact is missing, write around it instead of guessing.',
    '- Do not claim you visited, used or researched anything beyond the facts above.',
    '- No placeholders in brackets except [Your name] for the signature.',
    `- ${TONE_INSTRUCTIONS[tone]}`,
    '- Subject under 9 words.',
    '',
    'Return ONLY JSON: {"subject":"...","body":"..."}',
  ].join('\n');
};

const stripFences = (content: string) =>
  content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

export const parseOutreachResponse = (
  content: string | null | undefined,
): OutreachDraft | null => {
  if (!content?.trim()) {
    return null;
  }

  const text = stripFences(content);
  const json = text.match(/\{[\s\S]*\}/)?.[0];

  if (json) {
    try {
      const parsed = JSON.parse(json) as { subject?: unknown; body?: unknown };
      const subject =
        typeof parsed.subject === 'string' ? parsed.subject.trim() : '';
      const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';

      if (subject && body) {
        return { subject, body };
      }
    } catch {
      // Falls through to the plain-text format below.
    }
  }

  const subjectMatch = text.match(/^\s*subject\s*:\s*(.+)$/im);

  if (!subjectMatch) {
    return null;
  }

  const body = text
    .slice((subjectMatch.index ?? 0) + subjectMatch[0].length)
    .replace(/^\s*body\s*:\s*/i, '')
    .trim();

  return body ? { subject: subjectMatch[1].trim(), body } : null;
};
