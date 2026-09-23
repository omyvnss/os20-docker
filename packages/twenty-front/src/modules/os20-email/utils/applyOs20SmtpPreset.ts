import { OS20_SMTP_PRESETS } from '@/os20-email/constants/Os20SmtpPresets';
import { type Os20SmtpForm } from '@/os20-email/types/Os20SmtpForm';
import { type Os20SmtpPresetId } from '@/os20-email/types/Os20SmtpPresetId';

export const applyOs20SmtpPreset = (
  form: Os20SmtpForm,
  presetId: Os20SmtpPresetId,
): Os20SmtpForm => {
  const preset = OS20_SMTP_PRESETS.find((option) => option.id === presetId);

  if (preset === undefined) return form;

  if (preset.id === 'custom') {
    return { ...form, presetId: preset.id };
  }

  const previousPreset = OS20_SMTP_PRESETS.find(
    (option) => option.id === form.presetId,
  );
  const keepsUsername =
    previousPreset?.username === undefined ||
    form.username !== previousPreset.username;

  return {
    ...form,
    presetId: preset.id,
    host: preset.host,
    port: String(preset.port),
    secure: preset.secure,
    username: preset.username ?? (keepsUsername ? form.username : ''),
  };
};
