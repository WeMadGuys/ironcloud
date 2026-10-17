import type { CommunityStage } from '@ironcloud/db';
import type { BadgeVariant } from '@ironcloud/ui';

export const COMMUNITY_STAGES: { value: CommunityStage; label: string; badge: BadgeVariant }[] = [
  { value: 'lead', label: 'Lead', badge: 'default' },
  { value: 'contacted', label: 'Contacted', badge: 'info' },
  { value: 'meeting_scheduled', label: 'Meeting scheduled', badge: 'info' },
  { value: 'approved', label: 'Approved by society/FM', badge: 'purple' },
  { value: 'onboarding', label: 'Stall / onboarding', badge: 'warning' },
  { value: 'active', label: 'Active', badge: 'success' },
  { value: 'paused', label: 'Paused', badge: 'warning' },
  { value: 'lost', label: 'Lost', badge: 'error' },
];

const stageByValue = new Map(COMMUNITY_STAGES.map((stage) => [stage.value, stage]));

export const stageLabel = (stage: string | null | undefined) =>
  (stage && stageByValue.get(stage as CommunityStage)?.label) || stage || '—';

export const stageBadge = (stage: string | null | undefined): BadgeVariant =>
  (stage && stageByValue.get(stage as CommunityStage)?.badge) || 'default';
