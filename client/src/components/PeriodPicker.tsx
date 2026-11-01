interface PeriodPickerProps { year: number; month: number; onChange: (year: number, month: number) => void }

export function PeriodPicker({ year, month, onChange }: PeriodPickerProps) {
  return <label className="period-picker"><span className="sr-only">Select month</span><input type="month" value={`${year}-${String(month).padStart(2, '0')}`} onChange={(event) => { const [nextYear, nextMonth] = event.target.value.split('-').map(Number); onChange(nextYear, nextMonth) }} /></label>
}
