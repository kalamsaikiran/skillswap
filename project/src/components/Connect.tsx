import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mail, X, Check, Star, MapPin, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Skill {
  name: string;
  level: string;
  category: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  skills: string[];
  skillDetails: Skill[];
  interests: string[];
  status?: 'pending' | 'connected' | 'none';
  connectionId?: string;
  matchingSkills: string[];
  isIncomingRequest?: boolean;
  bio?: string;
  location?: string;
  availability?: string;
  rating?: number;
  completedExchanges?: number;
}

// Helper function to handle API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    mode: 'cors', // Enable CORS
  };

  // Use the full URL for development
  const baseUrl = 'http://localhost:5001'; // Make sure this matches your backend port
  const url = `${baseUrl}${endpoint}`;

  console.log('Making API call to:', url);

  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Unauthorized - Please login again');
    }

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data);
      throw new Error(data.message || data.error || 'API call failed');
    }

    return data;
  } catch (error: any) {
    console.error('API Call Error:', error);
    // Add more specific error handling
    if (error.message === 'Failed to fetch') {
      throw new Error('Cannot connect to the server. Please check if the backend is running on port 5001.');
    }
    throw error;
  }
};

export default function Connect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        console.log('Fetching members and requests...');
        
        // Fetch both members and incoming requests
        const [membersData, requestsData] = await Promise.all([
          apiCall('/api/connections/members'),
          apiCall('/api/connections/incoming-requests')
        ]);

        console.log('Members data:', membersData);
        console.log('Requests data:', requestsData);

        if (membersData.success) {
          let membersList = membersData.members;
          console.log('Initial members list:', membersList.length);

          // Handle incoming requests
          if (requestsData.success) {
            const requests = requestsData.requests;
            console.log('Incoming requests:', requests.length);
            
            // Mark incoming requests in the members list
            membersList = membersList.map((member: Member) => ({
              ...member,
              isIncomingRequest: requests.some((req: any) => req.requesterId === member.id)
            }));
          }

          console.log('Final members list:', membersList.length);
          setMembers(membersList);
        } else {
          console.error('Failed to fetch members:', membersData);
          setError(membersData.message || 'Failed to fetch members');
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [user?.id]);

  const handleConnect = async (memberId: string) => {
    try {
      const response = await apiCall('/api/connections/request', {
        method: 'POST',
        body: JSON.stringify({ recipientId: memberId })
      });
      
      if (response.success) {
        setMembers((prevMembers) =>
          prevMembers.map((member) =>
            member.id === memberId 
              ? { ...member, status: 'pending', connectionId: response.connection._id } 
              : member
          )
        );
      }
    } catch (err: any) {
      console.error('Error sending connection request:', err);
      setError(err?.message || 'Failed to send connection request');
    }
  };

  const handleAcceptRequest = async (memberId: string, connectionId: string) => {
    try {
      const response = await apiCall(`/api/connections/accept-request/${connectionId}`, {
        method: 'POST'
      });
      
      if (response.success) {
        setMembers((prevMembers) =>
          prevMembers.map((member) =>
            member.id === memberId ? { ...member, status: 'connected' } : member
          )
        );
        navigate('/exchange');
      }
    } catch (err: any) {
      console.error('Error accepting connection request:', err);
      setError(err?.message || 'Failed to accept connection request');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 text-sm underline hover:text-red-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pendingRequests = members.filter(member => member.isIncomingRequest);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Connect with Others</h1>
          <p className="mt-2 text-gray-600">
            Find people who can teach you the skills you want to learn
          </p>
        </div>

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Requests</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pendingRequests.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition border-2 border-yellow-400"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                      <div className="text-gray-500 text-sm space-y-1">
                        <p>{member.email}</p>
                        {member.location && (
                          <p className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {member.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAcceptRequest(member.id, member.connectionId!)}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-full hover:bg-green-700 transition text-sm"
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </button>
                  </div>

                  {member.bio && (
                    <p className="text-gray-600 text-sm mb-4">{member.bio}</p>
                  )}

                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {member.skillDetails.map((skill, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs flex items-center gap-1"
                            title={`Category: ${skill.category}`}
                          >
                            {skill.name}
                            <span className="text-indigo-500 text-xs">({skill.level})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Interests</h4>
                      <div className="flex flex-wrap gap-2">
                        {member.interests.map((interest, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-400" />
                        <span>{member.rating?.toFixed(1) || 'No rating'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{member.availability}</span>
                      </div>
                      <div>
                        {member.completedExchanges} exchanges
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Members Section */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.filter(member => !member.isIncomingRequest).map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                  <div className="text-gray-500 text-sm space-y-1">
                    <p>{member.email}</p>
                    {member.location && (
                      <p className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {member.location}
                      </p>
                    )}
                  </div>
                </div>
                {member.status === 'none' && (
                  <button
                    onClick={() => handleConnect(member.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition text-sm"
                  >
                    <UserPlus className="h-4 w-4" />
                    Connect
                  </button>
                )}
                {member.status === 'pending' && (
                  <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    <Clock className="h-4 w-4" />
                    Pending
                  </span>
                )}
                {member.status === 'connected' && (
                  <button
                    onClick={() => navigate('/messages')}
                    className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-full hover:bg-green-700 transition text-sm"
                  >
                    <Mail className="h-4 w-4" />
                    Message
                  </button>
                )}
              </div>

              {member.bio && (
                <p className="text-gray-600 text-sm mb-4">{member.bio}</p>
              )}

              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {member.skillDetails.map((skill, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs flex items-center gap-1"
                        title={`Category: ${skill.category}`}
                      >
                        {skill.name}
                        <span className="text-indigo-500 text-xs">({skill.level})</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {member.interests.map((interest, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span>{member.rating?.toFixed(1) || 'No rating'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{member.availability}</span>
                  </div>
                  <div>
                    {member.completedExchanges} exchanges
                  </div>
                </div>

                {member.matchingSkills.length > 0 && (
                  <div className="pt-3 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Matching Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {member.matchingSkills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}