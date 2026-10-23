'use client';

import React, { useRef, ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      onClick,
      className = '',
      variant = 'primary',
      size = 'md',
      disabled = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLButtonElement | null>(null);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return;

      const target = internalRef.current;
      if (target) {
        // Create ripple directly in DOM without React state
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Cap concurrent ripples to 2
        const existingRipples = target.querySelectorAll('.btn-ripple-container');
        if (existingRipples.length >= 2) {
          existingRipples[0].remove();
        }

        const container = document.createElement('span');
        container.className = 'btn-ripple-container absolute pointer-events-none rounded-full';
        container.style.left = `${x}px`;
        container.style.top = `${y}px`;
        container.style.width = '80px';
        container.style.height = '80px';
        container.style.marginLeft = '-40px';
        container.style.marginTop = '-40px';

        const ring = document.createElement('span');
        ring.className = 'block w-full h-full rounded-full bg-white/20 animate-btn-ripple';
        ring.addEventListener('animationend', () => container.remove(), { once: true });

        container.appendChild(ring);
        target.appendChild(container);
      }

      onClick?.(e);
    };

    const variantStyles = {
      primary:
        'bg-ink-indigo text-white border border-indigo-400/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#4D4DEB] active:scale-[0.98]',
      secondary:
        'bg-surface-elevated text-paper-white border border-surface-border hover:border-surface-border-hover hover:bg-surface-elevated/80 active:scale-[0.98]',
      ghost:
        'bg-transparent text-paper-muted hover:text-paper-white hover:bg-surface-elevated/60 active:scale-[0.98]',
      danger:
        'bg-ink-rose/15 text-ink-rose border border-ink-rose/30 hover:bg-ink-rose/25 active:scale-[0.98]',
    }[variant];

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-10 px-4 text-xs sm:text-sm rounded-xl gap-2',
      lg: 'h-11 sm:h-12 px-5 sm:px-6 text-sm font-medium rounded-xl gap-2.5',
      icon: 'h-10 w-10 sm:h-11 sm:w-11 p-0 rounded-xl flex items-center justify-center',
    }[size];

    return (
      <button
        ref={(node) => {
          internalRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type={type}
        disabled={disabled || isLoading}
        onClick={handleClick}
        className={`relative inline-flex items-center justify-center overflow-hidden font-medium tracking-tight select-none transition-colors transition-transform transition-opacity duration-150 cursor-pointer min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-water-deep disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="relative z-10 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            {children && <span>{children}</span>}
          </span>
        ) : (
          <span className="relative z-10 flex items-center justify-center gap-2">
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
