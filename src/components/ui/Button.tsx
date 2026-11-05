"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

  const variants = {
    primary:
      'bg-[#0F5C63] text-white hover:bg-[#0A3E43] active:bg-[#072B2E] shadow-sm focus-visible:ring-[#0F5C63]',
    secondary:
      'bg-[#14212B] text-white hover:bg-[#1E303D] active:bg-[#0A1218] shadow-sm focus-visible:ring-[#14212B]',
    outline:
      'border border-[#D1D5DB] bg-white text-[#14212B] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] focus-visible:ring-[#0F5C63]',
    ghost:
      'text-[#14212B] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] focus-visible:ring-[#0F5C63]',
    danger:
      'bg-[#D64530] text-white hover:bg-[#B83724] active:bg-[#9B2E1E] shadow-sm focus-visible:ring-[#D64530]',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-4 py-2 gap-2 h-10',
    lg: 'text-base px-5 py-2.5 gap-2.5 h-12',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
