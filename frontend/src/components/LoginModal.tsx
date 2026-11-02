'use client';

import React, { useState } from 'react';
import { api, User } from '@/lib/api';
import { X, Lock, Mail, ArrowRight, Shield, User as UserIcon } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await api.login(email.trim(), password);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (em: string, pw: string) => {
    setEmail(em);
    setPassword(pw);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white border border-[#E8E5DF] rounded-2xl shadow-xl p-8 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-full text-[#9E9B95] hover:text-[#0D0D0D] hover:bg-[#F5F2ED] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <span className="pill-badge mb-2">Portal Access</span>
          <h2 className="font-display text-2xl font-bold text-[#0D0D0D]">Sign in to sbes.erp</h2>
          <p className="font-body text-sm text-[#52514E] mt-1">
            Access administrator controls, faculty sessions, or student attendance.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#FBEAEB] border border-[#F4D1D5] text-xs font-medium text-[#9B2335]">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 font-body">
          <div>
            <label className="block text-xs font-semibold text-[#52514E] mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-[#9E9B95]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@sbes.edu.in"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-sm text-[#0D0D0D] focus:outline-none focus:border-[#C9A84C] focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#52514E] mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-[#9E9B95]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-sm text-[#0D0D0D] focus:outline-none focus:border-[#C9A84C] focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 mt-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick-fill testing presets */}
        <div className="mt-6 pt-5 border-t border-[#E8E5DF]">
          <p className="text-[11px] font-semibold text-[#9E9B95] uppercase tracking-wider mb-2">
            Quick-Fill Demo Credentials:
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setPreset('abdulwahabkazi89@gmail.com', 'admin123')}
              className="flex items-center justify-between text-left px-3 py-1.5 rounded-lg bg-[#F5F2ED] hover:bg-[#EAE5DC] text-xs transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium text-[#0D0D0D]">
                <Shield className="w-3.5 h-3.5 text-[#C9A84C]" />
                Admin (Abdul Wahab)
              </span>
              <span className="text-[#9E9B95] font-mono text-[11px]">admin123</span>
            </button>

            <button
              type="button"
              onClick={() => setPreset('ty-comp-a-01@students.sbes.erp', 'student123')}
              className="flex items-center justify-between text-left px-3 py-1.5 rounded-lg bg-[#F5F2ED] hover:bg-[#EAE5DC] text-xs transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium text-[#0D0D0D]">
                <UserIcon className="w-3.5 h-3.5 text-[#2D6A4F]" />
                Student (Aarav - 90%)
              </span>
              <span className="text-[#9E9B95] font-mono text-[11px]">student123</span>
            </button>

            <button
              type="button"
              onClick={() => setPreset('ty-comp-a-03@students.sbes.erp', 'student123')}
              className="flex items-center justify-between text-left px-3 py-1.5 rounded-lg bg-[#F5F2ED] hover:bg-[#EAE5DC] text-xs transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium text-[#0D0D0D]">
                <UserIcon className="w-3.5 h-3.5 text-[#9B2335]" />
                Student (Rahul - Defaulter 60%)
              </span>
              <span className="text-[#9E9B95] font-mono text-[11px]">student123</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
