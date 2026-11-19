/**
 * Contract specification for Pluggable Interactive Engines
 */
import type { ReactionZone } from './campaign.contract';

export interface EngineProps<TConfig = Record<string, any>, TState = any> {
  config: TConfig & { reactionZones?: ReactionZone[] };
  initialState?: TState;
  onStateChange?: (state: TState) => void;
  onSubmitAnswer?: (answer?: any) => void;
  isReadOnly?: boolean;
}

export interface EngineAdapter<TConfig = Record<string, any>, TState = any> {
  engineId: string;
  title: string;
  description: string;
  component: React.ComponentType<EngineProps<TConfig, TState>>;
}
