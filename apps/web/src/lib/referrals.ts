import type { SupabaseClient } from '@supabase/supabase-js';

import type { CustomerTargetContext } from '@/lib/wallet-coupons';

type AdminClient = SupabaseClient<any>;

export type ReferralProgramRow = {
  id: string;
  name: string;
  is_active: boolean;
  referrer_reward_amount: number;
  referee_reward_amount: number;
  min_referee_topup_amount: number;
  valid_from: string | null;
  valid_to: string | null;
  community_ids: string[] | null;
  cities: string[] | null;
  max_referrals_per_referrer: number | null;
  share_message_template: string | null;
};

export type ReferralAttributionRow = {
  id: string;
  program_id: string;
  referrer_id: string;
  referee_id: string;
  referral_code: string;
  status: 'pending' | 'rewarded' | 'expired' | 'cancelled';
  qualifying_topup_amount: number | null;
  referrer_wallet_txn_id: string | null;
  referee_wallet_txn_id: string | null;
  rewarded_at: string | null;
  created_at: string;
};

export function isProgramGenerallyValid(
  program: ReferralProgramRow,
  now = new Date(),
): boolean {
  if (!program.is_active) return false;
  if (program.valid_from && new Date(program.valid_from) > now) return false;
  if (program.valid_to && new Date(program.valid_to) < now) return false;
  return true;
}

export function matchesProgramTarget(
  program: ReferralProgramRow,
  ctx: CustomerTargetContext,
): boolean {
  const communities = program.community_ids ?? [];
  if (communities.length > 0) {
    if (!ctx.communityId || !communities.includes(ctx.communityId)) return false;
  }

  const cities = (program.cities ?? [])
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (cities.length > 0) {
    const city = ctx.city?.trim().toLowerCase() ?? '';
    if (!city || !cities.includes(city)) return false;
  }

  return true;
}

export async function getActiveReferralProgram(
  admin: AdminClient,
  ctx: CustomerTargetContext,
): Promise<ReferralProgramRow | null> {
  const { data, error } = await admin
    .from('referral_programs')
    .select(
      'id, name, is_active, referrer_reward_amount, referee_reward_amount, min_referee_topup_amount, valid_from, valid_to, community_ids, cities, max_referrals_per_referrer, share_message_template',
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data?.length) return null;

  for (const row of data as ReferralProgramRow[]) {
    if (!isProgramGenerallyValid(row)) continue;
    if (!matchesProgramTarget(row, ctx)) continue;
    return row;
  }

  return null;
}

function buildReferralCode(fullName: string | null, userId: string): string {
  const letters = (fullName ?? '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4);
  const prefix = letters.length >= 2 ? letters : 'USER';
  const suffix = userId.replace(/-/g, '').slice(-4).toUpperCase();
  return `${prefix}${suffix}`;
}

export async function ensureReferralCode(
  admin: AdminClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await admin
    .from('profiles')
    .select('referral_code, full_name')
    .eq('id', userId)
    .maybeSingle();

  const existing = (profile as { referral_code: string | null } | null)
    ?.referral_code;
  if (existing?.trim()) return existing.trim().toUpperCase();

  const fullName =
    (profile as { full_name: string | null } | null)?.full_name ?? null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code =
      attempt === 0
        ? buildReferralCode(fullName, userId)
        : `${buildReferralCode(fullName, userId)}${attempt}`;

    const { data: updated, error } = await admin
      .from('profiles')
      .update({
        referral_code: code,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .is('referral_code', null)
      .select('referral_code')
      .maybeSingle();

    const saved = (updated as { referral_code: string | null } | null)
      ?.referral_code;
    if (!error && saved) return saved.toUpperCase();

    // Race: another request may have set it.
    const { data: raced } = await admin
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .maybeSingle();
    const racedCode = (raced as { referral_code: string | null } | null)
      ?.referral_code;
    if (racedCode) return racedCode.toUpperCase();
  }

  throw new Error('Could not generate referral code');
}

export function buildShareMessage(
  program: ReferralProgramRow,
  code: string,
): string {
  const template =
    program.share_message_template?.trim() ||
    'Join IronCloud with my code {{code}} and get ₹{{referee_reward}} after your first wallet recharge of ₹{{min_topup}}+!';

  return template
    .replace(/\{\{code\}\}/g, code)
    .replace(
      /\{\{referee_reward\}\}/g,
      String(Number(program.referee_reward_amount)),
    )
    .replace(
      /\{\{referrer_reward\}\}/g,
      String(Number(program.referrer_reward_amount)),
    )
    .replace(
      /\{\{min_topup\}\}/g,
      String(Number(program.min_referee_topup_amount)),
    );
}

export type ApplyReferralResult =
  | { ok: true; attributionId: string }
  | { ok: false; message: string };

export async function applyReferralAtSignup(
  admin: AdminClient,
  refereeId: string,
  rawCode: string,
  ctx: CustomerTargetContext,
): Promise<ApplyReferralResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, message: 'Referral code is required.' };

  const program = await getActiveReferralProgram(admin, ctx);
  if (!program) {
    return { ok: false, message: 'No active referral program right now.' };
  }

  const { data: existing } = await admin
    .from('referral_attributions')
    .select('id')
    .eq('referee_id', refereeId)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: 'Referral already applied for this account.' };
  }

  const { data: referrer } = await admin
    .from('profiles')
    .select('id, referral_code, role')
    .eq('referral_code', code)
    .maybeSingle();

  if (!referrer) {
    return { ok: false, message: 'Invalid referral code.' };
  }

  const referrerId = (referrer as { id: string }).id;
  if (referrerId === refereeId) {
    return { ok: false, message: 'You cannot use your own referral code.' };
  }

  if (program.max_referrals_per_referrer != null) {
    const { count } = await admin
      .from('referral_attributions')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .eq('program_id', program.id);

    if ((count ?? 0) >= Number(program.max_referrals_per_referrer)) {
      return {
        ok: false,
        message: 'This referral code has reached its limit.',
      };
    }
  }

  const { data: inserted, error } = await admin
    .from('referral_attributions')
    .insert({
      program_id: program.id,
      referrer_id: referrerId,
      referee_id: refereeId,
      referral_code: code,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !inserted) {
    if (error?.code === '23505') {
      return { ok: false, message: 'Referral already applied for this account.' };
    }
    return { ok: false, message: error?.message || 'Failed to apply referral.' };
  }

  return { ok: true, attributionId: (inserted as { id: string }).id };
}

export type ValidateReferralResult =
  | {
      valid: true;
      referrerName: string | null;
      program: {
        name: string;
        referrerReward: number;
        refereeReward: number;
        minTopup: number;
      };
    }
  | { valid: false; message: string };

export async function validateReferralCode(
  admin: AdminClient,
  refereeId: string | null,
  rawCode: string,
  ctx: CustomerTargetContext,
): Promise<ValidateReferralResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, message: 'Enter a referral code.' };

  const program = await getActiveReferralProgram(admin, ctx);
  if (!program) {
    return { valid: false, message: 'No active referral program right now.' };
  }

  const { data: referrer } = await admin
    .from('profiles')
    .select('id, full_name, referral_code')
    .eq('referral_code', code)
    .maybeSingle();

  if (!referrer) {
    return { valid: false, message: 'Invalid referral code.' };
  }

  const referrerId = (referrer as { id: string }).id;
  if (refereeId && referrerId === refereeId) {
    return { valid: false, message: 'You cannot use your own referral code.' };
  }

  if (refereeId) {
    const { data: existing } = await admin
      .from('referral_attributions')
      .select('id')
      .eq('referee_id', refereeId)
      .maybeSingle();
    if (existing) {
      return {
        valid: false,
        message: 'Referral already applied for this account.',
      };
    }
  }

  if (program.max_referrals_per_referrer != null) {
    const { count } = await admin
      .from('referral_attributions')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .eq('program_id', program.id);

    if ((count ?? 0) >= Number(program.max_referrals_per_referrer)) {
      return {
        valid: false,
        message: 'This referral code has reached its limit.',
      };
    }
  }

  const fullName = (referrer as { full_name: string | null }).full_name;
  return {
    valid: true,
    referrerName: fullName?.trim() || null,
    program: {
      name: program.name,
      referrerReward: Number(program.referrer_reward_amount),
      refereeReward: Number(program.referee_reward_amount),
      minTopup: Number(program.min_referee_topup_amount),
    },
  };
}

async function creditWalletCashback(
  admin: AdminClient,
  customerId: string,
  amount: number,
  description: string,
): Promise<{ txnId: string; balance: number } | null> {
  if (amount <= 0) return null;

  const { data: wallet, error: walletError } = await admin
    .from('wallets')
    .select('id, balance')
    .eq('customer_id', customerId)
    .single();

  if (walletError || !wallet) return null;

  const balance =
    Math.round((Number(wallet.balance) + amount) * 100) / 100;

  const { data: txn, error: txnError } = await admin
    .from('wallet_transactions')
    .insert({
      wallet_id: (wallet as { id: string }).id,
      type: 'cashback',
      amount,
      balance_after: balance,
      description,
    })
    .select('id')
    .single();

  if (txnError || !txn) return null;

  const { error: updateError } = await admin
    .from('wallets')
    .update({ balance, updated_at: new Date().toISOString() })
    .eq('id', (wallet as { id: string }).id);

  if (updateError) return null;

  return { txnId: (txn as { id: string }).id, balance };
}

/**
 * After a successful wallet recharge, pay referral rewards when:
 * - referee has a pending attribution
 * - top-up amount meets program minimum
 * - no earlier recharge already met that minimum
 */
export async function maybeRewardReferral(
  admin: AdminClient,
  refereeId: string,
  topupAmount: number,
  rechargeTxnId: string,
): Promise<{ rewarded: boolean; referrerBonus: number; refereeBonus: number }> {
  const empty = { rewarded: false, referrerBonus: 0, refereeBonus: 0 };

  const { data: attribution } = await admin
    .from('referral_attributions')
    .select(
      'id, program_id, referrer_id, referee_id, status',
    )
    .eq('referee_id', refereeId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!attribution) return empty;

  const attr = attribution as {
    id: string;
    program_id: string;
    referrer_id: string;
    referee_id: string;
  };

  const { data: program } = await admin
    .from('referral_programs')
    .select(
      'id, referrer_reward_amount, referee_reward_amount, min_referee_topup_amount',
    )
    .eq('id', attr.program_id)
    .maybeSingle();

  if (!program) return empty;

  const minTopup = Number(
    (program as { min_referee_topup_amount: number }).min_referee_topup_amount,
  );
  if (topupAmount < minTopup) return empty;

  // Only the first qualifying recharge should pay out. If an earlier recharge
  // already met the minimum, leave attribution pending for manual review.
  const { data: wallet } = await admin
    .from('wallets')
    .select('id')
    .eq('customer_id', refereeId)
    .maybeSingle();

  if (!wallet) return empty;

  const { data: priorRecharges } = await admin
    .from('wallet_transactions')
    .select('id, amount')
    .eq('wallet_id', (wallet as { id: string }).id)
    .eq('type', 'recharge')
    .neq('id', rechargeTxnId);

  const alreadyQualified = (priorRecharges ?? []).some(
    (tx) => Number((tx as { amount: number }).amount) >= minTopup,
  );
  if (alreadyQualified) return empty;

  const referrerBonus = Number(
    (program as { referrer_reward_amount: number }).referrer_reward_amount,
  );
  const refereeBonus = Number(
    (program as { referee_reward_amount: number }).referee_reward_amount,
  );

  const refereeCredit = await creditWalletCashback(
    admin,
    refereeId,
    refereeBonus,
    'Referral welcome bonus',
  );

  const referrerCredit = await creditWalletCashback(
    admin,
    attr.referrer_id,
    referrerBonus,
    'Referral reward',
  );

  // If both rewards are zero, still mark rewarded after qualifying top-up.
  if (
    (refereeBonus > 0 && !refereeCredit) ||
    (referrerBonus > 0 && !referrerCredit)
  ) {
    console.error('[referrals] Failed to credit referral cashback', {
      attributionId: attr.id,
      rechargeTxnId,
    });
    return empty;
  }

  const { error: updateError } = await admin
    .from('referral_attributions')
    .update({
      status: 'rewarded',
      qualifying_topup_amount: topupAmount,
      referrer_wallet_txn_id: referrerCredit?.txnId ?? null,
      referee_wallet_txn_id: refereeCredit?.txnId ?? null,
      rewarded_at: new Date().toISOString(),
    })
    .eq('id', attr.id)
    .eq('status', 'pending');

  if (updateError) {
    console.error('[referrals] Failed to mark attribution rewarded', updateError);
    return empty;
  }

  return {
    rewarded: true,
    referrerBonus,
    refereeBonus,
  };
}
