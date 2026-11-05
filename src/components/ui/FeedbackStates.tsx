"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, FolderOpen, RefreshCw, X } from 'lucide-react';
import { Button } from './Button';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 rounded-md ${className}`}
    />
  );
};

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`text-center p-8 bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
        {icon || <FolderOpen className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-bold text-[#14212B]">{title}</h3>
      <p className="mt-1 text-xs text-slate-600 max-w-sm leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load data',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`p-6 bg-red-50 border border-red-200 rounded-xl text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-red-100 text-[#D64530] flex items-center justify-center mb-2">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-bold text-[#D64530]">{title}</h3>
      <p className="mt-1 text-xs text-slate-700 max-w-md">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          className="mt-3 bg-white"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};

export interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  const styles = {
    info: 'bg-slate-900 text-white',
    success: 'bg-[#0F5C63] text-white',
    warning: 'bg-amber-800 text-white',
    error: 'bg-[#D64530] text-white',
  }[type];

  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 ${styles}`}
    >
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:opacity-80 transition-opacity"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
