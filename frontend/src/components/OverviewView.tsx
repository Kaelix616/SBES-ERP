'use client';

import React, { useState, useEffect } from 'react';
import { api, User, ClassItem, ClassReportRow, ClassReportResponse, StudentReport } from '@/lib/api';
import AttendanceMeter from './AttendanceMeter';
import { Users, BookOpen, AlertTriangle, Radio, CheckCircle, XCircle } from 'lucide-react';

interface OverviewViewProps {
  user: User | null;
  classes: ClassItem[];
  selectedClassId: string;
  onClassChange: (id: string) => void;
  onOpenLogin: () => void;
}

export default function OverviewView({
  user,
  classes,
  selectedClassId,
  onClassChange,
  onOpenLogin,
}: OverviewViewProps) {
  const [classReport, setClassReport] = useState<ClassReportResponse | null>(null);
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'student') {
      const sid = user.studentId || user.uid;
      setLoading(true);
      api
        .getStudentReport(sid)
        .then(setStudentReport)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (selectedClassId) {
      setLoading(true);
      api
        .getClassReport(selectedClassId)
        .then(setClassReport)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user, selectedClassId]);

  // ── STUDENT VIEW ───────────────────────────────────────────────────────────
  if (user?.role === 'student') {
    if (loading) {
      return <div className="card-luxury p-12 text-center text-sm text-[#9E9B95]">Loading student profile...</div>;
    }
    if (!studentReport) {
      return (
        <div className="card-luxury p-8 text-center">
          <p className="text-sm text-[#52514E]">No attendance records found for your account.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Student Welcome Header */}
        <div className="card-luxury p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="pill-badge mb-1">Student Attendance Portal</span>
            <h2 className="font-display text-2xl font-bold text-[#0D0D0D]">
              {studentReport.student.name}
            </h2>
            <p className="text-xs text-[#52514E] mt-0.5">
              Roll No: <strong>{studentReport.student.rollNo}</strong> • Class: {studentReport.student.className}
            </p>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-[#FAFAF8] border border-[#E8E5DF] text-xs font-mono text-[#52514E]">
            Enrolled: {studentReport.student.joinDate}
          </div>
        </div>

        {/* Radial Progress Gauge */}
        <AttendanceMeter
          percentage={studentReport.overall.percentage}
          present={studentReport.overall.present}
          total={studentReport.overall.total}
          note={studentReport.overall.note}
          shortage={studentReport.overall.shortage}
          canSkip={studentReport.overall.canSkip}
          needToRecover={studentReport.overall.needToRecover}
        />

        {/* Subject-wise Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {studentReport.subjects.map((sub) => {
            const isSafe = !sub.shortage;
            return (
              <div key={sub.subjectId} className="card-luxury p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-[#9E9B95] uppercase">Subject</span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        isSafe
                          ? 'bg-[#EBF5EE] text-[#2D6A4F] border border-[#C5E5D0]'
                          : 'bg-[#FBEAEB] text-[#9B2335] border border-[#F4D1D5]'
                      }`}
                    >
                      {sub.percentage}%
                    </span>
                  </div>
                  <h4 className="font-display text-base font-bold text-[#0D0D0D] line-clamp-1">
                    {sub.subjectName}
                  </h4>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8E5DF] flex items-center justify-between text-xs text-[#52514E] font-mono">
                  <span>Present: {sub.present}</span>
                  <span>Total: {sub.total} classes</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── STAFF / ADMIN VIEW ─────────────────────────────────────────────────────
  const totalStudents = classReport?.report.length || 0;
  const defaultersCount = classReport?.report.filter((r) => r.overall.shortage).length || 0;
  const overallAvg = totalStudents
    ? Math.round(
        classReport!.report.reduce((sum, r) => sum + r.overall.percentage, 0) / totalStudents
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Class Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="pill-badge mb-1.5">Executive Dashboard</span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#0D0D0D]">
            Academic Attendance Overview
          </h1>
          <p className="font-body text-xs text-[#52514E] mt-0.5">
            Real-time biometric attendance metrics, RFID logs, and statutory shortage tracking.
          </p>
        </div>

        {classes.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#52514E] uppercase">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => onClassChange(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-[#E8E5DF] bg-white text-sm text-[#0D0D0D] font-medium shadow-xs"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#9E9B95] uppercase">Enrolled Students</span>
            <Users className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <span className="font-display text-3xl font-bold text-[#0D0D0D]">{totalStudents}</span>
          <span className="block text-[11px] text-[#52514E] mt-1">Active class cohort</span>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#9E9B95] uppercase">Class Average</span>
            <BookOpen className="w-4 h-4 text-[#2D6A4F]" />
          </div>
          <span className="font-display text-3xl font-bold text-[#2D6A4F]">{overallAvg}%</span>
          <span className="block text-[11px] text-[#52514E] mt-1">Across all lectures</span>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#9E9B95] uppercase">Defaulters (&lt;75%)</span>
            <AlertTriangle className="w-4 h-4 text-[#9B2335]" />
          </div>
          <span className="font-display text-3xl font-bold text-[#9B2335]">{defaultersCount}</span>
          <span className="block text-[11px] text-[#9B2335] font-medium mt-1">Requires recovery</span>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#9E9B95] uppercase">Live Hardware Reader</span>
            <Radio className="w-4 h-4 text-[#1B4F72]" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F] animate-pulse" />
            <span className="font-display text-lg font-bold text-[#0D0D0D]">ESP32 Online</span>
          </div>
          <span className="block text-[11px] text-[#52514E] mt-1">RFID auto-listening</span>
        </div>
      </div>

      {/* Attendance Matrix Table */}
      <div className="card-luxury p-6">
        <div className="pb-4 border-b border-[#E8E5DF] mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-[#0D0D0D]">
            Subject-wise Attendance Matrix
          </h3>
          <span className="pill-badge">Standard Threshold: 75%</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#9E9B95]">Loading attendance matrix...</div>
        ) : !classReport || classReport.report.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#9E9B95]">
            No attendance records found for this class.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body text-sm">
              <thead>
                <tr className="border-b border-[#E8E5DF] text-xs font-semibold uppercase tracking-wider text-[#9E9B95]">
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Student</th>
                  {(classReport?.summary?.subjects || []).map((sub) => (
                    <th key={sub.id} className="py-3 px-4 text-center">
                      <span className="block text-[#0D0D0D]">{sub.code || sub.name}</span>
                      <span className="text-[10px] text-[#9E9B95] font-normal font-sans">
                        {sub.name.slice(0, 14)}...
                      </span>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-center">Total Attended</th>
                  <th className="py-3 px-4 text-right">Overall %</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DF]">
                {classReport.report.map((row) => {
                  const isSafe = !row.overall.shortage;
                  return (
                    <tr key={row.student.id} className="hover:bg-[#FAFAF8] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0D0D0D]">
                        {row.student.rollNo}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#0D0D0D]">
                        {row.student.name}
                      </td>

                      {/* Subject Cells */}
                      {row.subjects.map((s) => (
                        <td key={s.subjectId} className="py-3.5 px-4 text-center font-mono text-xs">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              s.shortage
                                ? 'bg-[#FBEAEB] text-[#9B2335] font-bold'
                                : 'text-[#52514E]'
                            }`}
                          >
                            {s.present}/{s.total} ({s.percentage}%)
                          </span>
                        </td>
                      ))}

                      <td className="py-3.5 px-4 text-center font-mono text-xs text-[#52514E]">
                        {row.overall.present} / {row.overall.total}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${
                          isSafe ? 'text-[#2D6A4F]' : 'text-[#9B2335]'
                        }`}
                      >
                        {row.overall.percentage}%
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isSafe
                              ? 'bg-[#EBF5EE] text-[#2D6A4F] border border-[#C5E5D0]'
                              : 'bg-[#FBEAEB] text-[#9B2335] border border-[#F4D1D5]'
                          }`}
                        >
                          {isSafe ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {isSafe ? 'Eligible' : 'Defaulter'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
