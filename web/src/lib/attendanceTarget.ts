/**
 * Meta semanal de permanência. ÚNICA definição do valor em todo o dashboard:
 * KPIs, filtros, relatórios e a regra de conformidade leem daqui.
 */
export const WEEKLY_TARGET_SECONDS = 4 * 3600;

/** Rótulo curto da meta, para textos de interface (ex.: "4h"). */
export const WEEKLY_TARGET_LABEL = `${WEEKLY_TARGET_SECONDS / 3600}h`;
