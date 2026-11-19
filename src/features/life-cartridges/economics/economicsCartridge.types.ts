// Зарезервовано для подальшої деталізації (Етап 3+): Автономний картридж «Фінансова грамотність та Економіка»
// Детальний план: fix_tech_patch/future_plans/ECONOMICS_CARTRIDGE_FUTURE_PLAN.md

import type { EconomyAccountSnapshot } from '../../economy/economy.types';

export type EconomicsModuleId = 'utilities' | 'purchase_xray' | 'inflation_ovdp' | 'business_unit';

export interface EconomicsScenarioContract {
  id: string;
  module: EconomicsModuleId;
  title: string;
  initialAccounts: EconomyAccountSnapshot;
}
