import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  label: string;
  align?: 'center' | 'end';
  children: React.ReactNode;
}

export function Tooltip({ label, align = 'center', children }: Props) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: align === 'end' ? rect.right : rect.left + rect.width / 2,
      y: rect.bottom + 7,
    });
  };

  return (
    <>
      <span
        ref={anchorRef}
        className="tooltip-anchor"
        onMouseEnter={show}
        onMouseLeave={() => setPosition(null)}
        onFocusCapture={show}
        onBlurCapture={() => setPosition(null)}
      >
        {children}
      </span>
      {position && createPortal(
        <span
          className={`floating-tooltip ${align}`}
          style={{ left: position.x, top: position.y }}
          role="tooltip"
        >
          {label}
        </span>,
        document.body
      )}
    </>
  );
}
