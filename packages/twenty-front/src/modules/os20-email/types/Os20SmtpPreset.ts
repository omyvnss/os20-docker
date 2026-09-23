import { type MessageDescriptor } from '@lingui/core';

import { type Os20SmtpPresetId } from '@/os20-email/types/Os20SmtpPresetId';

export type Os20SmtpPreset = {
  id: Os20SmtpPresetId;
  label: MessageDescriptor;
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  hint: MessageDescriptor;
};
