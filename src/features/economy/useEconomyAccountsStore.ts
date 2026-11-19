// Етап 3 (P1): Керування розділеними рахунками (Поточний / Резерв / Інвестиції) і захист від накрутки
// Детальний план: fix_tech_patch/future_plans/STAGE_3_ECONOMY_CAPTCHA_AND_FINANCE.md

import { create } from 'zustand';
import type {
  EconomyAccountBucket,
  EconomyAccountSnapshot,
  EconomyAccountsStateSnapshot,
  EconomySplitRule,
  EconomyTransaction,
  PracticalResourcesSnapshot,
} from './economy.types';

const ECONOMY_STORAGE_KEY = 'edu_economy_accounts_v1';
const MAX_TRANSACTIONS = 24;
const MAX_SIGNATURES = 600;

export const DEFAULT_HINT_OPERATING_COST = 15;

export const BUCKET_LABELS: Record<EconomyAccountBucket, string> = {
  operating: 'Операційний бюджет',
  reserve: 'Резервний фонд',
  investment: 'Інвестиційний капітал',
};

const createInitialSnapshot = (): EconomyAccountsStateSnapshot => ({
  accounts: {
    operating: 60,
    reserve: 40,
    investment: 20,
  },
  practical: {
    details: 4,
    tokens: 2,
  },
  splitRule: {
    operatingRatio: 0.5,
    reserveRatio: 0.25,
    investmentRatio: 0.25,
  },
  rewardedSignatures: [],
  transactions: [],
  rewardGameTokensClaimedKeys: [],
});

const persistSnapshot = (snap: EconomyAccountsStateSnapshot) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ECONOMY_STORAGE_KEY, JSON.stringify(snap));
    }
  } catch {
    // Ignore storage quota errors
  }
};

const loadInitialSnapshot = (): EconomyAccountsStateSnapshot => {
  const defaults = createInitialSnapshot();
  if (typeof localStorage === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(ECONOMY_STORAGE_KEY);
    if (!raw) {
      persistSnapshot(defaults);
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<EconomyAccountsStateSnapshot>;
    const snap: EconomyAccountsStateSnapshot = {
      accounts: {
        operating: Math.max(0, Number(parsed.accounts?.operating ?? defaults.accounts.operating)),
        reserve: Math.max(0, Number(parsed.accounts?.reserve ?? defaults.accounts.reserve)),
        investment: Math.max(0, Number(parsed.accounts?.investment ?? defaults.accounts.investment)),
      },
      practical: {
        details: Math.max(0, Number(parsed.practical?.details ?? defaults.practical.details)),
        tokens: Math.max(0, Number(parsed.practical?.tokens ?? defaults.practical.tokens)),
      },
      splitRule: {
        operatingRatio: Number(parsed.splitRule?.operatingRatio ?? defaults.splitRule.operatingRatio),
        reserveRatio: Number(parsed.splitRule?.reserveRatio ?? defaults.splitRule.reserveRatio),
        investmentRatio: Number(parsed.splitRule?.investmentRatio ?? defaults.splitRule.investmentRatio),
      },
      rewardedSignatures: Array.isArray(parsed.rewardedSignatures)
        ? parsed.rewardedSignatures.slice(-MAX_SIGNATURES)
        : [],
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions.slice(-MAX_TRANSACTIONS)
        : [],
      rewardGameTokensClaimedKeys: Array.isArray(parsed.rewardGameTokensClaimedKeys)
        ? parsed.rewardGameTokensClaimedKeys.slice(-200)
        : [],
    };
    return snap;
  } catch {
    return defaults;
  }
};

interface DepositEarningsParams {
  signature: string;
  baseAmount: number;
  details?: number;
  tokens?: number;
  label: string;
  kind?: 'task_earn' | 'variant_earn' | 'quest_bonus';
}

interface DepositResult {
  awarded: boolean;
  credited: EconomyAccountSnapshot;
  detailsCredited: number;
  tokensCredited: number;
}

interface SpendHintResult {
  ok: boolean;
  remainingOperating: number;
}

interface TransferResult {
  ok: boolean;
  message: string;
}

interface EconomyAccountsStore extends EconomyAccountsStateSnapshot {
  setSplitRule: (rule: EconomySplitRule) => void;
  hasRewardSignature: (signature: string) => boolean;
  depositEarnings: (params: DepositEarningsParams) => DepositResult;
  spendOperatingForHint: (cost?: number, label?: string) => SpendHintResult;
  transferBetweenBuckets: (
    from: EconomyAccountBucket,
    to: EconomyAccountBucket,
    amount: number,
    allowReserveOverride?: boolean
  ) => TransferResult;
  claimRewardGameBonus: (claimKey: string, tokensAmount?: number, operatingAmount?: number, label?: string) => boolean;
  spendInvestmentForUnlock: (investmentCost: number, label: string) => boolean;
  importEconomyState: (partial?: Partial<EconomyAccountsStateSnapshot>) => void;
  resetAccounts: () => void;
}

const makeTx = (
  kind: EconomyTransaction['kind'],
  bucket: EconomyAccountBucket,
  amount: number,
  label: string
): EconomyTransaction => ({
  id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  timestamp: Date.now(),
  kind,
  bucket,
  amount,
  label,
});

export const useEconomyAccountsStore = create<EconomyAccountsStore>((set, get) => ({
  ...loadInitialSnapshot(),

  setSplitRule: (rule) => {
    const sum = rule.operatingRatio + rule.reserveRatio + rule.investmentRatio;
    if (sum <= 0) return;
    const normalized: EconomySplitRule = {
      operatingRatio: rule.operatingRatio / sum,
      reserveRatio: rule.reserveRatio / sum,
      investmentRatio: rule.investmentRatio / sum,
    };
    set((state) => {
      const next: EconomyAccountsStateSnapshot = {
        accounts: state.accounts,
        practical: state.practical,
        splitRule: normalized,
        rewardedSignatures: state.rewardedSignatures,
        transactions: state.transactions,
        rewardGameTokensClaimedKeys: state.rewardGameTokensClaimedKeys,
      };
      persistSnapshot(next);
      return next;
    });
  },

  hasRewardSignature: (signature) => get().rewardedSignatures.includes(signature),

  depositEarnings: ({ signature, baseAmount, details = 0, tokens = 0, label, kind = 'task_earn' }) => {
    const state = get();
    if (!signature || state.rewardedSignatures.includes(signature)) {
      return {
        awarded: false,
        credited: { operating: 0, reserve: 0, investment: 0 },
        detailsCredited: 0,
        tokensCredited: 0,
      };
    }

    const cleanBase = Math.max(0, Math.round(baseAmount));
    const opAmt = Math.max(1, Math.round(cleanBase * state.splitRule.operatingRatio));
    const resAmt = Math.max(0, Math.round(cleanBase * state.splitRule.reserveRatio));
    const invAmt = Math.max(0, cleanBase - opAmt - resAmt);

    const credited: EconomyAccountSnapshot = {
      operating: opAmt,
      reserve: resAmt,
      investment: invAmt,
    };

    const nextAccounts: EconomyAccountSnapshot = {
      operating: state.accounts.operating + credited.operating,
      reserve: state.accounts.reserve + credited.reserve,
      investment: state.accounts.investment + credited.investment,
    };

    const nextPractical: PracticalResourcesSnapshot = {
      details: state.practical.details + Math.max(0, details),
      tokens: state.practical.tokens + Math.max(0, tokens),
    };

    const nextSignatures = [...state.rewardedSignatures, signature].slice(-MAX_SIGNATURES);
    const nextTransactions = [
      ...state.transactions,
      makeTx(kind, 'operating', credited.operating, `${label} (+${credited.operating} опер.)`),
    ].slice(-MAX_TRANSACTIONS);

    const nextSnap: EconomyAccountsStateSnapshot = {
      accounts: nextAccounts,
      practical: nextPractical,
      splitRule: state.splitRule,
      rewardedSignatures: nextSignatures,
      transactions: nextTransactions,
      rewardGameTokensClaimedKeys: state.rewardGameTokensClaimedKeys,
    };

    persistSnapshot(nextSnap);
    set(nextSnap);

    return {
      awarded: true,
      credited,
      detailsCredited: Math.max(0, details),
      tokensCredited: Math.max(0, tokens),
    };
  },

  spendOperatingForHint: (cost = DEFAULT_HINT_OPERATING_COST, label = 'Пряма підказка до задачі') => {
    const cleanCost = Math.max(1, Math.round(cost));
    const state = get();
    // Strictly deduct ONLY from the operational account; never raid reserve automatically
    if (state.accounts.operating < cleanCost) {
      return { ok: false, remainingOperating: state.accounts.operating };
    }

    const nextOperating = state.accounts.operating - cleanCost;
    const nextSnap: EconomyAccountsStateSnapshot = {
      accounts: {
        ...state.accounts,
        operating: nextOperating,
      },
      practical: state.practical,
      splitRule: state.splitRule,
      rewardedSignatures: state.rewardedSignatures,
      transactions: [
        ...state.transactions,
        makeTx('hint_spend', 'operating', -cleanCost, label),
      ].slice(-MAX_TRANSACTIONS),
      rewardGameTokensClaimedKeys: state.rewardGameTokensClaimedKeys,
    };

    persistSnapshot(nextSnap);
    set(nextSnap);
    return { ok: true, remainingOperating: nextOperating };
  },

  transferBetweenBuckets: (from, to, amount, allowReserveOverride = false) => {
    const cleanAmt = Math.max(0, Math.round(amount));
    if (cleanAmt <= 0 || from === to) {
      return { ok: false, message: 'Вкажіть коректну суму та різні рахунки.' };
    }

    const state = get();
    if (state.accounts[from] < cleanAmt) {
      return { ok: false, message: `Недостатньо коштів на рахунку «${BUCKET_LABELS[from]}».` };
    }

    if (from === 'reserve' && !allowReserveOverride) {
      return {
        ok: false,
        message: 'Резервний фонд захищено від витрат на підказки. Підтвердьте переказ лише за крайньої потреби.',
      };
    }

    const nextAccounts: EconomyAccountSnapshot = {
      ...state.accounts,
      [from]: state.accounts[from] - cleanAmt,
      [to]: state.accounts[to] + cleanAmt,
    };

    const nextSnap: EconomyAccountsStateSnapshot = {
      accounts: nextAccounts,
      practical: state.practical,
      splitRule: state.splitRule,
      rewardedSignatures: state.rewardedSignatures,
      transactions: [
        ...state.transactions,
        makeTx('transfer', to, cleanAmt, `${BUCKET_LABELS[from]} → ${BUCKET_LABELS[to]}`),
      ].slice(-MAX_TRANSACTIONS),
      rewardGameTokensClaimedKeys: state.rewardGameTokensClaimedKeys,
    };

    persistSnapshot(nextSnap);
    set(nextSnap);
    return { ok: true, message: `Переказано ${cleanAmt} до «${BUCKET_LABELS[to]}».` };
  },

  claimRewardGameBonus: (claimKey, tokensAmount = 1, operatingAmount = 10, label = 'Міні-гра нагорода') => {
    const state = get();
    if (!claimKey || state.rewardGameTokensClaimedKeys.includes(claimKey)) {
      return false;
    }

    const nextSnap: EconomyAccountsStateSnapshot = {
      accounts: {
        ...state.accounts,
        operating: state.accounts.operating + Math.max(0, operatingAmount),
      },
      practical: {
        ...state.practical,
        tokens: state.practical.tokens + Math.max(0, tokensAmount),
      },
      splitRule: state.splitRule,
      rewardedSignatures: state.rewardedSignatures,
      transactions: [
        ...state.transactions,
        makeTx('reward_game', 'operating', Math.max(0, operatingAmount), `${label} (+${tokensAmount} 🪙)`),
      ].slice(-MAX_TRANSACTIONS),
      rewardGameTokensClaimedKeys: [...state.rewardGameTokensClaimedKeys, claimKey].slice(-200),
    };

    persistSnapshot(nextSnap);
    set(nextSnap);
    return true;
  },

  spendInvestmentForUnlock: (investmentCost, label) => {
    const cleanCost = Math.max(1, Math.round(investmentCost));
    const state = get();
    if (state.accounts.investment < cleanCost) return false;

    const nextSnap: EconomyAccountsStateSnapshot = {
      accounts: {
        ...state.accounts,
        investment: state.accounts.investment - cleanCost,
      },
      practical: state.practical,
      splitRule: state.splitRule,
      rewardedSignatures: state.rewardedSignatures,
      transactions: [
        ...state.transactions,
        makeTx('reward_game', 'investment', -cleanCost, label),
      ].slice(-MAX_TRANSACTIONS),
      rewardGameTokensClaimedKeys: state.rewardGameTokensClaimedKeys,
    };

    persistSnapshot(nextSnap);
    set(nextSnap);
    return true;
  },

  importEconomyState: (partial) => {
    if (!partial) return;
    const base = createInitialSnapshot();
    const merged: EconomyAccountsStateSnapshot = {
      accounts: {
        ...base.accounts,
        ...(partial.accounts || {}),
      },
      practical: {
        ...base.practical,
        ...(partial.practical || {}),
      },
      splitRule: partial.splitRule || base.splitRule,
      rewardedSignatures: Array.isArray(partial.rewardedSignatures)
        ? partial.rewardedSignatures.slice(-MAX_SIGNATURES)
        : [],
      transactions: Array.isArray(partial.transactions)
        ? partial.transactions.slice(-MAX_TRANSACTIONS)
        : [],
      rewardGameTokensClaimedKeys: Array.isArray(partial.rewardGameTokensClaimedKeys)
        ? partial.rewardGameTokensClaimedKeys
        : [],
    };
    persistSnapshot(merged);
    set(merged);
  },

  resetAccounts: () => {
    const fresh = createInitialSnapshot();
    persistSnapshot(fresh);
    set(fresh);
  },
}));
