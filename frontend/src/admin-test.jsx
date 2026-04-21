import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import AdminPanel from './components/AdminPanel';
import './index.css';

const App = () => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="min-h-screen bg-[#0c0c18]">
      {!isOpen && (
        <div className="flex items-center justify-center h-screen">
          <button
            onClick={() => setIsOpen(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold"
          >
            Открыть Админ Панель
          </button>
        </div>
      )}
      <AdminPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
