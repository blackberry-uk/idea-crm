
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import IdeasPage from './pages/IdeasPage';
import IdeaDetail from './pages/IdeaDetail';
import WeeklyReport from './pages/WeeklyReport';
import ContactsPage from './pages/ContactsPage';
import ContactDetail from './pages/ContactDetail';
import Settings from './pages/Settings';
import Invitations from './pages/Invitations';
import { useStore } from './store/useStore';
import { apiClient } from './lib/api/client';
import { Lightbulb, LogIn, UserPlus, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const AuthPage: React.FC = () => {
  const { login, register, googleLogin, data } = useStore();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if session found
  useEffect(() => {
    if (data.currentUser) {
      navigate('/', { replace: true });
    }
  }, [data.currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let success = false;
      if (isRegister) {
        success = await register(email, name, password);
      } else {
        success = await login(email, password);
      }

      if (!success) {
        setError('Invalid credentials or server unreachable.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F3F4] px-4 py-12">
      <div className="max-w-md w-full space-y-10 bg-white p-12 rounded-[2.5rem] shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-100 text-white mb-6">
            <Lightbulb className="w-10 h-10" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Idea-CRM</h2>
          <p className="text-sm text-gray-500 font-medium tracking-tight">
            {isRegister ? 'Create your personal workspace profile' : 'All your ideas in one place'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                placeholder="Pepito Pérez"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
              placeholder="pepito.perez@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold pr-12"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:translate-y-0"
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                {isRegister ? 'Register & Start' : 'Enter Workspace'}
              </>
            )}
          </button>
        </form>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-gray-400 font-bold tracking-widest">or continue with</span>
          </div>
        </div>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              if (credentialResponse.credential) {
                setLoading(true);
                const success = await googleLogin(credentialResponse.credential);
                if (!success) {
                  setError('Google authentication failed.');
                }
                setLoading(false);
              }
            }}
            onError={() => {
              setError('Google login failed. Please try again.');
            }}
            useOneTap
            theme="filled_blue"
            shape="pill"
            width="100%"
          />
        </div>

        <div className="pt-6 border-t border-gray-50 flex flex-col items-center gap-6">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
          >
            {isRegister ? 'Already have a profile? Sign in' : 'Sign up here'}
          </button>

          <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-tighter">
            <ShieldCheck className="w-3 h-3" />
            Database Persistent
          </div>
        </div>
      </div>
    </div>
  );
};

import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';

import { getTheme } from './lib/themes';

const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data } = useStore();
  const theme = getTheme(data.currentUser?.theme, data.currentUser?.customTheme);

  const style = {
    '--primary': theme.primary,
    '--primary-shadow': theme.primary + '33', // ~20% opacity hex
    '--secondary': theme.secondary,
    '--follow-up': theme.followUp,
    '--follow-up-border': theme.followUpBorder,
    '--note-bg': theme.noteBg,
    '--note-border': theme.noteBorder,
    '--accent': theme.accent,
    '--text-title': theme.textTitle,
    '--text-body': theme.textBody,
    '--text-main': theme.textMain,
    '--border': theme.border,
    '--ui-bg': theme.uiBg,
  } as React.CSSProperties;

  return (
    <div style={style} className="min-h-screen bg-[var(--ui-bg)] transition-colors duration-500">
      {children}
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, isHydrated } = useStore();
  const token = apiClient.getToken();

  if (token && !isHydrated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F3F4] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Initializing Workspace...</p>
      </div>
    );
  }

  if (!data.currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ThemeWrapper>
      <Layout>
        {children}
        <Toast />
        <ConfirmDialog />
      </Layout>
    </ThemeWrapper>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/ideas" element={<ProtectedRoute><IdeasPage /></ProtectedRoute>} />
        <Route path="/ideas/:id" element={<ProtectedRoute><IdeaDetail /></ProtectedRoute>} />
        <Route path="/reports/weekly" element={<ProtectedRoute><WeeklyReport /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
        <Route path="/contacts/:id" element={<ProtectedRoute><ContactDetail /></ProtectedRoute>} />
        <Route path="/invitations" element={<ProtectedRoute><Invitations /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
