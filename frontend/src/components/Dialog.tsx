import { useEffect, useRef, useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
export function Dialog({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={drawer ? "drawer-dialog" : "modal-dialog"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: drawer ? 18 : 0, y: drawer ? 0 : 8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="dialog-content"
      >
        <div className="section-title">
          <h2 id={titleId}>{title}</h2>
          <button onClick={onClose} className="icon-button" aria-label="关闭">
            <X size={17} />
          </button>
        </div>
        {children}
      </motion.div>
    </dialog>
  );
}
