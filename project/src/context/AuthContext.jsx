import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:5001';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing token and user data
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      console.log('Login response:', data);
      
      if (!data.token) {
        throw new Error('No token received from server');
      }

      localStorage.setItem('token', data.token);
      
      // Fetch user data
      const userResponse = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${data.token}`,
        },
        credentials: 'include',
      });

      const userData = await userResponse.json();
      
      if (!userResponse.ok) {
        throw new Error(userData.message || 'Failed to fetch user data');
      }

      console.log('User data received:', userData);
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      return userData;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
      throw err;
    }
  };

  const signup = async (name, email, password, skills = [], interests = []) => {
    try {
      console.log('Sending signup request with data:', { name, email, skills, interests });
      
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          skills: skills.map(skill => ({
            name: skill.name,
            level: skill.level || 'intermediate',
            category: skill.category || 'other'
          })),
          interests
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Signup failed:', data);
        throw new Error(data.message || 'Registration failed');
      }

      console.log('Signup successful:', data);

      localStorage.setItem('token', data.token);
      
      // Set user data from the response
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Navigate to dashboard after successful signup
      navigate('/dashboard');
      return data.user;
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message);
      throw new Error(err.message || 'Server error during registration');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        signup,
        logout,
        isAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 