import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { IconAlertTriangle, IconBuildingSkyscraper } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { EmailStatusChip } from '@/os20-contacts/components/EmailStatusChip';
import { type Os20CompanyContactsResult } from '@/os20-contacts/types/Os20CompanyContactsResult';

const StyledCompany = styled.section`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledCompanyHeader = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledCompanyIcon = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
`;

const StyledCompanyName = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledCounts = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledList = styled.ul`
  display: flex;
  flex-direction: column;
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledPerson = styled.li<{ isSaved: boolean }>`
  align-items: center;
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto;
  opacity: ${({ isSaved }) => (isSaved ? 1 : 0.64)};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledIdentity = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const StyledTruncated = styled.span<{ isMuted?: boolean }>`
  color: ${({ isMuted }) =>
    isMuted
      ? themeCssVariables.font.color.tertiary
      : themeCssVariables.font.color.primary};
  font-size: ${({ isMuted }) =>
    isMuted ? themeCssVariables.font.size.sm : themeCssVariables.font.size.md};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledEmail = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledStatus = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const StyledNote = styled.p<{ isError?: boolean }>`
  align-items: center;
  border-top: 1px solid ${themeCssVariables.border.color.light};
  color: ${({ isError }) =>
    isError
      ? themeCssVariables.font.color.danger
      : themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  margin: 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

type FindContactsCompanyResultProps = {
  result: Os20CompanyContactsResult;
  fallbackName?: string;
};

export const FindContactsCompanyResult = ({
  result,
  fallbackName,
}: FindContactsCompanyResultProps) => {
  const { t } = useLingui();
  const companyName = result.companyName || fallbackName || t`Unnamed company`;
  const createdCount = result.created;
  const skippedCount = result.skipped;

  return (
    <StyledCompany aria-label={companyName}>
      <StyledCompanyHeader>
        <StyledCompanyIcon>
          <IconBuildingSkyscraper size={16} />
        </StyledCompanyIcon>
        <StyledCompanyName title={companyName}>{companyName}</StyledCompanyName>
        {result.error === undefined && (
          <StyledCounts>
            {skippedCount > 0
              ? t`${createdCount} added, ${skippedCount} skipped`
              : t`${createdCount} added`}
          </StyledCounts>
        )}
      </StyledCompanyHeader>
      {result.error !== undefined && (
        <StyledNote role="alert" isError>
          <IconAlertTriangle size={14} />
          {result.error}
        </StyledNote>
      )}
      {result.error === undefined && result.people.length === 0 && (
        <StyledNote>{t`No people found on this company's website.`}</StyledNote>
      )}
      {result.people.length > 0 && (
        <StyledList>
          {result.people.map((person, index) => (
            <StyledPerson
              key={person.id ?? `${person.name}-${person.email ?? index}`}
              isSaved={person.saved}
            >
              <StyledIdentity>
                <StyledTruncated title={person.name}>
                  {person.name}
                </StyledTruncated>
                {(person.jobTitle || !person.saved) && (
                  <StyledTruncated isMuted>
                    {person.saved
                      ? person.jobTitle
                      : (person.reason ?? t`Skipped`)}
                  </StyledTruncated>
                )}
              </StyledIdentity>
              <StyledEmail title={person.email ?? undefined}>
                {person.email ?? t`No email`}
              </StyledEmail>
              <StyledStatus>
                {person.emailStatus && (
                  <EmailStatusChip status={person.emailStatus} />
                )}
              </StyledStatus>
            </StyledPerson>
          ))}
        </StyledList>
      )}
    </StyledCompany>
  );
};
