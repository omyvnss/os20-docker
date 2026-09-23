import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useLocation } from 'react-router-dom';
import { IconTargetArrow } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import type { NavigationMenuItem } from '~/generated-metadata/graphql';
import { NavigationMenuItemType } from 'twenty-shared/types';
import type { NavigationMenuItemSectionListDndKitProps } from '@/navigation-menu-item/display/sections/types/NavigationMenuItemSectionListDndKitProps';
import { NavigationMenuItemDisplay } from '@/navigation-menu-item/display/components/NavigationMenuItemDisplay';
import { LEADS_PAGE_PATH } from '@/os20-leads/constants/LeadsPagePath';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.betweenSiblingsGap};
  padding-top: ${themeCssVariables.betweenSiblingsGap};
`;

type WorkspaceSectionListReadOnlyProps = Pick<
  NavigationMenuItemSectionListDndKitProps,
  'filteredItems' | 'folderChildrenById' | 'onActiveObjectMetadataItemClick'
>;

const READ_ONLY_EDIT_MODE_PROPS = {
  isSelectedInEditMode: false,
  onEditModeClick: undefined,
} as const;

export const WorkspaceSectionListReadOnly = ({
  filteredItems,
  folderChildrenById,
  onActiveObjectMetadataItemClick,
}: WorkspaceSectionListReadOnlyProps) => {
  const { t } = useLingui();
  const location = useLocation();
  const folderCount = filteredItems.filter(
    (item) => item.type === NavigationMenuItemType.FOLDER,
  ).length;

  return (
    <StyledList>
      {filteredItems.map((item: NavigationMenuItem) => (
        <NavigationMenuItemDisplay
          key={item.id}
          item={item}
          editModeProps={READ_ONLY_EDIT_MODE_PROPS}
          isDragging={false}
          folderChildrenById={folderChildrenById}
          folderCount={folderCount}
          onActiveObjectMetadataItemClick={onActiveObjectMetadataItemClick}
          readOnly
        />
      ))}
      <NavigationDrawerItem
        label={t`Leads`}
        to={LEADS_PAGE_PATH}
        Icon={IconTargetArrow}
        iconColor="orange"
        active={location.pathname === LEADS_PAGE_PATH}
      />
    </StyledList>
  );
};
