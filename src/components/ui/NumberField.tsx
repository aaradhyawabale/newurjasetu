import React, { useState, useEffect } from "react";

interface NumberFieldProps {
  id?: string;
  label?: string;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
}

export const NumberField: React.FC<NumberFieldProps> = ({
  id,
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
  disabled = false,
  error,
  helperText,
  className = "",
}) => {
  const [rawValue, setRawValue] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      setRawValue(String(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextRaw = e.target.value;
    setRawValue(nextRaw);
    const val = parseFloat(nextRaw);
    if (!isNaN(val)) {
      onChange(val);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const val = parseFloat(rawValue);
    if (isNaN(val)) {
      setRawValue(String(value));
      return;
    }
    let clamped = val;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    if (clamped !== val) {
      onChange(clamped);
    }
    setRawValue(String(clamped));
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-mono uppercase tracking-wider font-medium text-stone-600 flex justify-between"
        >
          <span>{label}</span>
          {unit && <span className="text-stone-400 font-normal lowercase">{unit}</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={id}
          type="number"
          value={rawValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={`w-full font-mono text-sm px-2.5 py-1.5 rounded-panel border bg-white text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 transition-colors ${
            error
              ? "border-red-400 focus:ring-red-500 bg-red-50/20"
              : "border-stone-300 hover:border-stone-400"
          } ${disabled ? "opacity-60 bg-stone-100 cursor-not-allowed" : ""} ${
            unit ? "pr-10" : ""
          }`}
        />
        {unit && (
          <span className="absolute right-2.5 text-xs text-stone-400 pointer-events-none font-mono">
            {unit}
          </span>
        )}
      </div>

      {error ? (
        <span className="text-[11px] text-red-600 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-[11px] text-stone-500">{helperText}</span>
      ) : null}
    </div>
  );
};
