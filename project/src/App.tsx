import React, { useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { ArrowRightCircle, Code, Dumbbell, MessageSquare, PenTool, Repeat, Search, Utensils, X } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import Dashboard from './components/Dashboard';
import Connect from './components/Connect.tsx';
import Exchange from './components/Exchange.tsx';
import Home from './components/Home.jsx';
import Login from './components/Login.tsx';
import Signup from './components/Signup.tsx';
import Welcome from './components/Welcome.tsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import Grow from './components/Grow.tsx';
import Profile from './components/Profile.tsx';
import LandingPage from './components/LandingPage';
import Messages from './components/Messages';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Register from './components/Register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'signin' | 'signup';
}

function AuthModal({ isOpen, onClose, type }: AuthModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    skills: [] as string[],
    interests: [] as string[],
  });
  const { login, signup } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newInterest, setNewInterest] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (type === 'signin') {
        await login(formData.email, formData.password);
        onClose();
      } else {
        await signup(formData.name, formData.email, formData.password, formData.skills, formData.interests);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // ... rest of AuthModal implementation ...
  // (keeping all the UI components and handlers)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 relative max-h-[90vh] overflow-y-auto">
        {/* ... rest of AuthModal UI ... */}
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated && <Navbar />}
      <Routes>
        {/* Public routes */}
        <Route path="/" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />
        } />
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        } />
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
        } />

        {/* Protected routes */}
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/connect" element={
          <PrivateRoute>
            <Connect />
          </PrivateRoute>
        } />
        <Route path="/exchange" element={
          <PrivateRoute>
            <Exchange />
          </PrivateRoute>
        } />
        <Route path="/messages" element={
          <PrivateRoute>
            <Messages />
          </PrivateRoute>
        } />
        <Route path="/grow" element={
          <PrivateRoute>
            <Grow />
          </PrivateRoute>
        } />
        <Route path="/profile" element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } />

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;