import { AlertTriangle, Archive, BadgeCheck, CircleHelp } from 'lucide-react';
import clsx from 'clsx';
import type { ApiEntry, VerificationStatus } from '../types/catalog';
import { MODEL_LABEL, VERIFICATION_LABEL, formatDate, pricingLabel } from '../lib/format';

/**
 * Verification is always conveyed by an icon AND words, never by colour alone.
 * `compact` drops the "Pricing:" prefix for dense layouts.
 */
export function VerificationBadge({ status, compact, date }: { status: VerificationStatus; compact?: boolean; date?: string | null }) {
  const Icon = status === 'verified' ? BadgeCheck : status === 'deprecated' ? Archive : status === 'reported-outdated' ? AlertTriangle : CircleHelp;
  return (
    <span
      title={date ? `Last verified ${formatDate(date)}` : undefined}
      className={clsx(
        'badge',
        status === 'verified' && 'border-ok/40 text-ok',
        status === 'needs-review' && 'border-warn/40 text-warn',
        (status === 'reported-outdated' || status === 'deprecated') && 'border-danger/40 text-danger',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {compact ? '' : 'Pricing: '}
      {VERIFICATION_LABEL[status]}
    </span>
  );
}

/** Pricing label that only reads as plain "Free"/"Freemium" when the record is verified. */
export function PricingBadge({ api }: { api: ApiEntry }) {
  const l = pricingLabel(api);
  return (
    <span title={l.title} className={clsx('badge', l.tone === 'verified' ? 'border-ok/40 text-ok' : 'border-dashed border-border-strong text-fg/80')}>
      {l.tone === 'verified' ? <BadgeCheck className="h-3 w-3" aria-hidden="true" /> : <CircleHelp className="h-3 w-3 text-muted" aria-hidden="true" />}
      {l.text}
    </span>
  );
}

/** Kept for existing call sites: the plain model name without any verification wording. */
export function ModelBadge({ api }: { api: ApiEntry }) {
  return <span className="badge">{MODEL_LABEL[api.pricing.model]}</span>;
}

export function CommercialBadge({ api }: { api: ApiEntry }) {
  const commercialUse = api.usageTerms?.commercialUse ?? 'unclear';
  const config =
    commercialUse === 'allowed'
      ? { icon: BadgeCheck, label: 'Commercial use: allowed', tone: 'border-ok/40 text-ok' }
      : commercialUse === 'restricted' || commercialUse === 'forbidden'
        ? { icon: AlertTriangle, label: 'Commercial use: restricted', tone: 'border-danger/40 text-danger' }
        : { icon: CircleHelp, label: 'Commercial use: unclear', tone: 'border-dashed border-border-strong text-fg/80' };

  const Icon = config.icon;
  return (
    <span className={clsx('badge', config.tone)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}
