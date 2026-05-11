"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, ariaLabelledBy, children }: ModalProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            className="modal"
            initial={{ y: reduceMotion ? 0 : 60 }}
            animate={{ y: 0 }}
            exit={{ y: reduceMotion ? 0 : 60 }}
            transition={{
              duration: reduceMotion ? 0 : 0.32,
              ease: [0.2, 0.7, 0.2, 1],
            }}
          >
            <div className="grabber" aria-hidden="true" />
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
