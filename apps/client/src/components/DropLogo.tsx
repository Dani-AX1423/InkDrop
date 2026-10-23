'use client';

import React, { useState } from 'react';

interface DropLogoProps {
  className?: string;
  size?: number;
}

export function DropLogo({ className = '', size = 28 }: DropLogoProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center justify-center cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: size, height: size }}
      title="InkDrop"
    >
      {/* Background soft ink bloom */}
      <div
        className={`absolute inset-0 rounded-full bg-ink-indigo/25 blur-md transition-opacity duration-300 ${
          isHovered ? 'scale-150 opacity-100 bg-ink-indigo/40' : 'scale-90 opacity-60'
        }`}
      />

      {/* Ripple ring on hover */}
      {isHovered && (
        <span
          className="absolute inset-0 rounded-full border border-ink-indigo/60 animate-ink-ripple pointer-events-none"
        />
      )}

      {/* SVG Ink Drop Teardrop */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative transition-transform duration-300 ${
          isHovered ? 'scale-110 -translate-y-0.5' : 'scale-100'
        }`}
        style={{ width: size * 0.85, height: size * 0.85 }}
      >
        <defs>
          <linearGradient id="inkTeardropGradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7E7EFF" />
            <stop offset="0.6" stopColor="#5B5BFF" />
            <stop offset="1" stopColor="#2DD4BF" />
          </linearGradient>
          <filter id="softInkGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Organic ink teardrop shape */}
        <path
          d="M12 2.5C12 2.5 5 11.2 5 16C5 19.866 8.13401 23 12 23C15.866 23 19 19.866 19 16C19 11.2 12 2.5 12 2.5Z"
          fill="url(#inkTeardropGradient)"
          filter="url(#softInkGlow)"
        />

        {/* Subtle interior highlight gloss */}
        <path
          d="M9 14.5C9 12 11 9 11 9"
          stroke="#EDE8DC"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.45"
        />
      </svg>
    </div>
  );
}
