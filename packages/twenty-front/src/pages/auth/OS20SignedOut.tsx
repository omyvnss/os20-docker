import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLingui } from '@lingui/react/macro';
import { Button } from 'twenty-ui/input';
import { H2Title } from 'twenty-ui/typography';
import { AppPath } from 'twenty-shared/types';

export const OS20SignedOut = () => {
  const { t } = useLingui();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(AppPath.Index);
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <H2Title
        title={t`You're logged out`}
        description={t`Thanks for using OS20. Redirecting to the CRM...`}
      />
      <Button
        title={t`Go to CRM`}
        variant="primary"
        accent="green"
        onClick={() => navigate(AppPath.Index)}
      />
    </div>
  );
};