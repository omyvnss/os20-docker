import { workspacePublicDataState } from '@/auth/states/workspacePublicDataState';
import { DEFAULT_WORKSPACE_LOGO } from '@/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { getImageAbsoluteURI } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const PageFavicon = () => {
  const workspacePublicData = useAtomStateValue(workspacePublicDataState);

  const href = workspacePublicData?.logo
    ? (getImageAbsoluteURI({
        imageUrl: workspacePublicData.logo,
        baseUrl: REACT_APP_SERVER_BASE_URL,
      }) ?? DEFAULT_WORKSPACE_LOGO)
    : DEFAULT_WORKSPACE_LOGO;

  // The type has to match the file, otherwise browsers drop the icon and fall
  // back to whatever they have cached for the origin.
  const type = href.endsWith('.svg')
    ? 'image/svg+xml'
    : href.endsWith('.png')
      ? 'image/png'
      : 'image/x-icon';

  return (
    <Helmet>
      <link rel="icon" type={type} href={href} />
    </Helmet>
  );
};
