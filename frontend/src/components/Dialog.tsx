import { useEffect, useRef, type ReactNode } from "react";
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
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
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
        transition={{ duration: 0.22 }}
        className="dialog-content"
      >
        <div className="section-title">
          <h2>{title}</h2>
          <button onClick={onClose} className="icon-button" aria-label="关闭">
            <X size={17} />
          </button>
        </div>
        {children}
      </motion.div>
    </dialog>
  );
}
