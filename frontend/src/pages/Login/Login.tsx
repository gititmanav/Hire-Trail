import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../../utils/api.ts";
import type { User } from "../../types";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { const u = await authAPI.login(email, password); toast.success(`Welcome back, ${u.name}!`); onLogin(u); }
    catch {} finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-bg relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1.5 flex items-center justify-center"><img src="/logo.png" alt="HireTrail" className="w-full h-full object-contain" /></div>
            <span className="text-xl font-bold text-white">HireTrail</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">Track your job search.<br />Land your dream role.</h1>
          <p className="text-lg text-blue-200/80 mb-12 max-w-md">Manage applications, resumes, contacts, and deadlines — all in one place built for students and new grads.</p>
          <div className="space-y-4">
            {[
              { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2", label: "Track every application stage" },
              { icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", label: "Analytics and resume performance" },
              { icon: "M21 13.255A23.193 23.193 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", label: "Search and track jobs from one dashboard" },
              { icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197", label: "Manage contacts and networking" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d={f.icon} /></svg></div>
                <span className="text-sm text-blue-100/90">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10"><p className="text-xs text-blue-300/50">Built for students. Open source.</p></div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-gray-900">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-sidebar-bg p-1.5 flex items-center justify-center"><img src="/logo.png" alt="HireTrail" className="w-full h-full object-contain" /></div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">HireTrail</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Sign in to your account to continue</p>

          <button onClick={() => { window.location.href = "/api/auth/google"; }} className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6"><div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/><span className="text-xs text-gray-400 dark:text-gray-500">Or continue with email</span><div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label><input type="email" className="input-premium" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label><input type="password" className="input-premium" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required /></div>
            <button type="submit" disabled={loading} className="btn-accent w-full justify-center !py-2.5 disabled:opacity-50">{loading ? "Signing in..." : "Sign in"}</button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">Don't have an account? <Link to="/register" className="text-accent font-medium hover:underline">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}
