import { useState } from 'react';

import { useStore } from 'jotai';
import { styled } from '@linaria/react';
import { useNavigate } from 'react-router-dom';

import { AppPath } from 'twenty-shared/types';
import { IconArrowRight } from 'twenty-ui/icon';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { fetchLocalTokenPair } from '@/auth/utils/fetchLocalTokenPair';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { LeadEnginePreview } from '~/pages/auth/components/LeadEnginePreview';
import { OS20_SETUP_PATH } from '~/pages/os20-setup/constants/Os20Setup';
import { isOs20SetupDismissed } from '~/pages/os20-setup/utils/os20SetupDismissal';

import type { AuthTokenPair } from '~/generated-metadata/graphql';

const DESKTOP_QUERY = '@media (min-width: 769px)';
const WIDE_QUERY = '@media (min-width: 1024px)';

const StyledPage = styled.main`
  background: #f1f1f1;
  box-sizing: border-box;
  color: #000;
  display: grid;
  flex: 1;
  font-family: 'Inter Tight', 'Helvetica Neue', Arial, sans-serif;
  grid-template-columns: minmax(0, 1fr);
  letter-spacing: -0.005em;
  min-height: 100%;
  overflow-y: auto;

  ${WIDE_QUERY} {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  }
`;

const StyledIntro = styled.section`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 24px 24px calc(24px + env(safe-area-inset-bottom));

  ${DESKTOP_QUERY} {
    padding: 40px max(1.25rem, 3.4vw);
  }
`;

const StyledBrand = styled.div`
  align-items: center;
  display: flex;
  flex: 0;
  gap: 9px;
  justify-content: flex-start;
`;

const StyledLogo = styled.img`
  height: 28px;
  width: 28px;
`;

const StyledWordmark = styled.span`
  font-family: 'Geist', 'Inter Tight', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1;
`;

const StyledHero = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 32px 0;

  ${DESKTOP_QUERY} {
    max-width: 34rem;
    padding: 0;
  }
`;

const StyledHeadline = styled.h1`
  color: #111;
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: clamp(2.5rem, 9vw, 3.25rem);
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1;
  margin: 0 0 16px;

  ${DESKTOP_QUERY} {
    font-size: clamp(2.6rem, 4.4vw, 4.4rem);
    margin: 0 0 18px;
  }
`;

const StyledHeadlineMuted = styled.span`
  color: #6c6b6b;
  display: block;
`;

const StyledSubline = styled.p`
  color: #2e2e2e;
  font-size: 1rem;
  line-height: 1.45;
  margin: 0 0 28px;
  max-width: 26rem;

  ${DESKTOP_QUERY} {
    font-size: 1.0625rem;
    margin: 0 0 32px;
  }
`;

const StyledActions = styled.div`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const StyledStartButton = styled.button`
  align-items: center;
  background: linear-gradient(90deg, #8300e9 0.01%, #b154f9 99.99%);
  border: 0;
  border-radius: max(0.625rem, 0.6944vw);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 500;
  gap: 0.6em;
  height: 3rem;
  justify-content: center;
  letter-spacing: -0.01em;
  padding: 0 1.4rem;
  transition:
    transform 0.4s cubic-bezier(0.19, 1, 0.22, 1),
    box-shadow 0.3s ease,
    opacity 0.2s ease;
  width: 100%;

  &:hover:not(:disabled) {
    box-shadow: 0 14px 30px -14px rgba(131, 0, 233, 0.75);
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid #b154f9;
    outline-offset: 3px;
  }

  &:disabled {
    cursor: progress;
    opacity: 0.75;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover:not(:disabled) {
      transform: none;
    }
  }

  ${DESKTOP_QUERY} {
    min-width: 13.5rem;
    width: auto;
  }
`;

const StyledCaption = styled.span`
  color: #6c6b6b;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 0.8125rem;
  text-align: left;
`;

const StyledError = styled.p`
  color: #a5140f;
  font-size: 0.875rem;
  line-height: 1.4;
  margin: 0;
  text-align: left;
`;

const StyledPreviewColumn = styled.aside`
  display: none;

  ${WIDE_QUERY} {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    padding: 48px;
  }
`;

export const SignInUp = () => {
  const store = useStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStart = async () => {
    if (isLoading) {
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let tokenPair: AuthTokenPair | null = null;

    // The API may still be finalizing on the very first boot (migrations,
    // workspace provisioning), so retry transient failures a few times so the
    // button never dies silently.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await fetchLocalTokenPair();

        tokenPair = result.tokenPair;

        if (tokenPair) {
          break;
        }

        if (attempt === 2) {
          setErrorMessage(
            `Can't reach the OS20 server (${result.status}). Check that it's running, then try again.`,
          );
        }
      } catch {
        if (attempt === 2) {
          setErrorMessage(
            "Can't reach the OS20 server. Check that it's running, then try again.",
          );
        }
      }

      await sleep(800 * (attempt + 1));
    }

    if (!tokenPair) {
      setIsLoading(false);
      return;
    }

    store.set(tokenPairState.atom, tokenPair);

    // The setup page skips itself when an AI key already exists.
    navigate(isOs20SetupDismissed() ? AppPath.Index : OS20_SETUP_PATH);
  };

  const buttonLabel = isLoading
    ? 'Opening'
    : errorMessage
      ? 'Try again'
      : 'Open OS20';

  return (
    <StyledPage>
      <StyledIntro>
        <StyledBrand>
          <StyledLogo src="/images/icons/app-logo.svg" alt="" />
          <StyledWordmark>OS20</StyledWordmark>
        </StyledBrand>

        <StyledHero>
          <StyledHeadline>
            Your CRM,
            <StyledHeadlineMuted>running on this machine.</StyledHeadlineMuted>
          </StyledHeadline>

          <StyledSubline>
            Companies, people and deals stay in Docker on your computer. Add
            your own AI key and OS20 goes out and finds the leads.
          </StyledSubline>

          <StyledActions>
            {errorMessage && (
              <StyledError role="alert">{errorMessage}</StyledError>
            )}
            <StyledStartButton
              type="button"
              onClick={handleStart}
              disabled={isLoading}
            >
              {buttonLabel}
              <IconArrowRight size={18} />
            </StyledStartButton>
            <StyledCaption>No account needed</StyledCaption>
          </StyledActions>
        </StyledHero>
      </StyledIntro>

      {!isMobile && (
        <StyledPreviewColumn>
          <LeadEnginePreview />
        </StyledPreviewColumn>
      )}
    </StyledPage>
  );
};
