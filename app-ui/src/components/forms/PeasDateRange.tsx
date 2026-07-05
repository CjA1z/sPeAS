import { Input } from "../ui/input";

interface PeasDateRangeProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export function PeasDateRange({ from, to, onFromChange, onToChange }: PeasDateRangeProps) {
  return (
    <div className="peas-date-range" aria-label="Date range">
      <label>
        <span>From</span>
        <Input type="date" value={from} onChange={(event) => onFromChange(event.currentTarget.value)} />
      </label>
      <label>
        <span>To</span>
        <Input type="date" value={to} onChange={(event) => onToChange(event.currentTarget.value)} />
      </label>
    </div>
  );
}
