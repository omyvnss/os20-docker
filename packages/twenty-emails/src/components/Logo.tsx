import { Img } from 'react-email';

import { DEFAULT_WORKSPACE_LOGO } from 'src/constants/DefaultWorkspaceLogo';

const logoStyle = {
  marginBottom: '40px',
};

export const Logo = () => {
  return (
    <Img
      src={DEFAULT_WORKSPACE_LOGO}
      alt="OS20"
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
