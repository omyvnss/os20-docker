import { useState } from 'react';

import { useStore } from 'jotai';
import { styled } from '@linaria/react';
import { useNavigate } from 'react-router-dom';

import { AppPath } from 'twenty-shared/types';
import { AnimatedEaseIn } from 'twenty-ui/layout';
import { MainButton } from 'twenty-ui/input';
import { ModalContent } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { Logo } from '@/auth/components/Logo';
import { Title } from '@/auth/components/Title';
import { tokenPairState } from '@/auth/states/tokenPairState';

import type { AuthTokenPair } from '~/generated-metadata/graphql';

const StyledStart = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  margin-top: ${themeCssVariables.spacing[8]};
`;

const StyledError = styled.p`
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

type LocalTokenResponse = {
  token: string;
  expiresAt: string;
};

export const SignInUp = () => {
  const store = useStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStart = async () => {
    if (isLoading) {
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let data: LocalTokenResponse | undefined;

    // The API may still be finalizing on the very first boot (migrations,
    // JWT signing-key init), so retry transient failures a few times so the
    // button never dies silently.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch('/auth/local-token', {
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          data = (await response.json()) as LocalTokenResponse;
          break;
        }

        const payload = await response
          .json()
          .catch(() => null)
          .then((j) => j?.message)
          .catch(() => null);
        console.warn(`local auth attempt ${attempt + 1} failed: ${response.status}`);
        if (attempt === 2) {
          setErrorMessage(
            `Could not reach the server (${response.status}). Make sure it's running, then click Start Now again.${
              payload ? ` ${payload}` : ''
            }`,
          );
        }
        await sleep(800 * (attempt + 1));
      } catch (networkError) {
        console.warn('local auth network error', networkError);
        if (attempt === 2) {
          setErrorMessage(
            'Network error reaching the server. Make sure it is running, then click Start Now again.',
          );
        }
        await sleep(800 * (attempt + 1));
      }
    }

    if (!data) {
      setIsLoading(false);
      return;
    }

    const tokenPair: AuthTokenPair = {
      accessOrWorkspaceAgnosticToken: {
        token: data.token,
        expiresAt: data.expiresAt,
      },
      refreshToken: { token: data.token, expiresAt: data.expiresAt },
    };

    store.set(tokenPairState.atom, tokenPair);

    navigate(AppPath.Index);
  };

  return (
    <ModalContent isVerticallyCentered isHorizontallyCentered>
      <AnimatedEaseIn>
        <Logo />
      </AnimatedEaseIn>
      <Title animate>Welcome</Title>
      <StyledStart>
        {errorMessage && <StyledError>{errorMessage}</StyledError>}
        <MainButton
          title="Start Now"
          fullWidth
          onClick={handleStart}
          disabled={isLoading}
        />
      </StyledStart>
    </ModalContent>
  );
};