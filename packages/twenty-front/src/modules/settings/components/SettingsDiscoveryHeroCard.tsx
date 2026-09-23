import { type SettingsCustomizeVideoModalTab } from '@/settings/components/SettingsCustomizeVideoModal';
import { styled } from '@linaria/react';
import { type ReactNode, useContext } from 'react';
import { Card } from 'twenty-ui/surfaces';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';

const DEFAULT_COVER_HEIGHT = 150;

const StyledCoverContainer = styled.div<{ coverHeight: number }>`
  background: ${themeCssVariables.background.secondary};
  box-sizing: border-box;
  height: ${({ coverHeight }) => coverHeight}px;
  overflow: hidden;
  position: relative;
`;

const StyledImage = styled.img`
  display: block;
  height: 100%;
  inset: 0;
  object-fit: cover;
  object-position: center top;
  position: absolute;
  width: 100%;
`;

const StyledFooter = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
`;

type SettingsDiscoveryHeroCardProps = {
  lightSrc: string;
  darkSrc: string;
  instanceIdPrefix: string;
  tabs: SettingsCustomizeVideoModalTab[];
  coverHeight?: number;
  footer?: ReactNode;
  playButtonAriaLabel?: string;
};

// The upstream walkthrough videos show another product's branding and load a
// third-party player, so OS20 keeps only the cover and footer. `tabs`,
// `instanceIdPrefix` and `playButtonAriaLabel` are accepted for existing callers.
export const SettingsDiscoveryHeroCard = ({
  lightSrc,
  darkSrc,
  coverHeight = DEFAULT_COVER_HEIGHT,
  footer,
}: SettingsDiscoveryHeroCardProps) => {
  const { colorScheme } = useContext(ThemeContext);

  const src = colorScheme === 'light' ? lightSrc : darkSrc;

  return (
    <Card rounded>
      <StyledCoverContainer coverHeight={coverHeight}>
        <StyledImage src={src} alt="" aria-hidden />
      </StyledCoverContainer>
      {footer !== undefined && footer !== null && (
        <StyledFooter>{footer}</StyledFooter>
      )}
    </Card>
  );
};
