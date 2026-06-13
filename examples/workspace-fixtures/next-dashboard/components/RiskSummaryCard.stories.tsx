import type { Meta, StoryObj } from '@storybook/react';
import { RiskSummaryCard } from './RiskSummaryCard';

const meta = {
  title: 'Risk Dashboard/RiskSummaryCard',
  component: RiskSummaryCard,
} satisfies Meta<typeof RiskSummaryCard>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: {
    title: 'Synthetic exposure',
    value: '42%',
    tone: 'warning',
  },
};
