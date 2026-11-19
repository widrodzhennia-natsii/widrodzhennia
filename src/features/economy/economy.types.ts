// Етап 3 (P1): Розширена економіка ресурсів, практичні ресурси та розділені рахунки учня
// Детальний план: fix_tech_patch/future_plans/STAGE_3_ECONOMY_CAPTCHA_AND_FINANCE.md

export type EconomyAccountBucket = 'operating' | 'reserve' | 'investment';

export interface EconomyAccountSnapshot {
  operating: number;
  reserve: number;
  investment: number;
}

export interface PracticalResourcesSnapshot {
  details: number;
  tokens: number;
}

export interface EconomySplitRule {
  operatingRatio: number;
  reserveRatio: number;
  investmentRatio: number;
}

export type EconomyTransactionKind =
  | 'task_earn'
  | 'variant_earn'
  | 'quest_bonus'
  | 'hint_spend'
  | 'transfer'
  | 'reward_game';

export interface EconomyTransaction {
  id: string;
  timestamp: number;
  kind: EconomyTransactionKind;
  bucket: EconomyAccountBucket;
  amount: number;
  label: string;
}

export interface EconomyAccountsStateSnapshot {
  accounts: EconomyAccountSnapshot;
  practical: PracticalResourcesSnapshot;
  splitRule: EconomySplitRule;
  rewardedSignatures: string[];
  transactions: EconomyTransaction[];
  rewardGameTokensClaimedKeys: string[];
}
