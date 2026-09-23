import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { getSafeUrl, isDefined } from 'twenty-shared/utils';
import { Banner } from 'twenty-ui/feedback';
import { IconCopy, IconExternalLink, IconX } from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useOs20UpdateStatus } from '@/os20-updates/hooks/useOs20UpdateStatus';
import {
  OS20_UPDATE_COMMAND,
  readDismissedOs20UpdateVersion,
  shouldShowOs20UpdateBanner,
  writeDismissedOs20UpdateVersion,
} from '@/os20-updates/utils/os20UpdateBannerDismissal';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

const StyledContent = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: center;
  margin-left: 24px;
`;

const StyledText = styled.span`
  min-width: 0;
`;

const StyledCode = styled.code`
  font-family: ${themeCssVariables.code.font.family};
`;

export const InformationBannerOs20Update = () => {
  const { status } = useOs20UpdateStatus();
  const { copyToClipboard } = useCopyToClipboard();
  const [dismissedVersion, setDismissedVersion] = useState(
    readDismissedOs20UpdateVersion,
  );

  if (!shouldShowOs20UpdateBanner(status, dismissedVersion)) {
    return null;
  }

  const latestVersion = status?.latestVersion ?? '';
  const releaseNotesUrl = getSafeUrl(status?.releaseNotesUrl);

  const dismiss = () => {
    writeDismissedOs20UpdateVersion(latestVersion);
    setDismissedVersion(latestVersion);
  };

  return (
    <Banner color="blue" variant="secondary">
      <StyledContent>
        <StyledText>
          <Trans>
            OS20 {latestVersion} is available. Your data stays on your computer.
            Run <StyledCode>os20 update</StyledCode> in your terminal, or re-run
            the install command.
          </Trans>
        </StyledText>
        <Button
          variant="secondary"
          accent="blue"
          size="small"
          Icon={IconCopy}
          title={t`Copy command`}
          onClick={() =>
            copyToClipboard(OS20_UPDATE_COMMAND, t`Update command copied`)
          }
        />
        {isDefined(releaseNotesUrl) && (
          <Button
            variant="secondary"
            accent="blue"
            size="small"
            Icon={IconExternalLink}
            title={t`Release notes`}
            onClick={() =>
              window.open(releaseNotesUrl, '_blank', 'noopener,noreferrer')
            }
          />
        )}
      </StyledContent>
      <IconButton
        Icon={IconX}
        size="small"
        variant="tertiary"
        accent="blue"
        onClick={dismiss}
        ariaLabel={t`Dismiss update notice`}
      />
    </Banner>
  );
};
