import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { getSafeUrl, isDefined } from 'twenty-shared/utils';
import { IconCopy, IconExternalLink } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

import { useOs20UpdateStatus } from '@/os20-updates/hooks/useOs20UpdateStatus';
import { getOs20UpdateStatusLabel } from '@/os20-updates/utils/getOs20UpdateStatusLabel';
import { OS20_UPDATE_COMMAND } from '@/os20-updates/utils/os20UpdateBannerDismissal';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

const StyledCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledRow = styled.div`
  align-items: baseline;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.code.font.family};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledStatus = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

export const SettingsOs20UpdateStatusSection = () => {
  const { t } = useLingui();
  const { status, isLoaded } = useOs20UpdateStatus();
  const { copyToClipboard } = useCopyToClipboard();

  const releaseNotesUrl = getSafeUrl(status?.releaseNotesUrl);
  const currentVersion = status?.currentVersion ?? t`Unknown`;
  const checkedAt = isDefined(status?.checkedAt)
    ? new Date(status.checkedAt).toLocaleString()
    : null;

  return (
    <Section>
      <H2Title
        title={t`Version`}
        description={t`OS20 checks GitHub for new releases. Only the version number is fetched; nothing about you is sent.`}
      />
      <StyledCard>
        <StyledRow>
          <StyledLabel>{t`Current version`}</StyledLabel>
          <StyledValue>{currentVersion}</StyledValue>
        </StyledRow>
        <StyledStatus>
          {getOs20UpdateStatusLabel(status, isLoaded)}
        </StyledStatus>
        {isDefined(checkedAt) && (
          <StyledLabel>{t`Last checked ${checkedAt}`}</StyledLabel>
        )}
        {status?.updateAvailable === true && (
          <StyledActions>
            <Button
              variant="secondary"
              size="small"
              Icon={IconCopy}
              title={t`Copy ${OS20_UPDATE_COMMAND}`}
              onClick={() =>
                copyToClipboard(OS20_UPDATE_COMMAND, t`Update command copied`)
              }
            />
            {isDefined(releaseNotesUrl) && (
              <Button
                variant="secondary"
                size="small"
                Icon={IconExternalLink}
                title={t`Release notes`}
                onClick={() =>
                  window.open(releaseNotesUrl, '_blank', 'noopener,noreferrer')
                }
              />
            )}
          </StyledActions>
        )}
      </StyledCard>
    </Section>
  );
};
