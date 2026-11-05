"use client";

/**
 * Route-agnostic navigation layer ported to Next.js 14 App Router.
 * Uses next/link and next/navigation for seamless App Router compatibility.
 */

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export interface AppLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: React.ReactNode;
  className?: string;
  replace?: boolean;
}

export const AppLink: React.FC<AppLinkProps> = ({
  to,
  children,
  className = '',
  replace = false,
  ...rest
}) => {
  return (
    <Link href={to} replace={replace} className={className} {...rest}>
      {children}
    </Link>
  );
};

export function useAppNavigate() {
  const router = useRouter();
  return (to: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  };
}

export function useAppLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams ? searchParams.toString() : '';
  return {
    pathname: pathname || '/',
    search: search ? `?${search}` : '',
    hash: '',
  };
}

export function useAppSearchParams(): [URLSearchParams, (params: URLSearchParams) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = new URLSearchParams(searchParams ? searchParams.toString() : '');

  const setSearchParams = (nextParams: URLSearchParams) => {
    const qs = nextParams.toString();
    router.push(qs ? `${pathname}?${qs}` : (pathname || '/'));
  };

  return [current, setSearchParams];
}
