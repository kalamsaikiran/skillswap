import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Settings, Book, Users, Star, Award, Clock, MapPin } from 'lucide-react';

interface Skill {
  name: string;
  level: string;
  category: string;
}

interface Connection {
  _id: string;
  name: string;
  profilePicture?: string;
  skills: Skill[];
}

interface Exchange {
  _id: string;
  skill: string;
  partner: {
    name: string;
    _id: string;
    profilePicture?: string;
  };
  status: 'pending' | 'active' | 'completed';
  progress: number;
  startDate: string;
  endDate: string;
}

interface ProfileStats {
  totalConnections: number;
  skillsTeaching: number;
  skillsLearning: number;
  completedExchanges: number;
  activeExchanges: number;
  averageRating: number;
}

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [stats, setStats] = useState<ProfileStats>({
    totalConnections: 0,
    skillsTeaching: 0,
    skillsLearning: 0,
    completedExchanges: 0,
    activeExchanges: 0,
    averageRating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!isAuthenticated || !user?.id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch connections
        const connectionsResponse = await fetch('http://localhost:5001/api/connections/connected', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!connectionsResponse.ok) {
          throw new Error('Failed to fetch connections');
        }

        const connectionsData = await connectionsResponse.json();
        setConnections(connectionsData.connections || []);

        // Fetch exchanges
        const exchangesResponse = await fetch('http://localhost:5001/api/exchanges', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!exchangesResponse.ok) {
          throw new Error('Failed to fetch exchanges');
        }

        const exchangesData = await exchangesResponse.json();
        setExchanges(exchangesData || []);

        // Calculate stats
        const activeExchanges = exchangesData.filter((ex: Exchange) => ex.status === 'active').length;
        const completedExchanges = exchangesData.filter((ex: Exchange) => ex.status === 'completed').length;

        setStats({
          totalConnections: connectionsData.connections?.length || 0,
          skillsTeaching: user.skills?.length || 0,
          skillsLearning: user.interests?.length || 0,
          completedExchanges,
          activeExchanges,
          averageRating: user.rating || 0,
        });

      } catch (err) {
        console.error('Error fetching profile data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Please log in to view your profile</h2>
          <a href="/login" className="mt-4 inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
            Log In
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.name}
                  className="h-20 w-20 rounded-full"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-10 w-10 text-gray-500" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
                <div className="flex items-center text-gray-600 mt-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{user?.location || 'No location set'}</span>
                </div>
                <div className="flex items-center text-gray-600 mt-1">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{user?.availability || 'Availability not set'}</span>
                </div>
              </div>
            </div>
            <button className="flex items-center text-gray-600 hover:text-gray-900">
              <Settings className="h-5 w-5" />
              <span className="ml-2">Edit Profile</span>
            </button>
          </div>

          {/* Bio */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900">About</h2>
            <p className="mt-2 text-gray-600">{user?.bio || 'No bio available'}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Connections</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalConnections}</p>
              </div>
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Skills Teaching</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.skillsTeaching}</p>
              </div>
              <Book className="h-8 w-8 text-indigo-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Skills Learning</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.skillsLearning}</p>
              </div>
              <Star className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Skills and Learning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Skills */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills</h2>
            <div className="space-y-4">
              {user?.skills?.map((skill: Skill, index: number) => (
                <div key={`skill-${index}`} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{skill.name}</p>
                    <p className="text-sm text-gray-600">{skill.category}</p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                    {skill.level}
                  </span>
                </div>
              ))}
              {(!user?.skills || user.skills.length === 0) && (
                <p className="text-gray-500">No skills added yet</p>
              )}
            </div>
          </div>

          {/* Learning */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Learning</h2>
            <div className="space-y-4">
              {user?.interests?.map((interest: string, index: number) => (
                <div key={`interest-${index}`} className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{interest}</p>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    Interested
                  </span>
                </div>
              ))}
              {(!user?.interests || user.interests.length === 0) && (
                <p className="text-gray-500">No learning interests added yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Active Exchanges */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Exchanges</h2>
          <div className="space-y-4">
            {exchanges
              .filter(exchange => exchange.status === 'active')
              .map(exchange => (
                <div key={exchange._id} className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-medium text-gray-900">{exchange.skill}</p>
                    <p className="text-sm text-gray-600">with {exchange.partner.name}</p>
                  </div>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2 mr-4">
                      <div
                        className="bg-indigo-600 rounded-full h-2"
                        style={{ width: `${exchange.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">{exchange.progress}%</span>
                  </div>
                </div>
              ))}
            {exchanges.filter(exchange => exchange.status === 'active').length === 0 && (
              <p className="text-gray-500">No active exchanges</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 