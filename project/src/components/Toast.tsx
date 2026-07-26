import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 border-green-700';
      case 'error':
        return 'bg-red-600 border-red-700';
      case 'info':
        return 'bg-indigo-600 border-indigo-700';
      default:
        return 'bg-gray-600 border-gray-700';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div 
        className={`${getStyles()} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center justify-between min-w-[320px] border-l-4 backdrop-blur-sm bg-opacity-95 transform transition-all duration-300 hover:scale-102`}
        style={{
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
        }}
      >
        <p className="text-sm font-medium leading-5">{message}</p>
        <button
          onClick={onClose}
          className="ml-4 text-white/80 hover:text-white focus:outline-none transition-colors duration-200 p-1 rounded-full hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 