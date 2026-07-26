import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Repeat, TrendingUp, User, LogOut, Bell, X } from 'lucide-react';
import Toast from './Toast';

interface Notification {
  _id: string;
  type: 'connection' | 'exchange';
  message: string;
  read: boolean;
  createdAt: string;
  senderName: string;
}

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const previousNotificationsRef = useRef<Notification[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const activeNotificationsRef = useRef<globalThis.Notification[]>([]);
  const [shownToastIds, setShownToastIds] = useState<string[]>(() => {
    const stored = localStorage.getItem('shownToastIds');
    return stored ? JSON.parse(stored) : [];
  });

  // Check current notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Function to request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  // Show browser notification
  const showBrowserNotification = (message: string, type: 'connection' | 'exchange') => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = type === 'connection' ? 'New Connection Request' : 'New Skill Exchange Request';
      const icon = type === 'connection' ? '/path/to/connection-icon.png' : '/path/to/exchange-icon.png';
      
      const notification = new globalThis.Notification(title, {
        body: message,
        icon: icon,
        badge: icon,
        tag: type
      });

      // Store the notification reference
      activeNotificationsRef.current.push(notification);

      notification.onclick = () => {
        window.focus();
        // Close all active notifications
        activeNotificationsRef.current.forEach(n => n.close());
        activeNotificationsRef.current = [];
        
        if (type === 'connection') {
          navigate('/connect');
        } else {
          navigate('/exchange');
        }
      };
    }
  };

  // Close all active notifications
  const closeAllNotifications = () => {
    activeNotificationsRef.current.forEach(notification => notification.close());
    activeNotificationsRef.current = [];
  };

  // Add toast message with enhanced styling based on type
  const addToast = (message: string, type: 'connection' | 'exchange' | 'error') => {
    const id = Date.now();
    let toastType: 'success' | 'error' | 'info';
    
    switch (type) {
      case 'connection':
        toastType = 'info';
        break;
      case 'exchange':
        toastType = 'success';
        break;
      case 'error':
        toastType = 'error';
        break;
      default:
        toastType = 'info';
    }
    
    setToasts(prev => [...prev, { id, message, type: toastType }]);
  };

  // Remove toast message
  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Helper to update shownToastIds in state and localStorage
  const addShownToastId = (id: string) => {
    setShownToastIds(prev => {
      const updated = [...prev, id];
      localStorage.setItem('shownToastIds', JSON.stringify(updated));
      return updated;
    });
  };

  // Fetch notifications with enhanced error handling and real-time updates
  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      
      // Check for new notifications (not shown as toast yet)
      const newNotifications = data.filter((n: Notification) => 
        !previousNotificationsRef.current.some(pn => pn._id === n._id)
      );

      // Show notifications for new items with enhanced visuals and sound
      newNotifications.forEach((notification: Notification) => {
        // Only show toast if not already shown
        if (!shownToastIds.includes(notification._id)) {
          // Play notification sound
          const audio = new Audio('/path/to/notification-sound.mp3');
          audio.play().catch(() => {}); // Ignore errors if sound can't be played

          // Show browser notification and toast
          showBrowserNotification(notification.message, notification.type);
          addToast(notification.message, notification.type);
          addShownToastId(notification._id);
        }
      });

      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.read).length);
      previousNotificationsRef.current = data;

      // Update page title to show unread count
      const unreadCount = data.filter((n: Notification) => !n.read).length;
      document.title = unreadCount > 0 ? `(${unreadCount}) SkillSwap` : 'SkillSwap';
    } catch (error) {
      console.error('Error fetching notifications:', error);
      addToast('Failed to fetch notifications. Please try again.', 'error');
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`http://localhost:5001/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification._id);
    closeAllNotifications();
    if (notification.type === 'connection') {
      navigate('/connect');
    } else if (notification.type === 'exchange') {
      navigate('/exchange');
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Set up polling for new notifications
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Helper function to safely get skill name
  const getSkillName = (skill: any): string => {
    if (typeof skill === 'string') return skill;
    if (skill && typeof skill === 'object') {
      if ('name' in skill) return skill.name;
      // Handle array-like objects
      if (skill[0] && typeof skill[0] === 'string') return skill[0];
    }
    return 'Unknown Skill';
  };

  // Helper function to safely get skill level
  const getSkillLevel = (skill: any): string | null => {
    if (skill && typeof skill === 'object' && 'level' in skill) {
      return skill.level.charAt(0).toUpperCase() + skill.level.slice(1);
    }
    return null;
  };

  // Helper function to safely get skill category
  const getSkillCategory = (skill: any): string | null => {
    if (skill && typeof skill === 'object' && 'category' in skill) {
      return skill.category.charAt(0).toUpperCase() + skill.category.slice(1);
    }
    return null;
  };

  // Helper function to safely get interest name
  const getInterestName = (interest: any): string => {
    if (typeof interest === 'string') return interest;
    if (interest && typeof interest === 'object' && 'name' in interest) return interest.name;
    return 'Unknown Interest';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Toast Messages */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      {/* Navigation */}
      <nav className="bg-white shadow-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Repeat className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-slate-800">SkillSwap</span>
            </div>
            <div className="flex items-center space-x-4">
              {/* Notification Permission Request */}
              {notificationPermission === 'default' && (
                <button
                  onClick={requestNotificationPermission}
                  className="text-sm px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                >
                  Enable Notifications
                </button>
              )}

              {/* Notifications Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if (notificationPermission === 'default') {
                      requestNotificationPermission();
                    }
                  }}
                  className={`relative p-2 rounded-full focus:outline-none transition-all duration-200 ${
                    unreadCount > 0 
                      ? 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100' 
                      : 'text-slate-600 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className={`relative ${unreadCount > 0 ? 'animate-pulse' : ''}`}>
                    <Bell className="h-6 w-6" />
                    {unreadCount > 0 && (
                      <>
                        <div className="absolute inset-0 rounded-full bg-blue-200 opacity-50 animate-ping"></div>
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-blue-600 rounded-full min-w-[20px]">
                          {unreadCount}
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl py-1 z-50 border border-slate-200">
                    <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                      <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-[480px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-500 text-center flex flex-col items-center">
                          <Bell className="h-8 w-8 text-slate-300 mb-2" />
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification._id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-all duration-200 border-l-4 ${
                              !notification.read ? 'border-blue-600 bg-blue-50/50' : 'border-transparent'
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-1">
                                <p className={`text-sm ${!notification.read ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                                  {notification.message}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  From: {notification.senderName} • {new Date(notification.createdAt).toLocaleDateString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="h-2.5 w-2.5 bg-blue-600 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-slate-700">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Connect Section */}
          <Link
            to="/connect"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition border border-slate-200 hover:border-blue-200"
          >
            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Connect</h2>
            <p className="text-slate-600 text-sm">Connect with other people to exchange skills</p>
          </Link>

          {/* Exchange Section */}
          <Link
            to="/exchange"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition border border-slate-200 hover:border-blue-200"
          >
            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <Repeat className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Exchange</h2>
            <p className="text-slate-600 text-sm">Chat and exchange skills with connected people</p>
          </Link>

          {/* Grow Section */}
          <Link
            to="/grow"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition border border-slate-200 hover:border-blue-200"
          >
            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Grow</h2>
            <p className="text-slate-600 text-sm">Track your growth and skill development</p>
          </Link>

          {/* Profile Section */}
          <Link
            to="/profile"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition border border-slate-200 hover:border-blue-200"
          >
            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Profile</h2>
            <p className="text-slate-600 text-sm">View and manage your profile and ratings</p>
          </Link>
        </div>

        {/* Skills and Interests Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Skills</h2>
            <div className="flex flex-wrap gap-2">
              {user?.skills && user.skills.length > 0 ? (
                user.skills.map((skill: any, index: number) => (
                  <div
                    key={index}
                    className="group relative px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    <div className="flex items-center gap-1">
                      <span>{getSkillName(skill)}</span>
                      {getSkillLevel(skill) && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 rounded-full">
                          {getSkillLevel(skill)}
                        </span>
                      )}
                    </div>
                    {getSkillCategory(skill) && (
                      <div className="absolute hidden group-hover:block bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-600 -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap shadow-lg">
                        {getSkillCategory(skill)}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-slate-500">No skills added yet</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Interests</h2>
            <div className="flex flex-wrap gap-2">
              {user?.interests && user.interests.length > 0 ? (
                user.interests.map((interest: any, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    {getInterestName(interest)}
                  </span>
                ))
              ) : (
                <p className="text-slate-500">No interests added yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}