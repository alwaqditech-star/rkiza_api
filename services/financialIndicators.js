function safeDivide(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

function checkThreshold(value, operator, threshold) {
  switch (operator) {
    case '<=':
      return value <= threshold;
    case '>=':
      return value >= threshold;
    default:
      return false;
  }
}

function calculateIndicators(data) {
  const {
    total_expenses = 0,
    admin_expenses = 0,
    program_expenses = 0,
    activity_admin_expenses = 0,
    total_activity_expenses = 0,
    sustainability_returns = 0,
    sustainability_expenses = 0,
    total_donations = 0,
    fundraising_expenses = 0,
    net_current_cash_investments = 0,
    estimated_annual_admin_expenses = 0,
  } = data;

  const adminRatio = safeDivide(admin_expenses, total_expenses);
  const sustainabilityReturnsRatio = safeDivide(sustainability_returns, admin_expenses);
  const programRatio = safeDivide(program_expenses, total_expenses);
  const activityAdminRatio = safeDivide(activity_admin_expenses, total_activity_expenses);
  const sustainabilityExpenseRatio = safeDivide(sustainability_expenses, total_expenses);
  const sustainabilityReturnExpenseRatio = safeDivide(sustainability_returns, sustainability_expenses);
  const fundraisingRatio = safeDivide(fundraising_expenses, total_expenses);
  const donationsRatio = safeDivide(total_donations, fundraising_expenses);
  const monthlyAdmin = safeDivide(estimated_annual_admin_expenses, 12);
  const liquidityMonths = safeDivide(net_current_cash_investments, monthlyAdmin);

  const indicators = [
    {
      id: 1,
      name: 'المصروفات الإدارية',
      weight: 0.2,
      subIndicators: [
        {
          name: 'نسبة المصروفات الإدارية إلى إجمالي المصروفات',
          value: adminRatio,
          percentage: +(adminRatio * 100).toFixed(2),
          threshold: '≤ 15%',
          passed: checkThreshold(adminRatio, '<=', 0.15),
          subWeight: 0.8,
        },
        {
          name: 'نسبة عوائد الاستدامة إلى المصروفات الإدارية',
          value: sustainabilityReturnsRatio,
          percentage: +(sustainabilityReturnsRatio * 100).toFixed(2),
          threshold: '≥ 100%',
          passed: checkThreshold(sustainabilityReturnsRatio, '>=', 1),
          subWeight: 0.2,
        },
      ],
    },
    {
      id: 2,
      name: 'برامج وأنشطة',
      weight: 0.45,
      subIndicators: [
        {
          name: 'نسبة مصروفات البرامج والأنشطة إلى إجمالي المصروفات',
          value: programRatio,
          percentage: +(programRatio * 100).toFixed(2),
          threshold: '≥ 80%',
          passed: checkThreshold(programRatio, '>=', 0.8),
          subWeight: 0.6,
        },
        {
          name: 'نسبة المصروفات الإدارية للأنشطة إلى إجمالي مصروفات الأنشطة',
          value: activityAdminRatio,
          percentage: +(activityAdminRatio * 100).toFixed(2),
          threshold: '≥ 15%',
          passed: checkThreshold(activityAdminRatio, '>=', 0.15),
          subWeight: 0.4,
        },
      ],
    },
    {
      id: 3,
      name: 'الاستدامة المالية',
      weight: 0.1,
      subIndicators: [
        {
          name: 'نسبة مصروفات الاستدامة إلى إجمالي المصروفات',
          value: sustainabilityExpenseRatio,
          percentage: +(sustainabilityExpenseRatio * 100).toFixed(2),
          threshold: '≥ 5%',
          passed: checkThreshold(sustainabilityExpenseRatio, '>=', 0.05),
          subWeight: 0.3,
        },
        {
          name: 'نسبة عوائد الاستدامة إلى مصروفات الاستدامة',
          value: sustainabilityReturnExpenseRatio,
          percentage: +(sustainabilityReturnExpenseRatio * 100).toFixed(2),
          threshold: '≥ 10%',
          passed: checkThreshold(sustainabilityReturnExpenseRatio, '>=', 0.1),
          subWeight: 0.3,
        },
      ],
    },
    {
      id: 4,
      name: 'جمع الأموال والتبرعات',
      weight: 0.1,
      subIndicators: [
        {
          name: 'نسبة مصروفات جمع الأموال إلى إجمالي المصروفات',
          value: fundraisingRatio,
          percentage: +(fundraisingRatio * 100).toFixed(2),
          threshold: '≥ 10%',
          passed: checkThreshold(fundraisingRatio, '>=', 0.1),
          subWeight: 0.5,
        },
        {
          name: 'نسبة التبرعات إلى مصروفات جمع الأموال',
          value: donationsRatio,
          percentage: +(donationsRatio * 100).toFixed(2),
          threshold: '≥ 10%',
          passed: checkThreshold(donationsRatio, '>=', 0.1),
          subWeight: 0.5,
        },
      ],
    },
    {
      id: 5,
      name: 'تغطية السيولة',
      weight: 0.15,
      subIndicators: [
        {
          name: 'أشهر تغطية المصروفات الإدارية المتوقعة',
          value: liquidityMonths,
          percentage: +liquidityMonths.toFixed(2),
          threshold: '≥ 6 أشهر',
          passed: checkThreshold(liquidityMonths, '>=', 6),
          subWeight: 1.0,
        },
      ],
    },
  ];

  let totalScore = 0;
  indicators.forEach((indicator) => {
    let indicatorScore = 0;
    indicator.subIndicators.forEach((sub) => {
      if (sub.passed) {
        indicatorScore += indicator.weight * sub.subWeight;
      }
    });
    indicator.score = +indicatorScore.toFixed(4);
    indicator.passed = indicator.subIndicators.every((s) => s.passed);
    totalScore += indicatorScore;
  });

  return {
    indicators,
    totalScore: +(totalScore * 100).toFixed(2),
    maxScore: 100,
    complianceLevel:
      totalScore >= 0.8 ? 'ممتاز' : totalScore >= 0.6 ? 'جيد' : totalScore >= 0.4 ? 'مقبول' : 'ضعيف',
  };
}

module.exports = { calculateIndicators };
