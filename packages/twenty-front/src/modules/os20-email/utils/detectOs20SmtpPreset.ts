import { OS20_SMTP_PRESETS } from '@/os20-email/constants/Os20SmtpPresets';
import { type Os20SmtpPresetId } from '@/os20-email/types/Os20SmtpPresetId';

export const detectOs20SmtpPreset = (host: string): Os20SmtpPresetId => {
  const normalizedHost = host.trim().toLowerCase();

  return (
    OS20_SMTP_PRESETS.find(
      (preset) => preset.host.length > 0 && preset.host === normalizedHost,
    )?.id ?? 'custom'
  );
};
