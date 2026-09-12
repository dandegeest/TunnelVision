import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

const CLICK_TO_EDIT_CLASS =
  "resize-y rounded border border-[#3a342c]/50 bg-transparent px-2.5 py-2 outline-none focus:border-[#3a342c] focus:bg-[#161410] focus-visible:border-[#ece7df] disabled:cursor-default disabled:opacity-40";

/**
 * Looks like static copy until focused. Keystrokes commit through onChange.
 * Unmount flushes any leftover DOM value so leaving B for C keeps B's edit.
 */
export function ClickToEditTextarea({
  value,
  onChange,
  disabled = false,
  className,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "readOnly"> & {
  value: string;
  onChange?: (value: string) => void;
}) {
  const editable = Boolean(onChange) && !disabled;
  const ref = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    return () => {
      const next = ref.current?.value;
      if (next !== undefined && next !== valueRef.current) {
        onChangeRef.current?.(next);
      }
    };
  }, []);

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      readOnly={!editable}
      disabled={disabled}
      className={`${CLICK_TO_EDIT_CLASS}${className ? ` ${className}` : ""}`}
      onChange={(event) => onChange?.(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}
