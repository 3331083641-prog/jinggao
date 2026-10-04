import { type HTMLAttributes, type ReactNode } from "react";

export function validateFile(
  file: File,
  extensions: readonly string[],
): string {
  if (!extensions.includes(file.name.split(".").pop()?.toLowerCase() || ""))
    return `请选择 ${extensions.map((x) => x.toUpperCase()).join(" / ")} 文件。`;
  if (file.size > 50 * 1024 * 1024) return "单个文件不能超过 50 MB。";
  if (!file.size) return "文件为空，请重新选择。";
  return "";
}

export function FilePicker({
  accept,
  onFiles,
  children,
  disabled = false,
  label,
  className = "button file-picker-button",
  onDragOver,
  onDragLeave,
  onDrop,
  multiple = false,
}: {
  accept: string;
  onFiles: (files: File[]) => void;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  className?: string;
  multiple?: boolean;
} & Pick<
  HTMLAttributes<HTMLDivElement>,
  "onDragOver" | "onDragLeave" | "onDrop"
>) {
  return (
    <div
      className={className + " file-picker-area"}
      aria-disabled={disabled}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* The native input itself receives the trusted pointer/keyboard action.
          Keep it over the whole surface; no hidden input or forwarded click. */}
      <input
        className="file-picker-input"
        type="file"
        accept={accept}
        multiple={multiple}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files || []);
          // Clear the native value even after an invalid choice, allowing same-file re-selection.
          event.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
      {children}
    </div>
  );
}
