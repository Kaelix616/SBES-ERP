'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';

interface AttendanceMeterProps {
  percentage: number;
  present: number;
  total: number;
  note?: string;
  shortage?: boolean;
  canSkip?: number;
  needToRecover?: number;
}

export default function AttendanceMeter({
  percentage,
  present,
  total,
  note,
  shortage,
  canSkip = 0,
  needToRecover = 0,
}: AttendanceMeterProps) {
  const isSafe = !shortage;
  const strokeColor = isSafe ? '#2D6A4F' : '#9B2335';
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="card-luxury p-6 flex flex-col md:flex-row items-center gap-8">
      {/* Radial Meter */}
      <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#EAE5DC"
            strokeWidth="12"
            fill="transparent"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={strokeColor}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-4xl font-bold tracking-tight text-[#0D0D0D]">
            {percentage}%
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9E9B95]">
            Attendance
          </span>
        </div>
      </div>

      {/* Stats & Advice */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          {isSafe ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EBF5EE] text-[#2D6A4F] border border-[#C5E5D0]">
              <CheckCircle2 className="w-4 h-4" />
              Good Standing (&ge; 75%)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FBEAEB] text-[#9B2335] border border-[#F4D1D5]">
              <AlertCircle className="w-4 h-4" />
              Defaulter Alert (&lt; 75%)
            </span>
          )}
          <span className="text-xs text-[#9E9B95] font-mono">
            {present} of {total} classes attended
          </span>
        </div>

        <h3 className="font-display text-xl font-bold text-[#0D0D0D]">
          {isSafe ? 'Attendance Threshold Satisfied' : 'Action Required to Recover Eligibility'}
        </h3>

        <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#E8E5DF] text-sm text-[#52514E] flex items-start gap-2.5">
          <TrendingUp className="w-4 h-4 text-[#C9A84C] shrink-0 mt-0.5" />
          <p className="font-body text-xs leading-relaxed">
            {note || (isSafe
              ? `You are currently above the mandatory 75% limit. You can safely miss up to ${canSkip} more class(es).`
              : `You are falling short of the 75% threshold. You must attend the next ${needToRecover} consecutive class(es) to recover.`)}
          </p>
        </div>
      </div>
    </div>
  );
}
