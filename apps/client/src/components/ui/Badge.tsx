'use client';

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'indigo' | 'teal' | 'rose' | 'amber' | 'neutral';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
  ...props
}: BadgeProps) {
  const variantStyles = {
    indigo:
      'border-ink-indigo/35 bg-ink-indigo/15 text-indigo-400 dark:text-indigo-300',
    teal:
      'border-ink-teal/35 bg-ink-teal/15 text-teal-600 dark:text-ink-teal',
    rose:
      'border-ink-rose/35 bg-ink-rose/15 text-rose-600 dark:text-ink-rose',
    amber:
      'border-ink-amber/35 bg-ink-amber/15 text-amber-600 dark:text-ink-amber',
    neutral:
      'border-surface-border bg-surface-elevated/70 text-paper-muted',
  }[variant];

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-1',
    md: 'px-2 py-0.5 text-xs gap-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-md font-mono border font-medium select-none tracking-tight shrink-0 ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children}
    </span>
  );
}
