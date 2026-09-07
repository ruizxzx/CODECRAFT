import React from 'react';
import { BadgeCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  verified?: boolean;
  color?: string;
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ verified, color = '#2196F3', className = '' }) => {
  if (!verified) return null;
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#2196F3';
  return <BadgeCheck aria-label="Verified account" title="Verified account" className={className} style={{ color: safeColor, fill: safeColor }} />;
};
