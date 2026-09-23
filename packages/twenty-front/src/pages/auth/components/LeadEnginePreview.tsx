import { styled } from '@linaria/react';
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from 'framer-motion';
import { useEffect, useId, useState } from 'react';

type PreviewLead = {
  company: string;
  domain: string;
  score: number;
};

// Illustrative sample rows for the sign-in preview, not real data.
const PREVIEW_LEADS: PreviewLead[] = [
  { company: 'Northwind Labs', domain: 'northwindlabs.io', score: 94 },
  { company: 'Harbor & Pine', domain: 'harborpine.co', score: 88 },
  { company: 'Kite Analytics', domain: 'kiteanalytics.com', score: 81 },
  { company: 'Meridian Dental', domain: 'meridiandental.com', score: 73 },
];

const FIRST_ROW_DELAY_MS = 1100;
const ROW_INTERVAL_MS = 1300;
const CYCLE_HOLD_MS = 3400;

const CHART_LINE =
  'M0 118 C 36 114, 64 98, 104 100 S 170 76, 214 78 S 284 48, 324 52 S 396 22, 440 16';
const CHART_AREA = `${CHART_LINE} L 440 150 L 0 150 Z`;

const StyledPanel = styled.div`
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: max(0.875rem, 0.9722vw);
  box-shadow: 0 30px 70px -40px rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
  max-width: 460px;
  padding: 24px;
  width: 100%;
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 11px;
  justify-content: space-between;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const StyledHeaderLabel = styled.span`
  color: #6c6b6b;
`;

const StyledLive = styled.span`
  align-items: center;
  color: #8300e9;
  display: inline-flex;
  gap: 6px;
`;

const StyledLiveDot = styled(motion.span)`
  background: #8300e9;
  border-radius: 50%;
  display: inline-block;
  height: 6px;
  width: 6px;
`;

const StyledChart = styled.svg`
  display: block;
  height: auto;
  margin: 20px 0 8px;
  overflow: visible;
  width: 100%;
`;

const StyledRows = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 212px;
  list-style: none;
  margin: 0;
  overflow: hidden;
  padding: 0;
`;

const StyledRow = styled(motion.li)`
  align-items: center;
  border-top: 1px solid #ededed;
  display: grid;
  gap: 12px;
  grid-template-columns: 28px minmax(0, 1fr) 72px 28px;
  padding-top: 10px;
`;

const StyledAvatar = styled.span`
  align-items: center;
  background: #f4ecfe;
  border-radius: 8px;
  color: #8300e9;
  display: flex;
  font-size: 12px;
  font-weight: 600;
  height: 28px;
  justify-content: center;
  width: 28px;
`;

const StyledCompany = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const StyledCompanyName = styled.span`
  color: #111;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledDomain = styled.span`
  color: #6c6b6b;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledBarTrack = styled.span`
  background: #ededed;
  border-radius: 999px;
  display: block;
  height: 4px;
  overflow: hidden;
`;

const StyledBarFill = styled(motion.span)`
  background: linear-gradient(90deg, #8300e9, #b154f9);
  border-radius: 999px;
  display: block;
  height: 100%;
`;

const StyledScore = styled.span`
  color: #111;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 13px;
  text-align: right;
`;

const ScoreCounter = ({
  value,
  isStatic,
}: {
  value: number;
  isStatic: boolean;
}) => {
  const [displayed, setDisplayed] = useState(isStatic ? value : 0);

  useEffect(() => {
    if (isStatic) {
      setDisplayed(value);
      return;
    }

    const controls = animate(0, value, {
      duration: 0.9,
      delay: 0.15,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayed(Math.round(latest)),
    });

    return () => controls.stop();
  }, [value, isStatic]);

  return <>{displayed}</>;
};

export const LeadEnginePreview = () => {
  const gradientId = useId();
  const isStatic = useReducedMotion() === true;
  const [cycle, setCycle] = useState(0);
  const [visibleCount, setVisibleCount] = useState(
    isStatic ? PREVIEW_LEADS.length : 0,
  );

  useEffect(() => {
    if (isStatic) {
      return;
    }

    const isFull = visibleCount >= PREVIEW_LEADS.length;
    const delay = isFull
      ? CYCLE_HOLD_MS
      : visibleCount === 0
        ? FIRST_ROW_DELAY_MS
        : ROW_INTERVAL_MS;

    const timer = setTimeout(() => {
      if (isFull) {
        setVisibleCount(0);
        setCycle((current) => current + 1);
      } else {
        setVisibleCount((current) => current + 1);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleCount, isStatic]);

  const lineGradientId = `${gradientId}-line`;
  const areaGradientId = `${gradientId}-area`;

  return (
    <StyledPanel aria-hidden="true">
      <StyledHeader>
        <StyledHeaderLabel>Lead engine</StyledHeaderLabel>
        <StyledLive>
          <StyledLiveDot
            animate={isStatic ? undefined : { opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          Scoring
        </StyledLive>
      </StyledHeader>

      <StyledChart viewBox="0 0 440 150" role="presentation">
        <defs>
          <linearGradient id={lineGradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8300e9" />
            <stop offset="100%" stopColor="#b154f9" />
          </linearGradient>
          <linearGradient id={areaGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b154f9" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#b154f9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 80, 120].map((y) => (
          <line
            key={y}
            x1="0"
            x2="440"
            y1={y}
            y2={y}
            stroke="#ededed"
            strokeDasharray="2 6"
          />
        ))}
        <motion.path
          key={`area-${cycle}`}
          d={CHART_AREA}
          fill={`url(#${areaGradientId})`}
          initial={{ opacity: isStatic ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        />
        <motion.path
          key={`line-${cycle}`}
          d={CHART_LINE}
          fill="none"
          stroke={`url(#${lineGradientId})`}
          strokeLinecap="round"
          strokeWidth="2.5"
          initial={{ pathLength: isStatic ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.circle
          key={`dot-${cycle}`}
          cx="440"
          cy="16"
          r="4"
          fill="#8300e9"
          initial={{ opacity: isStatic ? 1 : 0, scale: isStatic ? 1 : 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 1.3 }}
        />
      </StyledChart>

      <StyledRows>
        <AnimatePresence initial={false}>
          {PREVIEW_LEADS.slice(0, visibleCount).map((lead) => (
            <StyledRow
              key={`${cycle}-${lead.domain}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            >
              <StyledAvatar>{lead.company.charAt(0)}</StyledAvatar>
              <StyledCompany>
                <StyledCompanyName>{lead.company}</StyledCompanyName>
                <StyledDomain>{lead.domain}</StyledDomain>
              </StyledCompany>
              <StyledBarTrack>
                <StyledBarFill
                  initial={{ width: isStatic ? `${lead.score}%` : '0%' }}
                  animate={{ width: `${lead.score}%` }}
                  transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
                />
              </StyledBarTrack>
              <StyledScore>
                <ScoreCounter value={lead.score} isStatic={isStatic} />
              </StyledScore>
            </StyledRow>
          ))}
        </AnimatePresence>
      </StyledRows>
    </StyledPanel>
  );
};
