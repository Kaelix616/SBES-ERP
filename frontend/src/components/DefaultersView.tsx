'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { AlertOctagon, TrendingUp, Download, ShieldAlert } from 'lucide-react';

interface DefaultersViewProps {
  selectedClassId: string;
}

export default function DefaultersView({ selectedClassId }: DefaultersViewProps) {
  const [data, setData] = useState<{
    threshold: number;
    defaulters: Array<{
      id: string;
      name: string;
      rollNo: string;
      present: number;
      total: number;
      percentage: number;
      needToRecover: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedClassId) return;
    setLoading(true);
    api
      .getDefaulters(selectedClassId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClassId]);

  const exportCSV = () => {
    if (!data || !data.defaulters.length) return;
    const rows = [
      ['Roll No', 'Name', 'Classes Attended', 'Total Classes', 'Percentage', 'Classes Needed to Reach 75%'],
      ...data.defaulters.map((d) => [
        d.rollNo,
        d.name,
        d.present,
        d.total,
        `${d.percentage}%`,
        d.needToRecover,
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `defaulters_${selectedClassId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="card-luxury p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E5DF]">
          <div>
            <div className="flex items-center gap-2">
              <span className="pill-badge bg-[#FBEAEB] text-[#9B2335] border-[#F4D1D5]">
                <ShieldAlert className="w-3.5 h-3.5" />
                Shortage Monitoring
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#0D0D0D] mt-1.5">
              Defaulter List (&lt; 75% Attendance)
            </h2>
            <p className="text-xs text-[#52514E] mt-0.5">
              Students identified below statutory attendance thresholds requiring recovery intervention.
            </p>
          </div>

          <button
            onClick={exportCSV}
            disabled={!data?.defaulters?.length}
            className="btn-outline text-xs py-2 px-4 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Export Defaulter CSV</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#9E9B95]">Analyzing attendance records...</div>
        ) : !data || data.defaulters.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#2D6A4F] bg-[#EBF5EE] rounded-xl mt-6 border border-[#C5E5D0]">
            ✨ All registered students in this class meet or exceed the 75% attendance requirement!
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left font-body text-sm">
              <thead>
                <tr className="border-b border-[#E8E5DF] text-xs font-semibold uppercase tracking-wider text-[#9E9B95]">
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Attended / Total</th>
                  <th className="py-3 px-4">Current %</th>
                  <th className="py-3 px-4">Required Recovery</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DF]">
                {data.defaulters.map((d) => (
                  <tr key={d.id} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0D0D0D]">{d.rollNo}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#0D0D0D]">{d.name}</td>
                    <td className="py-3.5 px-4 font-mono text-[#52514E]">
                      {d.present} / {d.total}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#9B2335]">{d.percentage}%</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#0D0D0D] bg-[#F5F2ED] px-2.5 py-1 rounded-md border border-[#E8E5DF]">
                        <TrendingUp className="w-3.5 h-3.5 text-[#C9A84C]" />
                        Must attend next <strong>{d.needToRecover}</strong> classes
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FBEAEB] text-[#9B2335] border border-[#F4D1D5]">
                        <AlertOctagon className="w-3 h-3" />
                        Defaulter
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
