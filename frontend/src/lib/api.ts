// sbes.erp – Central API Client connecting to the Node.js/Express backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
  classId?: string;
  studentId?: string;
}

export interface Student {
  id: string;
  uid?: string;
  name: string;
  rollNo: string;
  rfid: string;
  classId: string;
  email: string;
  joinDate: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  classId: string;
}

export interface ClassItem {
  id: string;
  name: string;
  activeSessionId?: string;
  activeSubjectId?: string;
  activeSubjectName?: string;
  activeDate?: string;
}

export interface Session {
  id: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  date: string;
  status: 'open' | 'closed';
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  classId: string;
  subjectId: string;
  studentId: string;
  name: string;
  rollNo: string;
  date: string;
  time: string;
  status: string;
  markedBy?: string;
}

export interface StudentReport {
  student: {
    id: string;
    name: string;
    rollNo: string;
    classId: string;
    className: string;
    joinDate: string;
  };
  overall: {
    present: number;
    total: number;
    percentage: number;
    shortage: boolean;
    canSkip: number;
    needToRecover: number;
    note: string;
  };
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    present: number;
    total: number;
    percentage: number;
    shortage: boolean;
  }>;
  minPercent: number;
}

export interface ClassReportRow {
  student: {
    id: string;
    name: string;
    rollNo: string;
  };
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    present: number;
    total: number;
    percentage: number;
    shortage: boolean;
  }>;
  overall: {
    present: number;
    total: number;
    percentage: number;
    shortage: boolean;
    canSkip: number;
    needToRecover: number;
  };
}

export interface ClassReportResponse {
  classId: string;
  minPercent: number;
  summary: {
    totalStudents: number;
    totalClosedSessions: number;
    shortageCount: number;
    subjects: Array<{
      id: string;
      name: string;
      code: string;
      sessionsHeld: number;
    }>;
  };
  report: ClassReportRow[];
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('sbes_token');
    }
  }

  setToken(t: string | null) {
    this.token = t;
    if (typeof window !== 'undefined') {
      if (t) localStorage.setItem('sbes_token', t);
      else localStorage.removeItem('sbes_token');
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('sbes_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMessage = data.error || (data.errors && data.errors[0]?.msg) || `Error ${res.status}: ${res.statusText}`;
      throw new Error(errMessage);
    }

    return data as T;
  }

  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ idToken?: string; token?: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = res.idToken || res.token || '';
    this.setToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sbes_user', JSON.stringify(res.user));
    }
    return { token, user: res.user };
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout() {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sbes_user');
    }
  }

  // Classes & Subjects
  async getClasses(): Promise<ClassItem[]> {
    const res = await this.request<{ classes: ClassItem[] }>('/classes');
    return res.classes || [];
  }

  async getSubjects(classId?: string): Promise<Subject[]> {
    const query = classId ? `?classId=${classId}` : '';
    const res = await this.request<{ subjects: Subject[] }>(`/subjects${query}`);
    return res.subjects || [];
  }

  async createSubject(data: { classId: string; name: string; code?: string }): Promise<Subject> {
    const res = await this.request<{ subject: Subject }>('/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.subject;
  }

  // Students
  async getStudents(classId?: string): Promise<Student[]> {
    const query = classId ? `?classId=${classId}` : '';
    const res = await this.request<{ students: Student[] }>(`/students${query}`);
    return res.students || [];
  }

  async createStudent(data: {
    classId: string;
    name: string;
    rollNo: string;
    rfid: string;
    password: string;
  }): Promise<Student> {
    const res = await this.request<{ student: Student }>('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.student;
  }

  async deleteStudent(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  // Sessions & Attendance
  async getSessions(classId?: string, status?: string): Promise<Session[]> {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ sessions: Session[] }>(`/sessions${query}`);
    return res.sessions || [];
  }

  async startSession(classId: string, subjectId: string): Promise<Session> {
    const res = await this.request<{ session: Session }>('/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ classId, subjectId }),
    });
    return res.session;
  }

  async endSession(sessionId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/sessions/${sessionId}/end`, {
      method: 'POST',
    });
  }

  async getAttendance(sessionId?: string, classId?: string): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams();
    if (sessionId) params.append('sessionId', sessionId);
    if (classId) params.append('classId', classId);
    const res = await this.request<{ attendance: AttendanceRecord[] }>(`/attendance?${params.toString()}`);
    return res.attendance || [];
  }

  async markAttendance(sessionId: string, studentId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ sessionId, studentId }),
    });
  }

  // Reports
  async getClassReport(classId: string): Promise<ClassReportResponse> {
    return this.request<ClassReportResponse>(`/reports/class/${classId}`);
  }

  async getStudentReport(studentId: string): Promise<StudentReport> {
    return this.request<StudentReport>(`/reports/student/${studentId}`);
  }

  async getDefaulters(classId: string): Promise<{
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
  }> {
    return this.request(`/reports/defaulters/${classId}`);
  }
}

export const api = new ApiClient();
