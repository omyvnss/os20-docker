import { type I18n } from '@lingui/core';
import { Column, Container, Row } from 'react-email';
import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
};

export const Footer = ({ i18n }: FooterProps) => {
  return (
    <Container style={footerContainerStyle}>
      <Row>
        <Column>
          <ShadowText>
            <Link
              href="https://os20.git11.xyz/"
              value={i18n._('Website')}
              aria-label={i18n._("Visit OS20's website")}
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href="https://github.com/omyvnss/os20"
              value={i18n._('Github')}
              aria-label={i18n._("Visit OS20's GitHub repository")}
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href="https://github.com/omyvnss/os20#readme"
              value={i18n._('Docs')}
              aria-label={i18n._("Read OS20's documentation")}
            />
          </ShadowText>
        </Column>
      </Row>
      <ShadowText>{i18n._('OS20 by Om Yaduvanshi (git11), India')}</ShadowText>
    </Container>
  );
};
