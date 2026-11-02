'use client';

import React from 'react';
import { User } from '@/lib/api';
import { ShieldCheck, UserCheck, GraduationCap, LogOut, LogIn } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export default function Navbar({ user, onOpenLogin, onLogout, activeTab, onSelectTab }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-b border-[#E8E5DF]" style={{ background: 'rgba(245, 242, 237, 0.90)' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('overview')}>
            <div className="w-9 h-9 rounded-xl bg-[#C9A84C] flex items-center justify-center text-white font-bold shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-semibold text-xl tracking-tight text-[#0D0D0D]">sbes.erp</span>
              <span className="hidden sm:inline-block text-[11px] text-[#52514E] font-medium ml-2 px-2 py-0.5 rounded-full bg-[#EAE5DC]">Shahbabu Society</span>
            </div>
          </div>

          {/* Navigation Links (when authenticated) */}
          {user && (
            <div className="hidden md:flex items-center gap-1 font-body text-sm font-medium">
              <button
                onClick={() => onSelectTab('overview')}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  activeTab === 'overview'
                    ? 'bg-[#0D0D0D] text-white shadow-sm'
                    : 'text-[#52514E] hover:text-[#0D0D0D] hover:bg-[#EAE5DC]'
                }`}
              >
                Overview
              </button>

              {user.role !== 'student' && (
                <>
                  <button
                    onClick={() => onSelectTab('session')}
                    className={`px-3.5 py-1.5 rounded-full transition-all ${
                      activeTab === 'session'
                        ? 'bg-[#0D0D0D] text-white shadow-sm'
                        : 'text-[#52514E] hover:text-[#0D0D0D] hover:bg-[#EAE5DC]'
                    }`}
                  >
                    Live Session
                  </button>
                  <button
                    onClick={() => onSelectTab('defaulters')}
                    className={`px-3.5 py-1.5 rounded-full transition-all ${
                      activeTab === 'defaulters'
                        ? 'bg-[#0D0D0D] text-white shadow-sm'
                        : 'text-[#52514E] hover:text-[#0D0D0D] hover:bg-[#EAE5DC]'
                    }`}
                  >
                    Defaulters
                  </button>
                  <button
                    onClick={() => onSelectTab('students')}
                    className={`px-3.5 py-1.5 rounded-full transition-all ${
                      activeTab === 'students'
                        ? 'bg-[#0D0D0D] text-white shadow-sm'
                        : 'text-[#52514E] hover:text-[#0D0D0D] hover:bg-[#EAE5DC]'
                    }`}
                  >
                    Students
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* User Pill / Login Button */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#E8E5DF] shadow-xs">
                {user.role === 'admin' ? (
                  <ShieldCheck className="w-4 h-4 text-[#C9A84C]" />
                ) : user.role === 'teacher' ? (
                  <UserCheck className="w-4 h-4 text-[#2D6A4F]" />
                ) : (
                  <GraduationCap className="w-4 h-4 text-[#1B4F72]" />
                )}
                <span className="text-xs font-semibold text-[#0D0D0D]">{user.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9E9B95] px-1.5 py-0.5 rounded bg-[#F5F2ED]">
                  {user.role}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="btn-outline text-xs px-3 py-1.5 text-[#9B2335] hover:bg-[#FBEAEB] border-[#F4D1D5]"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <button onClick={onOpenLogin} className="btn-primary text-sm py-2 px-5">
              <LogIn className="w-4 h-4" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
