import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Users, ArrowRight } from 'lucide-react';
import Signup from './Signup';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation - Only show when not authenticated */}
      {!currentUser && (
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <Link to="/" className="flex items-center">
                  <svg className="h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="ml-2 text-xl font-bold text-gray-900">SkillSwap</span>
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign In
                </Link>
                <button
                  onClick={() => setShowSignup(true)}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
            Exchange Skills, Grow Together
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Connect with people who want to learn what you know, and teach what they want to learn. 
            Create meaningful learning partnerships today.
          </p>
          <div className="mt-10 max-w-xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Search for skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Feature Section */}
        <div className="mt-32 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Connect Feature */}
          <div className="relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="rounded-lg p-2 bg-indigo-100 inline-block">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Connect</h3>
            <p className="mt-2 text-base text-gray-500">
              Find people with complementary skills and create learning partnerships.
            </p>
          </div>

          {/* Exchange Feature */}
          <div className="relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="rounded-lg p-2 bg-indigo-100 inline-block">
              <MessageSquare className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Exchange</h3>
            <p className="mt-2 text-base text-gray-500">
              Share your expertise and learn new skills through mutual exchange.
            </p>
          </div>

          {/* Grow Feature */}
          <div className="relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="rounded-lg p-2 bg-indigo-100 inline-block">
              <ArrowRight className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Grow</h3>
            <p className="mt-2 text-base text-gray-500">
              Expand your skillset and help others grow through collaborative learning.
            </p>
          </div>
        </div>
      </div>

      {/* Signup Modal */}
      {showSignup && <Signup />}
    </div>
  );
} 