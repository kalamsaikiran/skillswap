import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Clock, XCircle, Search, Filter, MapPin, Star, User, AlertCircle, Video, MessageSquare } from 'lucide-react';
import io from 'socket.io-client';

interface Notification {
  _id: string;
  recipient: string;
  type: 'request' | 'acceptance' | 'rejection' | 'reminder' | 'meeting_link';
  message: string;
  read: boolean;
  createdAt: string;
}

interface MeetingLinkUpdate {
  exchangeId: string;
  meetingLink: string;
  skill: string;
  sender: string;
  message: string;
}

interface Exchange {
  _id: string;
  skill: string;
  partner: {
    name: string;
    _id: string;
    profilePicture?: string;
  };
  initiator: {
    name: string;
    _id: string;
    profilePicture?: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'active' | 'completed' | 'cancelled';
  requestStatus: 'pending' | 'accepted' | 'rejected';
  startDate: string;
  endDate: string;
  progress: number;
  duration: string;
  notifications: Notification[];
  meetingLink?: string;
}

interface Partner {
  _id: string;
  name: string;
  skills: {
    name: string;
    level: string;
    category: string;
  }[];
  bio: string;
  profilePicture: string;
  location: string;
  availability: string;
  rating: number;
  completedExchanges: number;
  interests: string[];
  isConnected: boolean;
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

// Add interface for fetch options
interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface NewExchange {
  skill: string;
  partner: string;
  duration: string;
  meetingLink: string | null;
}

// Error Boundary Component
class ExchangeErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Exchange component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center bg-white p-8 rounded-lg shadow-sm">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">We're sorry, but there was an error loading the exchange page.</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function ExchangeWithErrorBoundary() {
  return (
    <ExchangeErrorBoundary>
      <Exchange />
    </ExchangeErrorBoundary>
  );
}

function Exchange() {
  const { user, isAuthenticated } = useAuth();
  const currentUserId = (user as { id?: string; _id?: string } | null)?.id || (user as { id?: string; _id?: string } | null)?._id;
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState({
    exchanges: true,
    partners: true,
    categories: true,
    createExchange: false
  });
  const [error, setError] = useState<{
    exchanges: string | null;
    partners: string | null;
    categories: string | null;
    createExchange: string | null;
    skill: string | null;
    duration: string | null;
    meetingLink: string | null;
  }>({
    exchanges: null,
    partners: null,
    categories: null,
    createExchange: null,
    skill: null,
    duration: null,
    meetingLink: null
  });
  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    availability: '',
    location: ''
  });
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [newExchange, setNewExchange] = useState<NewExchange>({
    skill: '',
    partner: '',
    duration: '',
    meetingLink: null
  });
  const [requests, setRequests] = useState<Exchange[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState({
    acceptExchange: false,
    rejectExchange: false,
    createExchange: false
  });
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [showMeetingLinkModal, setShowMeetingLinkModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [customMeetingLink, setCustomMeetingLink] = useState('');
  const [meetingLinkError, setMeetingLinkError] = useState('');

  // Add server health check
  const checkServerConnection = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5001');
      if (response.ok) {
        setServerStatus('connected');
        return true;
      } else {
        setServerStatus('error');
        return false;
      }
    } catch (error) {
      console.error('Server connection error:', error);
      setServerStatus('error');
      return false;
    }
  }, []);

  // Update fetchData to check server connection
  const fetchData = async (url: string, options: FetchOptions = {}) => {
    try {
      // Check server connection before making requests
      if (serverStatus === 'error') {
        const isConnected = await checkServerConnection();
        if (!isConnected) {
          throw new Error('Server is not available');
        }
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      const response = await fetch(url, { 
        ...options, 
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Server response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        
        throw new Error(
          errorData?.message || 
          `HTTP error! status: ${response.status} - ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API call failed:', {
        url,
        options,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Update server status if connection refused
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setServerStatus('error');
      }
      throw error;
    }
  };

  const fetchExchanges = useCallback(async () => {
    if (!currentUserId) return;

    try {
      setLoading(prev => ({ ...prev, exchanges: true }));
      setError(prev => ({ ...prev, exchanges: null }));
      
      const data = await fetchData('http://localhost:5001/api/exchanges');
      console.log('Fetched exchanges:', data);
      
      if (Array.isArray(data)) {
        setExchanges(data);
      } else {
        console.warn('Unexpected exchanges response format:', data);
        setExchanges([]);
      }
    } catch (error) {
      console.error('Error fetching exchanges:', error);
      setError(prev => ({ ...prev, exchanges: 'Failed to load exchanges. Please try again.' }));
      setExchanges([]);
    } finally {
      setLoading(prev => ({ ...prev, exchanges: false }));
    }
  }, [user?.id]);

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, partners: true }));
      setError(prev => ({ ...prev, partners: null }));
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      
      // Add search term if it exists
      if (debouncedSearchTerm.trim()) {
        console.log('Adding search parameter:', debouncedSearchTerm.trim());
        queryParams.append('search', debouncedSearchTerm.trim());
      }
      
      // Add filters if they exist
      if (filters.category) {
        queryParams.append('category', filters.category);
      }
      if (filters.availability) {
        queryParams.append('availability', filters.availability);
      }
      if (filters.location) {
        queryParams.append('location', filters.location);
      }
      
      // Add pagination parameters
      queryParams.append('page', pagination.currentPage.toString());
      queryParams.append('limit', pagination.itemsPerPage.toString());

      console.log('Fetching partners with query params:', queryParams.toString());

      // Make the API call
      const data = await fetchData(`http://localhost:5001/api/users/available-partners?${queryParams}`);
      
      console.log('Received partners data:', data);

      // Update state
      if (data && data.success && Array.isArray(data.partners)) {
        setPartners(data.partners);
        setPagination(prev => ({ 
          ...prev, 
          totalItems: data.total || 0 
        }));
      } else {
        console.warn('Unexpected partners response format:', data);
        setPartners([]);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      setError(prev => ({ ...prev, partners: 'Failed to load partners. Please try again.' }));
      setPartners([]);
    } finally {
      setLoading(prev => ({ ...prev, partners: false }));
    }
  }, [debouncedSearchTerm, filters, pagination.currentPage, pagination.itemsPerPage]);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, categories: true }));
      setError(prev => ({ ...prev, categories: null }));
      const data = await fetchData('http://localhost:5001/api/users/skill-categories');
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError(prev => ({ ...prev, categories: 'Failed to load categories.' }));
      setCategories([]);
    } finally {
      setLoading(prev => ({ ...prev, categories: false }));
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const data = await fetchData('http://localhost:5001/api/exchanges');
      console.log('Fetched exchanges for requests:', data);
      
      if (Array.isArray(data)) {
        // Filter exchanges where:
        // 1. The current user is the partner
        // 2. requestStatus is pending
        // 3. status is pending
        const pendingRequests = data.filter(exchange => 
          exchange.partner._id === currentUserId && 
          exchange.requestStatus === 'pending' &&
          exchange.status === 'pending'
        );
        console.log('Filtered pending requests:', pendingRequests);
        setRequests(pendingRequests);
      } else {
        console.warn('Unexpected exchanges response format:', data);
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      setRequests([]);
    }
  }, [user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const exchanges = await fetchData('http://localhost:5001/api/exchanges');
      console.log('Fetched exchanges for notifications:', exchanges);
      
      if (!Array.isArray(exchanges)) {
        console.warn('Unexpected exchanges response format:', exchanges);
        setNotifications([]);
        return;
      }

      const userNotifications = exchanges.flatMap(exchange => 
        exchange.notifications.filter((notification: Notification) => 
          notification.recipient === currentUserId && !notification.read
        )
      );

      console.log('Filtered notifications:', userNotifications);
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    }
  }, [user?.id]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('Search term changed:', value);
    setSearchTerm(value);

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      console.log('Setting debounced search term:', value);
      setDebouncedSearchTerm(value);
      setPagination(prev => ({ ...prev, currentPage: 1 }));
    }, 500);

    setSearchTimeout(timeout);
  };

  useEffect(() => {
    let mounted = true;

    const fetchAllData = async () => {
      if (!isAuthenticated || !currentUserId || !mounted) return;

      try {
        console.log('Fetching exchange data for user:', currentUserId);
        await Promise.all([
          fetchExchanges(),
          fetchPartners(),
          fetchCategories(),
          fetchRequests(),
          fetchNotifications()
        ]);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchAllData();

    return () => {
      mounted = false;
    };
  }, [
    isAuthenticated,
    currentUserId,
    fetchExchanges,
    fetchPartners,
    fetchCategories,
    fetchRequests,
    fetchNotifications
  ]);

  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Input sanitization
    let sanitizedValue = value;
    
    switch (name) {
      case 'skill':
        // Only allow letters, numbers, spaces, and basic punctuation
        sanitizedValue = value.replace(/[^a-zA-Z0-9\s\-.,]/g, '');
        break;
      case 'duration':
        // Only allow numbers
        sanitizedValue = value.replace(/\D/g, '');
        break;
      case 'meetingLink':
        // Basic URL validation
        if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
          sanitizedValue = `https://${value}`;
        }
        break;
    }
    
    setNewExchange(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));
    
    // Clear any previous error for this field
    if (error[name as keyof typeof error]) {
      setError(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string | null } = {};
    
    // Validate skill
    if (!newExchange.skill.trim()) {
      newErrors.skill = 'Please enter a skill to exchange';
    } else if (newExchange.skill.length < 2) {
      newErrors.skill = 'Skill name must be at least 2 characters long';
    } else if (newExchange.skill.length > 50) {
      newErrors.skill = 'Skill name must be less than 50 characters';
    }
    
    // Validate partner
    if (!newExchange.partner) {
      newErrors.partner = 'Please select a partner';
    }
    
    // Validate duration
    if (!newExchange.duration) {
      newErrors.duration = 'Please specify the duration in hours';
    } else {
      const durationInHours = parseInt(newExchange.duration);
      if (isNaN(durationInHours)) {
        newErrors.duration = 'Duration must be a number';
      } else if (durationInHours <= 0) {
        newErrors.duration = 'Duration must be greater than 0';
      } else if (durationInHours > 168) { // 168 hours = 1 week
        newErrors.duration = 'Duration cannot exceed 168 hours (1 week)';
      }
    }

    // Validate meeting link if provided
    if (newExchange.meetingLink) {
      try {
        new URL(newExchange.meetingLink);
      } catch {
        newErrors.meetingLink = 'Please enter a valid URL';
      }
    }
    
    setError(prev => ({
      ...prev,
      ...newErrors
    }));
    
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(prev => ({ ...prev, createExchange: true }));
    setError(prev => ({ ...prev, createExchange: null }));

    if (!validateForm()) {
      setActionLoading(prev => ({ ...prev, createExchange: false }));
      return;
    }

    try {
      // Convert hours to weeks (assuming 1 week = 168 hours)
      const hours = parseInt(newExchange.duration);
      const durationInWeeks = Math.ceil(hours / 168); // Round up to nearest week

      const response = await fetch('http://localhost:5001/api/exchanges', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skill: newExchange.skill,
          partnerId: newExchange.partner, // Changed from partner to partnerId
          duration: durationInWeeks
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setExchanges(prev => [...prev, data]);
      setNewExchange({
        skill: '',
        partner: '',
        duration: '',
        meetingLink: null
      });
      setSelectedPartner(null);
    } catch (err) {
      console.error('Error creating exchange:', err);
      setError(prev => ({
        ...prev,
        createExchange: err instanceof Error ? err.message : 'Failed to create exchange'
      }));
    } finally {
      setActionLoading(prev => ({ ...prev, createExchange: false }));
    }
  };

  const fetchPartnerDetails = async (partnerId: string) => {
    try {
      // Validate partnerId before making the request
      if (!partnerId) {
        console.warn('Attempted to fetch partner details with undefined ID');
        return;
      }
      const data = await fetchData(`http://localhost:5001/api/users/partner/${partnerId}`);
      setSelectedPartner(data);
    } catch (error) {
      console.error('Error fetching partner details:', error);
      setError(prev => ({ ...prev, partners: 'Failed to load partner details. Please try again.' }));
    }
  };

  const handlePartnerSelect = (partner: Partner) => {
    console.log('Selecting partner:', partner);
    setNewExchange(prev => {
      console.log('Previous exchange state:', prev);
      return { ...prev, partner: partner._id };
    });
    fetchPartnerDetails(partner._id);
  };

  // Add pagination controls
  const PaginationControls = () => {
    const totalPages = Math.ceil(pagination.totalItems / pagination.itemsPerPage);
    
    return (
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">
          Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
          {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
          {pagination.totalItems} partners
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
            disabled={pagination.currentPage === 1}
            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
            disabled={pagination.currentPage === totalPages}
            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const handleMarkNotificationAsRead = async (exchangeId: string) => {
    try {
      await fetchData(`http://localhost:5001/api/exchanges/notifications/${exchangeId}`, {
        method: 'PATCH'
      });

      // Update local state
      setNotifications(prev => prev.filter(n => n._id !== exchangeId));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleExchangeResponse = async (exchangeId: string, status: 'accepted' | 'rejected') => {
    try {
      setActionLoading(prev => ({ ...prev, [`${status}Exchange`]: true }));
      
      // Remove the request from UI immediately
      setRequests(prev => prev.filter(req => req._id !== exchangeId));
      
      const data = await fetchData(`http://localhost:5001/api/exchanges/${exchangeId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      // Update exchanges list if accepted
      if (status === 'accepted') {
        setExchanges(prev => [...prev, data]);
        // Refetch requests to ensure list is up to date
        await fetchRequests();
        // Close any open modals
        setShowMeetingLinkModal(false);
        setSelectedExchange(null);
        // Navigate to messages
        window.location.href = '/messages';
      } else {
        // If rejected, just close the modal and refetch requests
        await fetchRequests();
        setShowMeetingLinkModal(false);
        setSelectedExchange(null);
      }

      // Update notifications
      await fetchData(`http://localhost:5001/api/exchanges/notifications/${exchangeId}`, {
        method: 'PATCH'
      });
      
      setNotifications(prev => prev.filter(n => n.recipient !== exchangeId));
    } catch (error) {
      console.error('Error responding to exchange:', error);
      // If there's an error, add the request back to the list
      const failedRequest = requests.find(req => req._id === exchangeId);
      if (failedRequest) {
        setRequests(prev => [...prev, failedRequest]);
      }
      setError(prev => ({
        ...prev,
        exchanges: error instanceof Error ? error.message : 'Failed to respond to exchange request'
      }));
    } finally {
      setActionLoading(prev => ({ ...prev, [`${status}Exchange`]: false }));
    }
  };

  const handleExchangeClick = async (exchange: Exchange) => {
    try {
      console.log('Exchange object:', exchange);
      
      if (!exchange.meetingLink) {
        // Show modal for custom meeting link input
        setSelectedExchange(exchange);
        setShowMeetingLinkModal(true);
        return;
      }

      // If meeting link exists, redirect to messages
      const queryParams = new URLSearchParams({
        partnerId: exchange.partner._id,
        exchangeId: exchange._id,
        skill: exchange.skill
      });

      window.location.href = `/messages?${queryParams.toString()}`;
    } catch (error) {
      console.error('Error handling exchange click:', error);
      setError(prev => ({
        ...prev,
        exchanges: 'Failed to open chat session. Please try again.'
      }));
    }
  };

  // Add initial server check
  useEffect(() => {
    checkServerConnection();
  }, [checkServerConnection]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Initialize socket connection
    const socket = io('http://localhost:5001', {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    // Listen for meeting link updates
    socket.on('meeting_link_updated', (data: MeetingLinkUpdate) => {
      console.log('Received meeting link update:', data);
      
      // Update the exchanges list with the new meeting link
      setExchanges(prevExchanges => 
        prevExchanges.map(exchange => 
          exchange._id === data.exchangeId
            ? { ...exchange, meetingLink: data.meetingLink }
            : exchange
        )
      );

      // Show notification to the user
      const notification = new Notification('New Meeting Link', {
        body: data.message,
        icon: '/path/to/your/icon.png' // Add your app icon path here
      });

      // Open meeting link when notification is clicked
      notification.onclick = () => {
        window.open(data.meetingLink, '_blank');
      };
    });

    // Cleanup socket connection
    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, user?.id]);

  // Add Modal component
  const MeetingLinkModal = () => {
    if (!showMeetingLinkModal || !selectedExchange) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">Add Meeting Link</h3>
          <p className="text-sm text-gray-600 mb-4">
            Please enter your meeting link for the exchange "{selectedExchange.skill}"
          </p>
          
          <input
            type="url"
            className="w-full p-2 border rounded-lg mb-2"
            placeholder="Enter meeting link (e.g., https://meet.google.com/...)"
            value={customMeetingLink}
            onChange={(e) => {
              setCustomMeetingLink(e.target.value);
              setMeetingLinkError('');
            }}
          />
          
          {meetingLinkError && (
            <p className="text-red-500 text-sm mb-2">{meetingLinkError}</p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              onClick={() => {
                setShowMeetingLinkModal(false);
                setCustomMeetingLink('');
                setMeetingLinkError('');
                setSelectedExchange(null);
              }}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              onClick={async () => {
                if (!customMeetingLink) {
                  setMeetingLinkError('Please enter a meeting link');
                  return;
                }

                try {
                  const response = await fetchData(`http://localhost:5001/api/exchanges/${selectedExchange._id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                      meetingLink: customMeetingLink,
                      status: selectedExchange.status // Preserve the current status
                    })
                  });

                  if (response) {
                    // Update the exchanges list
                    setExchanges(prevExchanges =>
                      prevExchanges.map(ex =>
                        ex._id === selectedExchange._id
                          ? { ...ex, meetingLink: customMeetingLink }
                          : ex
                      )
                    );

                    // Close modal and reset states
                    setShowMeetingLinkModal(false);
                    setCustomMeetingLink('');
                    setSelectedExchange(null);

                    // Redirect to messages with updated query params
                    const queryParams = new URLSearchParams({
                      partnerId: selectedExchange.partner._id,
                      exchangeId: selectedExchange._id,
                      skill: selectedExchange.skill
                    });

                    window.location.href = `/messages?${queryParams.toString()}`;
                  }
                } catch (error) {
                  console.error('Error updating meeting link:', error);
                  setMeetingLinkError('Failed to update meeting link. Please try again.');
                }
              }}
            >
              Save & Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add this component before the main Exchange component
  const ProgressUpdate = ({ exchange, onProgressUpdate }: { 
    exchange: Exchange, 
    onProgressUpdate: (progress: number) => Promise<void> 
  }) => {
    const [progress, setProgress] = useState(exchange.progress);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setProgress(Number(e.target.value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsUpdating(true);
      try {
        await onProgressUpdate(progress);
      } finally {
        setIsUpdating(false);
      }
    };

    return (
      <div className="mt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="progress" className="block text-sm font-medium text-gray-700">
              Progress ({progress}%)
            </label>
            <div className="mt-1 flex items-center gap-4">
              <input
                type="range"
                id="progress"
                name="progress"
                min="0"
                max="100"
                value={progress}
                onChange={handleProgressChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <button
                type="submit"
                disabled={isUpdating || progress === exchange.progress}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  isUpdating || progress === exchange.progress
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isUpdating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  // Update the handleProgressUpdate function
  const handleProgressUpdate = async (exchangeId: string, newProgress: number) => {
    try {
      const response = await fetch(`http://localhost:5001/api/exchanges/${exchangeId}/progress`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ progress: newProgress })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update progress');
      }

      const updatedExchange = await response.json();
      setExchanges(prev => 
        prev.map(ex => ex._id === exchangeId ? updatedExchange : ex)
      );

      // Show success message or notification if needed
      console.log('Progress updated successfully:', newProgress);
    } catch (error) {
      console.error('Error updating progress:', error);
      setError(prev => ({
        ...prev,
        exchanges: 'Failed to update progress. Please try again.'
      }));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white p-8 rounded-lg shadow-sm">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to access skill exchanges.</p>
          <a
            href="/login"
            className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Log In
          </a>
        </div>
      </div>
    );
  }

  if (serverStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white p-8 rounded-lg shadow-sm">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Server Connection Error</h2>
          <p className="text-gray-600 mb-4">Unable to connect to the server. Please try again later.</p>
          <button
            onClick={checkServerConnection}
            className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (loading.exchanges || loading.partners || loading.categories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading exchanges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Skill Exchanges</h1>
          <p className="mt-2 text-gray-600">Manage your skill exchange partnerships</p>
        </div>

        {error.exchanges && (
          <div className="text-red-500 text-center mb-4">
            {error.exchanges}
          </div>
        )}

        {error.partners && (
          <div className="text-red-500 text-center mb-4">
            {error.partners}
          </div>
        )}

        {error.categories && (
          <div className="text-red-500 text-center mb-4">
            {error.categories}
          </div>
        )}

        {error.createExchange && (
          <div className="text-red-500 text-center mb-4">
            {error.createExchange}
          </div>
        )}

        {error.skill && (
          <div className="text-red-500 text-center mb-4">
            {error.skill}
          </div>
        )}

        {error.duration && (
          <div className="text-red-500 text-center mb-4">
            {error.duration}
          </div>
        )}

        {error.meetingLink && (
          <div className="text-red-500 text-center mb-4">
            {error.meetingLink}
          </div>
        )}

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Notifications</h2>
            <div className="space-y-4">
              {notifications.map(notification => (
                <div 
                  key={notification._id} 
                  className="bg-white rounded-lg shadow-sm p-4 relative"
                  onClick={() => handleMarkNotificationAsRead(notification._id)}
                >
                  <p className="text-gray-800">{notification.message}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </p>
                  <button
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkNotificationAsRead(notification._id);
                    }}
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exchange Requests */}
        {requests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Exchange Requests</h2>
            <div className="space-y-4">
              {requests.map(request => (
                <div key={request._id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      {request.initiator.profilePicture ? (
                        <img
                          src={request.initiator.profilePicture}
                          alt={request.initiator.name}
                          className="h-12 w-12 rounded-full"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-medium">{request.initiator.name}</h3>
                        <p className="text-sm text-gray-600">wants to exchange: {request.skill}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExchangeResponse(request._id, 'rejected')}
                        disabled={actionLoading.rejectExchange}
                        className={`px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition ${
                          actionLoading.rejectExchange ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                      >
                        {actionLoading.rejectExchange ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-600"></div>
                            Rejecting...
                          </>
                        ) : (
                          'Reject'
                        )}
                      </button>
                      <button
                        onClick={() => handleExchangeResponse(request._id, 'accepted')}
                        disabled={actionLoading.acceptExchange}
                        className={`px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition ${
                          actionLoading.acceptExchange ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                      >
                        {actionLoading.acceptExchange ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Accepting...
                          </>
                        ) : (
                          'Accept'
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Duration: {request.duration} weeks</p>
                    <p>Start: {new Date(request.startDate).toLocaleDateString()}</p>
                    <p>End: {new Date(request.endDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {exchanges.map((exchange) => (
            <div
              key={exchange._id}
              className="bg-white rounded-lg shadow-sm p-6"
            >
              <div className="flex justify-between items-start">
                <div className="w-full">
                  <div 
                    className="cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
                    onClick={() => handleExchangeClick(exchange)}
                  >
                    <h3 className="text-lg font-semibold">{exchange.skill}</h3>
                    <p className="text-gray-600">
                      {exchange.initiator._id === user?._id ? (
                        <>
                          <span className="text-indigo-600">Learning from:</span> {exchange.partner.name}
                        </>
                      ) : (
                        <>
                          <span className="text-green-600">Teaching to:</span> {exchange.initiator.name}
                        </>
                      )}
                    </p>
                    <p className="text-gray-600">Duration: {exchange.duration} weeks</p>
                    <p className="text-gray-600 flex items-center gap-2">
                      Status: 
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm ${
                        exchange.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        exchange.status === 'active' ? 'bg-green-100 text-green-800' :
                        exchange.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {exchange.status}
                      </span>
                    </p>
                  </div>
                  
                  {/* Progress section - outside the clickable area */}
                  <div className="mt-4 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{exchange.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${exchange.progress}%` }}
                      ></div>
                    </div>

                    {/* Only show progress update for active exchanges */}
                    {exchange.status === 'active' && (
                      <ProgressUpdate 
                        exchange={exchange} 
                        onProgressUpdate={(progress) => handleProgressUpdate(exchange._id, progress)} 
                      />
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {exchange.meetingLink && (
                    <a
                      href={exchange.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Video className="h-4 w-4" />
                      Join Meeting
                    </a>
                  )}
                  <button
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExchangeClick(exchange);
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Open Chat
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Start New Exchange</h2>
          <form onSubmit={handleCreateExchange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Skill to Exchange</label>
              <input
                type="text"
                name="skill"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${
                  error.skill ? 'border-red-500' : ''
                }`}
                value={newExchange.skill}
                onChange={handleInputChange}
                placeholder="Enter the skill you want to exchange"
                maxLength={50}
                required
              />
              {error.skill && (
                <p className="mt-1 text-sm text-red-600">{error.skill}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (hours)</label>
              <input
                type="number"
                name="duration"
                min="1"
                max="168"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${
                  error.duration ? 'border-red-500' : ''
                }`}
                value={newExchange.duration}
                onChange={handleInputChange}
                required
              />
              {error.duration && (
                <p className="mt-1 text-sm text-red-600">{error.duration}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Select Partner</label>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  onClick={() => setFilters({ ...filters, category: '', availability: '', location: '' })}
                >
                  <Filter className="h-4 w-4" />
                  Clear Filters
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                >
                  <option value="" key="all-categories">All Categories</option>
                  {categories.map(category => (
                    <option key={`category-${category}`} value={category}>{category}</option>
                  ))}
                </select>

                <select
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={filters.availability}
                  onChange={(e) => setFilters({ ...filters, availability: e.target.value })}
                >
                  <option value="">All Availability</option>
                  <option value="full-time">Full Time</option>
                  <option value="part-time">Part Time</option>
                  <option value="occasional">Occasional</option>
                </select>

                <input
                  type="text"
                  placeholder="Location"
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                />
              </div>

              <div className="relative">
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pr-10"
                  placeholder="Search partners by name or skill..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  {loading.partners ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-600"></div>
                  ) : (
                    <Search className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-md">
                {loading.partners ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading partners...</p>
                  </div>
                ) : partners.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {debouncedSearchTerm ? (
                      <p>No partners found matching "{debouncedSearchTerm}"</p>
                    ) : (
                      <p>No partners found matching your criteria</p>
                    )}
                  </div>
                ) : (
                  <>
                    {partners.map((partner) => (
                      <div
                        key={partner._id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 ${
                          newExchange.partner === partner._id ? 'bg-indigo-50' : ''
                        }`}
                        onClick={() => handlePartnerSelect(partner)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {partner.profilePicture ? (
                              <img
                                src={partner.profilePicture}
                                alt={partner.name}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="h-5 w-5 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{partner.name}</span>
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {partner.location || 'No location set'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400" />
                            <span className="text-sm">{partner.rating?.toFixed(1) || '0.0'}</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="text-sm font-medium text-gray-700 mb-1">Available Skills:</div>
                          <div className="flex flex-wrap gap-1">
                            {partner.skills?.map((skill) => (
                              <span
                                key={`${partner._id}-skill-${skill.name}`}
                                className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800"
                              >
                                {skill.name} - {skill.level}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    <PaginationControls />
                  </>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="meetingLink">
                Meeting Link (Optional)
              </label>
              <input
                type="url"
                name="meetingLink"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${
                  error.meetingLink ? 'border-red-500' : ''
                }`}
                value={newExchange.meetingLink || ''}
                onChange={handleInputChange}
                placeholder="https://meet.google.com/..."
              />
              {error.meetingLink && (
                <p className="mt-1 text-sm text-red-600">{error.meetingLink}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading.createExchange}
              className={`w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg transition ${
                loading.createExchange ? 'opacity-75 cursor-not-allowed' : 'hover:bg-indigo-700'
              }`}
            >
              {loading.createExchange ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <ArrowRight className="h-5 w-5" />
                  Start Exchange
                </>
              )}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {exchanges.map((exchange) => (
            <div key={exchange._id} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{exchange.skill}</h3>
                  <p className="text-gray-600">
                    {exchange.initiator._id === user?._id ? (
                      <>
                        <span className="text-indigo-600">Learning from:</span> {exchange.partner.name}
                      </>
                    ) : (
                      <>
                        <span className="text-green-600">Teaching to:</span> {exchange.initiator.name}
                      </>
                    )}
                  </p>
                  <p className="text-gray-600">Duration: {exchange.duration}</p>
                  <p className="text-gray-600">Status: {exchange.status}</p>
                </div>
                {exchange.status === 'active' && exchange.meetingLink && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-600">Meeting Link:</h4>
                    <a 
                      href={exchange.meetingLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 text-sm"
                    >
                      {exchange.meetingLink}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
          </div>

          {selectedPartner && (
            <div className="bg-white rounded-lg shadow-sm p-6 h-fit">
              <h2 className="text-xl font-semibold mb-4">Partner Profile</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {selectedPartner.profilePicture ? (
                    <img
                      src={selectedPartner.profilePicture}
                      alt={selectedPartner.name}
                      className="h-16 w-16 rounded-full"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-8 w-8 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-medium">{selectedPartner.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {selectedPartner.location}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Bio</h4>
                  <p className="text-gray-600">{selectedPartner.bio || 'No bio available'}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPartner.skills.map((skill, index) => (
                      <div
                        key={`selected-skill-${skill.name}-${index}`}
                        className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                      >
                        {skill.name} ({skill.level})
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPartner.interests.map((interest, index) => (
                      <div
                        key={`interest-${interest}-${index}`}
                        className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                      >
                        {interest}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span>{selectedPartner.rating.toFixed(1)} Rating</span>
                  </div>
                  <div>
                    {selectedPartner.completedExchanges} Exchanges Completed
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Availability: {selectedPartner.availability}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add the modal */}
      <MeetingLinkModal />
    </div>
  );
}