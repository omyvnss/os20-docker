export const sanitizeURL = (link: string | null | undefined) => {
  return link
    ? link.replace(/(https?:\/\/)|(www\.)/g, '').replace(/\/$/, '')
    : '';
};

// OS20 is local-first: company domains are never sent to a third-party logo
// service, so avatars fall back to the company initial.
export const getLogoUrlFromDomainName = (
  _domainName?: string,
): string | undefined => undefined;
