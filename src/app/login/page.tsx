"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ShieldCheck, MapPin } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            U
          </div>
          <span className="text-xl font-bold tracking-tight text-stone-900 font-sans">
            UrjaSetu
          </span>
        </div>
        <h2 className="mt-4 text-center text-lg font-bold text-stone-900">
          Sign in to your planning workspace
        </h2>
        <p className="mt-1 text-center text-xs text-stone-500 font-mono">
          Evidence-backed urban infrastructure siting
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-stone-200 rounded-panel sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono uppercase tracking-wider font-semibold text-stone-600"
              >
                Email Address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm font-mono px-3 py-2 border border-stone-300 rounded-panel focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                  placeholder="planner@urjasetu.local"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono uppercase tracking-wider font-semibold text-stone-600"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm font-mono px-3 py-2 border border-stone-300 rounded-panel focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-btn text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 transition-colors shadow-xs"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{loading ? "Signing in..." : "Sign in"}</span>
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-stone-100 pt-4 text-center">
            <span className="text-xs text-stone-500">Don&apos;t have an account? </span>
            <Link
              href="/register"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Sign up
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-[11px] text-stone-400 max-w-xs mx-auto">
          UrjaSetu is an indicative decision-support tool. Base map & feature data: © OpenStreetMap contributors.
        </p>
      </div>
    </div>
  );
}
