// Зарезервовано для Етапу 4 (P1-P2): Піксельна сітка та українська вишиванка
// Детальний план: fix_tech_patch/future_plans/STAGE_4_ENGINES_CURRICULUM_1_12_AND_CARTRIDGES.md

export interface PixelEmbroiderySpec {
  rows: number;
  cols: number;
  symmetry: 'none' | 'mirror_x' | 'mirror_xy';
}
