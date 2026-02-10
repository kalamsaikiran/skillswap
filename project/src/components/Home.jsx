import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import { MessageSquare, Users, BookOpen, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useAuth();

  // Debug log to see user data structure
  console.log('User data:', user);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl font-bold mb-4">Welcome to SkillSwap</h1>
          <p className="text-xl">Exchange Skills, Grow Together</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <Users className="h-8 w-8 text-indigo-600 mr-3" />
              <h2 className="text-xl font-semibold">Connect</h2>
            </div>
            <p className="text-gray-600 mb-4">Find people with complementary skills and create learning partnerships.</p>
            <Link
              to="/connect"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Browse Connections →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <MessageSquare className="h-8 w-8 text-indigo-600 mr-3" />
              <h2 className="text-xl font-semibold">Exchange</h2>
            </div>
            <p className="text-gray-600 mb-4">Share your expertise and learn new skills through mutual exchange.</p>
            <Link
              to="/exchange"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Start Exchange →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <TrendingUp className="h-8 w-8 text-indigo-600 mr-3" />
              <h2 className="text-xl font-semibold">Grow</h2>
            </div>
            <p className="text-gray-600 mb-4">Track your progress and expand your skillset through collaborative learning.</p>
            <Link
              to="/grow"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              View Progress →
            </Link>
          </div>
        </div>

        {/* Skills and Interests Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BookOpen className="h-6 w-6 text-indigo-600 mr-2" />
              Your Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {user.skills && user.skills.map((skill, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                >
                  {typeof skill === 'string' ? skill : skill.name || 'Unknown Skill'}
                </span>
              ))}
              {(!user.skills || user.skills.length === 0) && (
                <p className="text-gray-500">No skills added yet</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BookOpen className="h-6 w-6 text-green-600 mr-2" />
              Your Interests
            </h2>
            <div className="flex flex-wrap gap-2">
              {user.interests && user.interests.map((interest, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  {typeof interest === 'string' ? interest : interest.name || 'Unknown Interest'}
                </span>
              ))}
              {(!user.interests || user.interests.length === 0) && (
                <p className="text-gray-500">No interests added yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 