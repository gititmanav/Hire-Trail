import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../../utils/api.ts";
import type { User } from "../../types";

export default function Register({ onLogin }: { onLogin: (u: User) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      const u = await authAPI.register(name, email, password);
      toast.success("Account created!");
      onLogin(u);
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — same as login */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-bg relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1.5 flex items-center justify-center"><img src="/logo.png" alt="HireTrail" className="w-full h-full object-contain" /></div>
            <span className="text-xl font-bold text-white">HireTrail</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">Your job search<br />command center.</h1>
          <p className="text-lg text-blue-200/80 mb-12 max-w-md">Join thousands of students using HireTrail to organize their internship and job search journey.</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-8">
            <div><div className="text-3xl font-bold text-white">650+</div><div className="text-sm text-blue-200/60 mt-1">Applications tracked</div></div>
            <div><div className="text-3xl font-bold text-white">8</div><div className="text-sm text-blue-200/60 mt-1">Resume versions</div></div>
            <div><div className="text-3xl font-bold text-white">5</div><div className="text-sm text-blue-200/60 mt-1">Pipeline stages</div></div>
          </div>
        </div>
        <div className="relative z-10"><p className="text-xs text-blue-300/50">Built for students. Open source.</p></div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-gray-900">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-sidebar-bg p-1.5 flex items-center justify-center"><img src="/logo.png" alt="HireTrail" className="w-full h-full object-contain" /></div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">HireTrail</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Start tracking your job search today</p>

          <button onClick={() => { window.location.href = "/api/auth/google"; }} className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6"><div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/><span className="text-xs text-gray-400 dark:text-gray-500">Or create with email</span><div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name</label><input type="text" className="input-premium" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name</label><input type="text" className="input-premium" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" required /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label><input type="email" className="input-premium" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label><input type="password" className="input-premium" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required /></div>

            <p className="text-xs text-gray-400 dark:text-gray-500">By creating an account you agree to our Terms of Service and Privacy Policy.</p>

            <button type="submit" disabled={loading} className="btn-accent w-full justify-center !py-2.5 disabled:opacity-50">{loading ? "Creating account..." : "Create account"}</button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">Already have an account? <Link to="/login" className="text-accent font-medium hover:underline">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
