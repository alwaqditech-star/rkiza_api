import type { SafetyFinancialInput } from '@/lib/types';

export type SafetyPolarity = '+' | '-';
export type SafetyCondition = '>=' | '<=';

export interface SafetyIndicatorDef {
  id: number;
  name: string;
  polar: SafetyPolarity;
  weight: number;
  unit: string;
  cond: SafetyCondition;
  limit: number;
  calc: (d: SafetyData) => number | null;
}

export interface SafetyAxisDef {
  id: string;
  name: string;
  weight: number;
  color: string;
  bg: string;
  indicators: SafetyIndicatorDef[];
}

export interface SafetyData {
  totalExp: number;
  adminExp: number;
  progExp: number;
  progAdminExp: number;
  totalProgExp: number;
  sustRev: number;
  sustExp: number;
  sustAssets: number;
  totalDon: number;
  fundExp: number;
  cash: number;
  restricted: number;
  waqfCash: number;
  currLiab: number;
  netCashInv: number;
  estAdmin: number;
}

export interface SafetyIndicatorResult extends SafetyIndicatorDef {
  val: number | null;
  pass: boolean | null;
}

export interface SafetyAxisResult extends Omit<SafetyAxisDef, 'indicators'> {
  indicators: SafetyIndicatorResult[];
  axisPct: number;
  axisContrib: number;
}

export interface SafetyCalculationResult {
  axes: SafetyAxisResult[];
  totalScore: number;
  pct: number;
  scoreClass: ReturnType<typeof scoreClass>;
  scoreLabel: ReturnType<typeof scoreLabel>;
  passCount: number;
  failCount: number;
  naCount: number;
}

/** Five axes, eleven indicators — weights per engineering plan PDF. */
export const SAFETY_AXES: SafetyAxisDef[] = [
  {
    id: 'admin',
    name: 'المصاريف الإدارية',
    weight: 0.2,
    color: 'var(--teal)',
    bg: 'var(--teal-pale)',
    indicators: [
      {
        id: 1,
        name: 'نسبة المصاريف الإدارية إلى إجمالي المصاريف',
        polar: '-',
        weight: 0.8,
        unit: '%',
        cond: '<=',
        limit: 15,
        calc: (d) => (d.totalExp > 0 ? (d.adminExp / d.totalExp) * 100 : null),
      },
      {
        id: 2,
        name: 'نسبة عوائد الاستدامة المالية إلى المصاريف الإدارية',
        polar: '+',
        weight: 0.2,
        unit: '%',
        cond: '>=',
        limit: 100,
        calc: (d) => (d.adminExp > 0 ? (d.sustRev / d.adminExp) * 100 : null),
      },
    ],
  },
  {
    id: 'prog',
    name: 'مصاريف البرامج والأنشطة',
    weight: 0.45,
    color: 'var(--emerald)',
    bg: 'var(--emerald-pale)',
    indicators: [
      {
        id: 3,
        name: 'نسبة مصاريف البرامج والأنشطة إلى إجمالي المصاريف',
        polar: '+',
        weight: 0.6,
        unit: '%',
        cond: '>=',
        limit: 80,
        calc: (d) => (d.totalExp > 0 ? (d.progExp / d.totalExp) * 100 : null),
      },
      {
        id: 4,
        name: 'نسبة المصاريف الإدارية للنشاط إلى إجمالي مصاريف النشاط',
        polar: '-',
        weight: 0.4,
        unit: '%',
        cond: '<=',
        limit: 15,
        calc: (d) =>
          d.totalProgExp > 0 ? (d.progAdminExp / d.totalProgExp) * 100 : null,
      },
    ],
  },
  {
    id: 'sust',
    name: 'الاستدامة المالية (أوقاف واستثمارات)',
    weight: 0.1,
    color: 'var(--gold)',
    bg: 'var(--gold-pale)',
    indicators: [
      {
        id: 5,
        name: 'نسبة مصاريف الاستدامة إلى إجمالي المصاريف',
        polar: '-',
        weight: 0.3,
        unit: '%',
        cond: '<=',
        limit: 5,
        calc: (d) => (d.totalExp > 0 ? (d.sustExp / d.totalExp) * 100 : null),
      },
      {
        id: 6,
        name: 'نسبة مصاريف الاستدامة إلى عوائد الاستدامة',
        polar: '-',
        weight: 0.3,
        unit: '%',
        cond: '<=',
        limit: 10,
        calc: (d) => (d.sustRev > 0 ? (d.sustExp / d.sustRev) * 100 : null),
      },
      {
        id: 7,
        name: 'نسبة عوائد الاستدامة إلى إجمالي أصول الاستدامة',
        polar: '+',
        weight: 0.4,
        unit: '%',
        cond: '>=',
        limit: 7.5,
        calc: (d) =>
          d.sustAssets > 0 ? (d.sustRev / d.sustAssets) * 100 : null,
      },
    ],
  },
  {
    id: 'fund',
    name: 'جمع الأموال والتبرعات',
    weight: 0.1,
    color: 'var(--ruby)',
    bg: 'var(--ruby-pale)',
    indicators: [
      {
        id: 8,
        name: 'نسبة مصاريف جمع الأموال إلى إجمالي المصاريف',
        polar: '-',
        weight: 0.5,
        unit: '%',
        cond: '<=',
        limit: 5,
        calc: (d) => (d.totalExp > 0 ? (d.fundExp / d.totalExp) * 100 : null),
      },
      {
        id: 9,
        name: 'نسبة مصاريف جمع الأموال إلى إجمالي التبرعات',
        polar: '-',
        weight: 0.5,
        unit: '%',
        cond: '<=',
        limit: 10,
        calc: (d) => (d.totalDon > 0 ? (d.fundExp / d.totalDon) * 100 : null),
      },
    ],
  },
  {
    id: 'liq',
    name: 'قدرة الجمعية على تغطية الالتزامات المستقبلية',
    weight: 0.15,
    color: 'var(--slate)',
    bg: 'var(--fog)',
    indicators: [
      {
        id: 10,
        name: 'نسبة النقد إلى (الأصول المقيدة + الأوقاف + الالتزامات المتداولة)',
        polar: '+',
        weight: 0.7,
        unit: '%',
        cond: '>=',
        limit: 100,
        calc: (d) => {
          const denom = d.restricted + d.waqfCash + d.currLiab;
          return denom > 0 ? (d.cash / denom) * 100 : null;
        },
      },
      {
        id: 11,
        name: 'نسبة صافي النقد والاستثمارات المتداولة إلى المصاريف الإدارية (بالأشهر)',
        polar: '+',
        weight: 0.3,
        unit: 'شهر',
        cond: '>=',
        limit: 12,
        calc: (d) => (d.estAdmin > 0 ? d.netCashInv / (d.estAdmin / 12) : null),
      },
    ],
  },
];

export function safetyInputToData(input: Partial<SafetyFinancialInput>): SafetyData {
  return {
    totalExp: Number(input.total_expenses ?? 0),
    adminExp: Number(input.admin_expenses ?? 0),
    progExp: Number(input.program_expenses ?? 0),
    progAdminExp: Number(input.activity_admin_expenses ?? 0),
    totalProgExp: Number(input.total_activity_expenses ?? 0),
    sustRev: Number(input.sustainability_returns ?? 0),
    sustExp: Number(input.sustainability_expenses ?? 0),
    sustAssets: Number(input.sustainability_assets ?? 0),
    totalDon: Number(input.total_donations ?? 0),
    fundExp: Number(input.fundraising_expenses ?? 0),
    cash: Number(input.cash_equivalents ?? 0),
    restricted: Number(input.net_restricted_assets ?? 0),
    waqfCash: Number(input.net_endowment_cash ?? 0),
    currLiab: Number(input.current_liabilities ?? 0),
    netCashInv: Number(input.net_current_cash_investments ?? 0),
    estAdmin: Number(input.estimated_annual_admin_expenses ?? 0),
  };
}

export function scoreClass(pct: number): 'excellent' | 'good' | 'medium' | 'poor' {
  if (pct >= 85) return 'excellent';
  if (pct >= 65) return 'good';
  if (pct >= 40) return 'medium';
  return 'poor';
}

export function scoreLabel(pct: number): string {
  if (pct >= 85) return 'ممتاز';
  if (pct >= 65) return 'جيد';
  if (pct >= 40) return 'متوسط';
  return 'يحتاج تحسين';
}

export function calcSafety(data: SafetyData): SafetyCalculationResult {
  let totalScore = 0;
  const axisResults: SafetyAxisResult[] = [];

  for (const axis of SAFETY_AXES) {
    let axisScore = 0;
    let axisWeight = 0;
    const indResults: SafetyIndicatorResult[] = [];

    for (const ind of axis.indicators) {
      const val = ind.calc(data);
      let pass: boolean | null = null;

      if (val !== null) {
        pass = ind.cond === '>=' ? val >= ind.limit : val <= ind.limit;
      }

      indResults.push({ ...ind, val, pass });

      if (val !== null) {
        if (pass) axisScore += ind.weight;
        axisWeight += ind.weight;
      }
    }

    const axisPct = axisWeight > 0 ? axisScore / axisWeight : 0;
    const axisContrib = axisPct * axis.weight;
    totalScore += axisContrib;

    axisResults.push({
      ...axis,
      indicators: indResults,
      axisPct,
      axisContrib,
    });
  }

  const pct = Math.round(totalScore * 100);
  const allIndicators = axisResults.flatMap((a) => a.indicators);

  return {
    axes: axisResults,
    totalScore,
    pct,
    scoreClass: scoreClass(pct),
    scoreLabel: scoreLabel(pct),
    passCount: allIndicators.filter((i) => i.pass === true).length,
    failCount: allIndicators.filter((i) => i.pass === false).length,
    naCount: allIndicators.filter((i) => i.pass === null).length,
  };
}

export function calcSafetyFromInput(
  input: Partial<SafetyFinancialInput>,
): SafetyCalculationResult {
  return calcSafety(safetyInputToData(input));
}
