'use client';

import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string | null;
  currentLength?: number;
  maxLength?: number;
  showCounter?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      currentLength,
      maxLength,
      showCounter = false,
      leftIcon,
      rightIcon,
      id,
      className = '',
      autoComplete = 'off',
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasCounter = showCounter && maxLength !== undefined;
    const isNearLimit = hasCounter && currentLength !== undefined && currentLength >= maxLength * 0.85;

    return (
      <div className="w-full space-y-1.5">
        {(label || hasCounter) && (
          <div className="flex items-center justify-between gap-2 text-xs">
            {label && (
              <label
                htmlFor={inputId}
                className="font-sans font-medium text-paper-muted select-none cursor-pointer"
              >
                {label}
              </label>
            )}
            {hasCounter && (
              <span
                className={`font-mono text-[10px] transition-colors ${
                  isNearLimit ? 'text-ink-amber font-semibold' : 'text-paper-muted'
                }`}
              >
                {currentLength ?? 0} / {maxLength}
              </span>
            )}
          </div>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 text-paper-muted flex items-center">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            autoComplete={autoComplete}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            className={`w-full h-11 rounded-xl border bg-surface-base/90 px-3.5 text-sm text-paper-white placeholder-paper-faint transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ink-indigo focus:ring-offset-2 focus:ring-offset-water-deep disabled:opacity-40 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${
              error
                ? 'border-ink-rose/60 focus:ring-ink-rose'
                : 'border-surface-border hover:border-surface-border-hover'
            } ${className}`}
            maxLength={maxLength}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3.5 text-paper-muted flex items-center">
              {rightIcon}
            </span>
          )}
        </div>

        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-[11px] font-sans text-ink-rose flex items-center gap-1.5 animate-fade-in"
          >
            <span className="inline-block h-1 w-1 rounded-full bg-ink-rose shrink-0" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="text-[11px] font-sans text-paper-muted leading-tight">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string | null;
  currentLength?: number;
  maxLength?: number;
  showCounter?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      currentLength,
      maxLength,
      showCounter = false,
      id,
      className = '',
      autoComplete = 'off',
      disabled,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasCounter = showCounter && maxLength !== undefined;
    const isNearLimit = hasCounter && currentLength !== undefined && currentLength >= maxLength * 0.85;

    return (
      <div className="w-full space-y-1.5">
        {(label || hasCounter) && (
          <div className="flex items-center justify-between gap-2 text-xs">
            {label && (
              <label
                htmlFor={textareaId}
                className="font-sans font-medium text-paper-muted select-none cursor-pointer"
              >
                {label}
              </label>
            )}
            {hasCounter && (
              <span
                className={`font-mono text-[10px] transition-colors ${
                  isNearLimit ? 'text-ink-amber font-semibold' : 'text-paper-muted'
                }`}
              >
                {currentLength ?? 0} / {maxLength}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : helperText
              ? `${textareaId}-helper`
              : undefined
          }
          className={`w-full rounded-xl border bg-surface-base/90 p-3 text-sm text-paper-white placeholder-paper-faint transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ink-indigo focus:ring-offset-2 focus:ring-offset-water-deep resize-none disabled:opacity-40 disabled:cursor-not-allowed ${
            error
              ? 'border-ink-rose/60 focus:ring-ink-rose'
              : 'border-surface-border hover:border-surface-border-hover'
          } ${className}`}
          maxLength={maxLength}
          {...props}
        />

        {error ? (
          <p
            id={`${textareaId}-error`}
            role="alert"
            className="text-[11px] font-sans text-ink-rose flex items-center gap-1.5 animate-fade-in"
          >
            <span className="inline-block h-1 w-1 rounded-full bg-ink-rose shrink-0" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p id={`${textareaId}-helper`} className="text-[11px] font-sans text-paper-muted leading-tight">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
