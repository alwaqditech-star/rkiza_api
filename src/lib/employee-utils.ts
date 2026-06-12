export function calcEmployeeTotals(row: {
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  commission: number;
  gosi_percent: number;
}) {
  const gross =
    Number(row.basic_salary) +
    Number(row.housing_allowance) +
    Number(row.transport_allowance) +
    Number(row.commission);
  const gosiAmount = Number(row.basic_salary) * (Number(row.gosi_percent) / 100);
  return {
    gross_salary: gross,
    gosi_amount: gosiAmount,
    net_salary: gross - gosiAmount,
  };
}
