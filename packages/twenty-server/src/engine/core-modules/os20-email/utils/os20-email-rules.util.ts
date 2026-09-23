import { EmailConnectionSecurity } from 'src/engine/core-modules/imap-smtp-caldav-connection/enums/email-connection-security.enum';

export const OS20_EMAIL_DEFAULT_DAILY_LIMIT = 30;
export const OS20_EMAIL_MAX_DAILY_LIMIT = 500;
export const OS20_EMAIL_MAX_SUBJECT_LENGTH = 300;
export const OS20_EMAIL_MAX_BODY_LENGTH = 20000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const HOST_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export class Os20EmailValidationError extends Error {}

export type Os20SmtpInput = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  fromName?: string;
  fromEmail: string;
  dailyLimit: number;
};

export type Os20SendInput = {
  personId: string;
  subject: string;
  body: string;
  confirm: boolean;
};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const isValidEmailAddress = (value: string): boolean =>
  value.length <= 254 && EMAIL_PATTERN.test(value);

export const parseDailyLimit = (value: unknown): number => {
  if (value === undefined || value === null || value === '') {
    return OS20_EMAIL_DEFAULT_DAILY_LIMIT;
  }

  const limit = typeof value === 'string' ? Number(value) : value;

  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > OS20_EMAIL_MAX_DAILY_LIMIT
  ) {
    throw new Os20EmailValidationError(
      `dailyLimit must be a whole number between 1 and ${OS20_EMAIL_MAX_DAILY_LIMIT}`,
    );
  }

  return limit;
};

export const parseSmtpInput = (
  body: unknown,
  { requirePassword }: { requirePassword: boolean },
): Os20SmtpInput => {
  const input = (
    typeof body === 'object' && body !== null ? body : {}
  ) as Record<string, unknown>;

  const host = readString(input.host).toLowerCase();

  if (!HOST_PATTERN.test(host) || host.length > 253) {
    throw new Os20EmailValidationError('host must be a valid hostname');
  }

  const port = typeof input.port === 'string' ? Number(input.port) : input.port;

  if (
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Os20EmailValidationError('port must be between 1 and 65535');
  }

  const fromEmail = readString(input.fromEmail).toLowerCase();

  if (!isValidEmailAddress(fromEmail)) {
    throw new Os20EmailValidationError('fromEmail must be a valid email');
  }

  const username = readString(input.username) || fromEmail;
  const password = typeof input.password === 'string' ? input.password : '';

  if (requirePassword && password.length === 0) {
    throw new Os20EmailValidationError('password is required');
  }

  const fromName = readString(input.fromName).slice(0, 120);

  return {
    host,
    port,
    secure: typeof input.secure === 'boolean' ? input.secure : port === 465,
    username,
    ...(password.length > 0 && { password }),
    ...(fromName.length > 0 && { fromName }),
    fromEmail,
    dailyLimit: parseDailyLimit(input.dailyLimit),
  };
};

export const parseSendInput = (body: unknown): Os20SendInput => {
  const input = (
    typeof body === 'object' && body !== null ? body : {}
  ) as Record<string, unknown>;

  const personId = readString(input.personId);

  if (!UUID_PATTERN.test(personId)) {
    throw new Os20EmailValidationError('personId must be a uuid');
  }

  const subject = readString(input.subject).replace(/[\r\n]+/g, ' ');

  if (subject.length === 0 || subject.length > OS20_EMAIL_MAX_SUBJECT_LENGTH) {
    throw new Os20EmailValidationError(
      `subject is required (max ${OS20_EMAIL_MAX_SUBJECT_LENGTH} characters)`,
    );
  }

  const text = typeof input.body === 'string' ? input.body.trim() : '';

  if (text.length === 0 || text.length > OS20_EMAIL_MAX_BODY_LENGTH) {
    throw new Os20EmailValidationError(
      `body is required (max ${OS20_EMAIL_MAX_BODY_LENGTH} characters)`,
    );
  }

  return { personId, subject, body: text, confirm: input.confirm === true };
};

export const toConnectionSecurity = (secure: boolean) =>
  secure ? EmailConnectionSecurity.SSL_TLS : EmailConnectionSecurity.STARTTLS;

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const plainTextToHtml = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');

export const startOfUtcDay = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export type RecipientRefusal =
  | 'NO_EMAIL'
  | 'INVALID_EMAIL'
  | 'NEEDS_CONFIRMATION';

const RISKY_STATUSES = new Set(['GUESSED', 'INVALID']);

export const getRecipientRefusal = ({
  email,
  emailStatus,
  confirm,
}: {
  email: string | null | undefined;
  emailStatus: string | null | undefined;
  confirm: boolean;
}): RecipientRefusal | null => {
  const address = email?.trim() ?? '';

  if (address.length === 0) return 'NO_EMAIL';

  if (!isValidEmailAddress(address)) return 'INVALID_EMAIL';

  if (RISKY_STATUSES.has((emailStatus ?? '').toUpperCase()) && !confirm) {
    return 'NEEDS_CONFIRMATION';
  }

  return null;
};
