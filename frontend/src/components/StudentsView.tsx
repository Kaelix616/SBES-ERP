'use client';

import React, { useState, useEffect } from 'react';
import { api, Student } from '@/lib/api';
import { UserPlus, Search, Trash2, CreditCard, Mail, Calendar, Hash } from 'lucide-react';

interface StudentsViewProps {
  selectedClassId: string;
}

export default function StudentsView({ selectedClassId }: StudentsViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Student Form
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [rfid, setRfid] = useState('');
  const [password, setPassword] = useState('student123');
  const [formErr, setFormErr] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const loadStudents = () => {
    if (!selectedClassId) return;
    setLoading(true);
    api
      .getStudents(selectedClassId)
      .then(setStudents)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStudents();
  }, [selectedClassId]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    setFormSuccess('');

    try {
      await api.createStudent({
        classId: selectedClassId,
        name: name.trim(),
        rollNo: rollNo.trim(),
        rfid: rfid.trim().toUpperCase(),
        password,
      });

      setFormSuccess(`Student ${name} successfully registered with RFID card!`);
      setName('');
      setRollNo('');
      setRfid('');
      loadStudents();
      setTimeout(() => setShowAddModal(false), 1200);
    } catch (err: any) {
      setFormErr(err.message || 'Failed to register student.');
    }
  };

  const handleDelete = async (std: Student) => {
    if (!confirm(`Are you sure you want to delete student "${std.name}" (Roll: ${std.rollNo})?`)) return;
    try {
      await api.deleteStudent(std.id);
      loadStudents();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(search.toLowerCase()) ||
      s.rfid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="card-luxury p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E5DF]">
          <div>
            <span className="pill-badge mb-1.5">Directory & Enrollment</span>
            <h2 className="font-display text-2xl font-bold text-[#0D0D0D]">Registered Students</h2>
            <p className="text-xs text-[#52514E] mt-0.5">
              Manage student enrollment and RFID hardware card assignments.
            </p>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs py-2 px-4">
            <UserPlus className="w-4 h-4" />
            <span>Enroll New Student</span>
          </button>
        </div>

        {/* Search */}
        <div className="pt-6 pb-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#9E9B95]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, roll no, or RFID UID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-xs text-[#0D0D0D] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-body text-sm">
            <thead>
              <tr className="border-b border-[#E8E5DF] text-xs font-semibold uppercase tracking-wider text-[#9E9B95]">
                <th className="py-3 px-4">Roll</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">RFID UID</th>
                <th className="py-3 px-4">Portal Email</th>
                <th className="py-3 px-4">Join Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E5DF]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#9E9B95]">
                    Loading student directory...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#9E9B95]">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((std) => (
                  <tr key={std.id} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0D0D0D]">{std.rollNo}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#0D0D0D]">{std.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#1B4F72] bg-[#EBF2F7] px-2.5 py-1 rounded-md border border-[#D1E1EC]">
                        <CreditCard className="w-3.5 h-3.5" />
                        {std.rfid}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#52514E]">{std.email}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#9E9B95]">{std.joinDate || '2026-08-01'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(std)}
                        className="p-1.5 rounded-lg text-[#9B2335] hover:bg-[#FBEAEB] transition-colors"
                        title="Delete student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-[#E8E5DF] rounded-2xl shadow-xl p-6">
            <h3 className="font-display text-xl font-bold text-[#0D0D0D] mb-1">Enroll New Student</h3>
            <p className="text-xs text-[#52514E] mb-4">
              Registers student in Firebase Auth and binds unique RFID hardware card.
            </p>

            {formErr && (
              <div className="mb-4 p-3 rounded-xl bg-[#FBEAEB] border border-[#F4D1D5] text-xs text-[#9B2335]">
                {formErr}
              </div>
            )}
            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-[#EBF5EE] border border-[#C5E5D0] text-xs text-[#2D6A4F]">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-3 font-body text-xs">
              <div>
                <label className="block font-semibold text-[#52514E] mb-1">Student Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Samarth Deshmukh"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-sm text-[#0D0D0D]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#52514E] mb-1">Roll Number</label>
                  <input
                    type="text"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="e.g. 06"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-sm text-[#0D0D0D]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#52514E] mb-1">RFID Card UID</label>
                  <input
                    type="text"
                    value={rfid}
                    onChange={(e) => setRfid(e.target.value)}
                    placeholder="e.g. E20044556677"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-sm text-[#0D0D0D] font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#52514E] mb-1">Initial Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E5DF] bg-[#FAFAF8] text-sm text-[#0D0D0D]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-outline text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-2 px-5">
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
