import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, User } from 'lucide-react';
import io from 'socket.io-client';

interface Message {
  _id: string;
  sender: string;
  recipient: string;
  content: string;
  createdAt: string;
}

interface Connection {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  lastMessage?: string;
  unreadCount?: number;
}

export default function Messages() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io('http://localhost:5001', {
      auth: {
        token
      }
    });

    setSocket(socket);

    // Listen for incoming messages
    socket.on('private message', (message: Message) => {
      if (selectedConnection?._id === message.sender) {
        setMessages(prev => [...prev, message]);
      }
    });

    // Join user's room
    if (user?.id) {
      socket.emit('join', user.id);
    }

    return () => {
      socket.disconnect();
    };
  }, [user?.id, selectedConnection]);

  // Helper function to handle API calls
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found - please login');
    }

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      mode: 'cors',
    };

    const baseUrl = 'http://localhost:5001';
    const url = `${baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'API call failed');
      }

      return data;
    } catch (error: any) {
      console.error('API Call Error:', error);
      if (error.message.includes('authentication token')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      throw new Error(error.message || 'An unexpected error occurred');
    }
  };

  // Fetch connections
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        setLoading(true);
        const response = await apiCall('/api/connections/connected');
        if (response.success && Array.isArray(response.connections)) {
          setConnections(response.connections);
        } else {
          console.error('Invalid connections response:', response);
          setError('Failed to load connections');
        }
      } catch (err: any) {
        console.error('Error fetching connections:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, []);

  // Fetch messages when a connection is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConnection?._id) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await apiCall(`/api/messages/${selectedConnection._id}`);
        setMessages(response || []);
      } catch (err: any) {
        console.error('Error fetching messages:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (selectedConnection) {
      fetchMessages();
    }
  }, [selectedConnection]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConnection?._id || !newMessage.trim()) {
      return;
    }

    try {
      setError(null);

      // Send message through Socket.IO
      socket?.emit('private message', {
        to: selectedConnection._id,
        message: newMessage.trim()
      });

      // Also send through REST API for persistence
      const response = await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipient: selectedConnection._id,
          content: newMessage.trim()
        })
      });

      setMessages(prev => [...prev, response]);
      setNewMessage('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message);
    }
  };

  if (loading && connections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 min-h-[600px]">
            {/* Connections List */}
            <div className="col-span-4 border-r">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">Messages</h2>
              </div>
              <div className="overflow-y-auto h-[calc(600px-4rem)]">
                {connections.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No connections found
                  </div>
                ) : (
                  connections.map((connection) => (
                    <div
                      key={connection._id}
                      className={`w-full p-4 hover:bg-gray-50 transition cursor-pointer ${
                        selectedConnection?._id === connection._id ? 'bg-gray-50' : ''
                      }`}
                      onClick={() => setSelectedConnection(connection)}
                    >
                      <div className="flex items-center space-x-3">
                        {connection.profilePicture ? (
                          <img
                            src={connection.profilePicture}
                            alt={connection.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-6 w-6 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {connection.name}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {connection.lastMessage || 'Start a conversation'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="col-span-8">
              {selectedConnection ? (
                <>
                  {/* Selected Connection Header */}
                  <div className="p-4 border-b">
                    <div className="flex items-center space-x-3">
                      {selectedConnection.profilePicture ? (
                        <img
                          src={selectedConnection.profilePicture}
                          alt={selectedConnection.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {selectedConnection.name}
                        </h3>
                        <p className="text-sm text-gray-500">{selectedConnection.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto h-[calc(600px-8rem)]">
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">No messages yet. Start a conversation!</p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message._id}
                          className={`flex ${
                            message.sender === user?.id ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              message.sender === user?.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="break-words">{message.content}</p>
                            <p className="text-xs mt-1 opacity-75">
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t">
                    <div className="flex space-x-4">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || !selectedConnection?._id}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-red-600">{error}</p>
                    )}
                  </form>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Select a conversation to start messaging</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 