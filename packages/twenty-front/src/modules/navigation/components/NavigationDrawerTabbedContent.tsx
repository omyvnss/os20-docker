import { NavigationDrawerAiChatContent } from '@/ai/components/NavigationDrawerAiChatContent';
import { WorkflowCoreIndexPage } from '~/pages/object-core/WorkflowCoreIndexPage';
import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

type NavigationDrawerTabbedContentProps = {
  showAiChatContent: boolean;
  shouldMountAiChatContent: boolean;
  showWorkflowsContent: boolean;
  navigationContent: ReactNode;
};

const StyledTabContent = styled.div<{ isHidden: boolean }>`
  display: ${({ isHidden }) => (isHidden ? 'none' : 'contents')};
`;

export const NavigationDrawerTabbedContent = ({
  showAiChatContent,
  shouldMountAiChatContent,
  showWorkflowsContent,
  navigationContent,
}: NavigationDrawerTabbedContentProps) => {
  return (
    <>
      <StyledTabContent isHidden={showAiChatContent || showWorkflowsContent}>
        {navigationContent}
      </StyledTabContent>
      {shouldMountAiChatContent && (
        <StyledTabContent isHidden={!showAiChatContent}>
          <NavigationDrawerAiChatContent />
        </StyledTabContent>
      )}
      {showWorkflowsContent && (
        <StyledTabContent isHidden={!showWorkflowsContent}>
          <WorkflowCoreIndexPage />
        </StyledTabContent>
      )}
    </>
  );
};
