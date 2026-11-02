'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import LoginModal from '@/components/LoginModal';
import OverviewView from '@/components/OverviewView';
import LiveSessionView from '@/components/LiveSessionView';
import DefaultersView from '@/components/DefaultersView';
import StudentsView from '@/components/StudentsView';
import { api, User, ClassItem } from '@/lib/api';
import { ArrowRight, Shield, Sparkles, Radio, BookOpen, AlertOctagon, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('ty-comp-a');
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loadClassesForUser = () => {
    api
      .getClasses()
      .then((cls) => {
        setClasses(cls);
        if (cls.length > 0) {
          setSelectedClassId(cls[0].id);
        }
      })
      .catch((err) => {
        console.error('Classes load error:', err);
      });
  };

  useEffect(() => {
    setMounted(true);
    // Restore session
    const savedUser = localStorage.getItem('sbes_user');
    const savedToken = localStorage.getItem('sbes_token');
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        loadClassesForUser();
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setClasses([]);
    setActiveTab('overview');
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setActiveTab('overview');
    loadClassesForUser();
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F2ED] selection:bg-[#C9A84C]/20">
      {/* Navbar */}
      <Navbar
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 pt-24 pb-16 w-full">
        {/* If Not Logged In, Show PathAI-style Landing Showcase */}
        {!user ? (
          <div className="space-y-12">
            {/* Hero Section */}
            <div className="py-12 md:py-16 text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider text-[#52514E] bg-[#EAE5DC] border border-[#E8E5DF]">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" />
                Shahbabu Educational Society Attendance ERP
              </div>

              <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-[#0D0D0D] leading-[1.1]">
                Biometric &amp; RFID Attendance, <br />
                <em className="font-normal italic text-[#C9A84C]">reimagined.</em>
              </h1>

              <p className="font-body text-base md:text-lg text-[#52514E] leading-relaxed max-w-2xl mx-auto">
                Real-time ESP32 hardware scan integration, automated 75% statutory shortage tracking,
                and instant student attendance intelligence.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="btn-primary py-3 px-8 text-base shadow-md cursor-pointer"
                >
                  <span>Open Portal Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 text-xs font-mono text-[#52514E] bg-white px-4 py-2.5 rounded-full border border-[#E8E5DF]">
                  <span className="w-2 h-2 rounded-full bg-[#2D6A4F] animate-pulse" />
                  API Live: http://localhost:5000
                </div>
              </div>
            </div>

            {/* Feature Cards Grid (PathAI Style) */}
            <div className="grid md:grid-cols-3 gap-6 pt-4">
              <div className="card-luxury p-6 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-[#EBF5EE] text-[#2D6A4F] flex items-center justify-center mb-4">
                    <Radio className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#0D0D0D] mb-2">
                    Hardware ESP32 RFID
                  </h3>
                  <p className="text-xs text-[#52514E] leading-relaxed">
                    Zero-latency student card tapping. Instant server-side verification with O(1) duplicate scan protection and hardware heartbeat.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E8E5DF] text-xs font-semibold text-[#2D6A4F] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Plug &amp; Play Integration</span>
                </div>
              </div>

              <div className="card-luxury p-6 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-[#FBEAEB] text-[#9B2335] flex items-center justify-center mb-4">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#0D0D0D] mb-2">
                    75% Shortage Tracker
                  </h3>
                  <p className="text-xs text-[#52514E] leading-relaxed">
                    Automated statutory defaulter monitoring. Calculates exactly how many consecutive lectures a student must attend to regain exam eligibility.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E8E5DF] text-xs font-semibold text-[#9B2335] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Real-time Risk Alerts</span>
                </div>
              </div>

              <div className="card-luxury p-6 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-[#FFF6E5] text-[#C9A84C] flex items-center justify-center mb-4">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#0D0D0D] mb-2">
                    Multi-Role Architecture
                  </h3>
                  <p className="text-xs text-[#52514E] leading-relaxed">
                    Tailored views for Administrators, Teaching Faculty, and Students. Detailed subject matrices, CSV exports, and personal radial meters.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E8E5DF] text-xs font-semibold text-[#C9A84C] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>JWT &amp; Firebase Secured</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* When Logged In */
          <div className="animate-fade-in">
            {activeTab === 'overview' && (
              <OverviewView
                user={user}
                classes={classes}
                selectedClassId={selectedClassId}
                onClassChange={setSelectedClassId}
                onOpenLogin={() => setIsLoginOpen(true)}
              />
            )}

            {activeTab === 'session' && (
              <LiveSessionView
                classes={classes}
                selectedClassId={selectedClassId}
                onClassChange={setSelectedClassId}
              />
            )}

            {activeTab === 'defaulters' && (
              <DefaultersView selectedClassId={selectedClassId} />
            )}

            {activeTab === 'students' && (
              <StudentsView selectedClassId={selectedClassId} />
            )}
          </div>
        )}
      </main>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Footer */}
      <footer className="border-t border-[#E8E5DF] bg-[#FAFAF8] py-8 text-center text-xs text-[#9E9B95] font-body">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-sm text-[#0D0D0D]">sbes.erp</span>
            <span>•</span>
            <span>Shahbabu Educational Society</span>
          </div>
          <p>Developed by Abdul Wahab &bull; Connected to Express &amp; Firebase</p>
        </div>
      </footer>
    </div>
  );
}
