'use client';

import React, { useState, useEffect } from 'react';
import { api, ClassItem, Subject, Session, Student, AttendanceRecord } from '@/lib/api';
import { Radio, Play, Square, CreditCard, Check, Clock, UserCheck } from 'lucide-react';

interface LiveSessionViewProps {
  classes: ClassItem[];
  selectedClassId: string;
  onClassChange: (id: string) => void;
}

export default function LiveSessionView({ classes, selectedClassId, onClassChange }: LiveSessionViewProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [punches, setPunches] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Load subjects & students for selected class
  useEffect(() => {
    if (!selectedClassId) return;
    api.getSubjects(selectedClassId).then(setSubjects).catch(console.error);
    api.getStudents(selectedClassId).then(setStudents).catch(console.error);
    checkActiveSession();
  }, [selectedClassId]);

  // Check if class has an open session
  const checkActiveSession = async () => {
    try {
      const openSessions = await api.getSessions(selectedClassId, 'open');
      if (openSessions.length > 0) {
        const sess = openSessions[0];
        setActiveSession(sess);
        const att = await api.getAttendance(sess.id);
        setPunches(att);
      } else {
        setActiveSession(null);
        setPunches([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartSession = async () => {
    if (!selectedSubjectId) {
      setMsg({ type: 'err', text: 'Please select a subject first.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const sess = await api.startSession(selectedClassId, selectedSubjectId);
      setActiveSession(sess);
      setMsg({ type: 'ok', text: `Active attendance session started!` });
      setPunches([]);
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Failed to start session.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    setLoading(true);
    setMsg(null);
    try {
      await api.endSession(activeSession.id);
      setMsg({ type: 'ok', text: 'Session successfully closed and attendance recorded.' });
      setActiveSession(null);
      setPunches([]);
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Failed to end session.' });
    } finally {
      setLoading(false);
    }
  };

  // Simulate RFID scan or Manual Punch
  const handleMarkPresent = async (student: Student) => {
    if (!activeSession) return;
    try {
      await api.markAttendance(activeSession.id, student.id);
      setMsg({ type: 'ok', text: `${student.name} marked present!` });
      const updated = await api.getAttendance(activeSession.id);
      setPunches(updated);
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  const punchedStudentIds = new Set(punches.map((p) => p.studentId));

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="card-luxury p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E8E5DF]">
          <div>
            <span className="pill-badge mb-1.5">Hardware & RFID Portal</span>
            <h2 className="font-display text-2xl font-bold text-[#0D0D0D]">Take Class Attendance</h2>
            <p className="text-xs text-[#52514E] mt-0.5">
              ESP32 RFID reader punches stream live into this active session.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedClassId}
              onChange={(e) => onClassChange(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-sm text-[#0D0D0D] font-medium"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {msg && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-semibold ${
              msg.type === 'ok'
                ? 'bg-[#EBF5EE] text-[#2D6A4F] border border-[#C5E5D0]'
                : 'bg-[#FBEAEB] text-[#9B2335] border border-[#F4D1D5]'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Active Session Status or Start Form */}
        <div className="pt-6">
          {activeSession ? (
            <div className="p-5 rounded-2xl bg-[#EBF5EE] border border-[#C5E5D0] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#2D6A4F] text-white">
                  <Radio className="w-5 h-5 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#2D6A4F] animate-ping" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F]">Session Active</span>
                    <span className="text-xs text-[#52514E] font-mono">ID: {activeSession.id}</span>
                  </div>
                  <h4 className="font-display text-lg font-bold text-[#0D0D0D]">
                    {activeSession.subjectName || 'Current Lecture'}
                  </h4>
                  <p className="text-xs text-[#52514E] mt-0.5">
                    {punches.length} of {students.length} students marked present
                  </p>
                </div>
              </div>

              <button
                onClick={handleEndSession}
                disabled={loading}
                className="btn-outline border-[#9B2335] text-[#9B2335] hover:bg-[#FBEAEB] text-xs py-2 px-4"
              >
                <Square className="w-4 h-4" />
                <span>Close Session</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full sm:w-72 px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-sm text-[#0D0D0D]"
              >
                <option value="">Select Lecture Subject...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>

              <button
                onClick={handleStartSession}
                disabled={loading || !selectedSubjectId}
                className="w-full sm:w-auto btn-primary text-sm py-2.5 px-6 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Attendance Session</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Punches & Student Card Tap Simulator */}
      {activeSession && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Punch List */}
          <div className="lg:col-span-2 card-luxury p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E8E5DF] mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="font-display text-lg font-bold text-[#0D0D0D]">Live Punch Log</h3>
              </div>
              <span className="pill-badge">{punches.length} Verified Punches</span>
            </div>

            {punches.length === 0 ? (
              <div className="py-12 text-center text-[#9E9B95] text-sm">
                No punches recorded yet. Tap RFID cards on ESP32 or use the test buttons below.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E5DF]">
                {punches.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#EBF5EE] text-[#2D6A4F] flex items-center justify-center font-bold text-xs">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-[#0D0D0D]">{p.name}</span>
                        <div className="text-[11px] text-[#9E9B95] font-mono">
                          Roll No: {p.rollNo} • Marked by: {p.markedBy || 'rfid'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-[#52514E] bg-[#FAFAF8] px-2.5 py-1 rounded-md border border-[#E8E5DF]">
                      {p.time || 'Recorded'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Simulate RFID Tap Panel */}
          <div className="card-luxury p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-[#E8E5DF] mb-4">
              <CreditCard className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="font-display text-lg font-bold text-[#0D0D0D]">RFID Tap Simulator</h3>
            </div>
            <p className="text-xs text-[#52514E] mb-4 leading-relaxed">
              Test live RFID attendance punches without needing physical ESP32 hardware right now:
            </p>

            <div className="space-y-2">
              {students.map((std) => {
                const isPunched = punchedStudentIds.has(std.id);
                return (
                  <div
                    key={std.id}
                    className="p-3 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#0D0D0D] block">{std.name}</span>
                      <span className="text-[#9E9B95] font-mono text-[10px]">
                        Roll {std.rollNo} • UID: {std.rfid}
                      </span>
                    </div>

                    <button
                      onClick={() => handleMarkPresent(std)}
                      disabled={isPunched}
                      className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                        isPunched
                          ? 'bg-[#EBF5EE] text-[#2D6A4F] cursor-default'
                          : 'btn-primary text-xs py-1 px-3'
                      }`}
                    >
                      {isPunched ? 'Present' : 'Tap Card'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
