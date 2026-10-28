export function ModulePicker({
  module,
  disabled = false,
  onChange,
}: {
  module: 'maurice' | 'crimean';
  disabled?: boolean;
  onChange(): void;
}) {
  return (
    <label className="module-picker">
      <span className="sr-only">Campaign module</span>
      <select
        aria-label="Campaign module"
        value={module}
        disabled={disabled}
        title={
          disabled
            ? 'Save or discard the current draft before changing modules.'
            : 'Choose a separate campaign workspace'
        }
        onChange={onChange}
      >
        <option value="maurice">Maurice · Fontenoy</option>
        <option value="crimean">Crimean War · Free KS</option>
      </select>
    </label>
  );
}
