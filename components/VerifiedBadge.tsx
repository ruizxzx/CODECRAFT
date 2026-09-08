import React from 'react';

interface VerifiedBadgeProps {
  verified?: boolean;
  color?: string;
  className?: string;
}

/** Compact social-style verification badge: colored circle with a white check. */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ verified, color = '#2196F3', className = '' }) => {
  if (!verified) return null;
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#2196F3';
  return (
    <svg
      aria-label="Verified account"
      title="Verified account"
      viewBox="0 0 24 24"
      role="img"
      className={`inline-block shrink-0 ${className}`}
      style={{ color: safeColor }}
    >
      <circle cx="12" cy="12" r="10.5" fill="currentColor" />
      <path
        d="M7.4 12.2 10.3 15l6.5-6.3"
        fill="none"
        stroke="white"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
