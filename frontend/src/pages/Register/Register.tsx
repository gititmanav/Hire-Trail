import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../../utils/api.ts";
import type { User } from "../../types";

export default function Register({ onLogin }: { onLogin: (u: User) => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { const u = await authAPI.register(name, email, password); toast.success("Account created!"); onLogin(u); }
    catch {} finally { setLoading(false); }
  };

  const inputCls = "w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors";

  return (
    <div className="flex items-center justify-center min-h-screen bg-page dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-10 w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 bg-sidebar-bg rounded-lg flex items-center justify-center text-accent font-bold text-xl">H</div>
          <span className="text-[22px] font-semibold text-gray-900 dark:text-white">HireTrail</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Create your account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Start tracking your job search today</p>

        <button onClick={() => { window.location.href = "/api/auth/google"; }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>
        <div className="flex items-center gap-3 my-5 text-gray-400 dark:text-gray-500 text-[13px]"><div className="flex-1 h-px bg-gray-200 dark:bg-gray-600"/><span>or</span><div className="flex-1 h-px bg-gray-200 dark:bg-gray-600"/></div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Full name</label><input type="text" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Email</label><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Password</label><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50">{loading ? "Creating account..." : "Create account"}</button>
        </form>
        <p className="text-center mt-5 text-sm text-gray-500 dark:text-gray-400">Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}
