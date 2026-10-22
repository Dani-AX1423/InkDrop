'use client';

import React, { useState, useRef, ButtonHTMLAttributes } from 'react';

interface RipplePoint {
  x: number;
  y: number;
  id: number;
}

interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'rose';
  size?: 'sm' | 'md' | 'lg';
}

export function RippleButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<RipplePoint[]>([]);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rippleCountRef = useRef(0);

  const removeRipple = (id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++rippleCountRef.current;

      setRipples((prev) => [...prev.slice(-3), { x, y, id }]);
    }

    onClick?.(e);
  };

  const variantStyles = {
    primary:
      'bg-ink-indigo text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#4D4DEB] hover:-translate-y-px active:translate-y-0 active:scale-[0.99] border border-indigo-400/20',
    secondary:
      'bg-surface-elevated text-paper-white hover:bg-surface-elevated/80 hover:border-surface-border-hover border border-surface-border hover:-translate-y-px active:translate-y-0 active:scale-[0.99]',
    ghost:
      'bg-transparent text-paper-muted hover:text-paper-white hover:bg-surface-elevated/60 active:scale-[0.99]',
    rose:
      'bg-ink-rose/15 text-ink-rose hover:bg-ink-rose/25 border border-ink-rose/30 active:scale-[0.99]',
  }[variant];

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs rounded-lg h-8',
    md: 'px-4 py-2 text-xs sm:text-sm rounded-xl h-10',
    lg: 'px-6 py-2.5 text-sm sm:text-base rounded-xl font-medium h-11',
  }[size];

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`relative overflow-hidden inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {/* Expanding Pointer Ripple: Outer wrapper handles position; inner span handles scale from 0 */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
          style={{
            left: r.x,
            top: r.y,
            width: 80,
            height: 80,
            contain: 'layout paint style',
          }}
        >
          <span
            onAnimationEnd={() => removeRipple(r.id)}
            className="block w-full h-full rounded-full bg-white/20 animate-btn-ripple"
          />
        </span>
      ))}

      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
