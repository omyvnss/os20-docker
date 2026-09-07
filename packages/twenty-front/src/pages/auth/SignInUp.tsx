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

type LocalTokenResponse = {
  token: string;
  expiresAt: string;
};

export const SignInUp = () => {
  const store = useStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/auth/local-token', {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`local auth failed with ${response.status}`);
      }

      const data = (await response.json()) as LocalTokenResponse;

      const tokenPair: AuthTokenPair = {
        accessOrWorkspaceAgnosticToken: {
          token: data.token,
          expiresAt: data.expiresAt,
        },
        refreshToken: { token: data.token, expiresAt: data.expiresAt },
      };

      store.set(tokenPairState.atom, tokenPair);

      navigate(AppPath.Index);
    } catch (error) {
      console.error('Could not start the application', error);
      setIsLoading(false);
    }
  };

  return (
    <ModalContent isVerticallyCentered isHorizontallyCentered>
      <AnimatedEaseIn>
        <Logo />
      </AnimatedEaseIn>
      <Title animate>Welcome</Title>
      <StyledStart>
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