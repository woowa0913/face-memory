import React from 'react';
import { Icons } from './Icon';

interface NavBarProps {
  currentView: 'home' | 'learn' | 'manage';
  setView: (view: 'home' | 'learn' | 'manage') => void;
}

export const NavBar: React.FC<NavBarProps> = ({ currentView, setView }) => {
  const navItem = (view: 'home' | 'learn' | 'manage', label: string, Icon: React.ElementType) => (
    <button
      onClick={() => setView(view)}
      className={`flex flex-col items-center justify-center w-full py-3 transition-colors ${
        currentView === view ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-500'
      }`}
    >
      <Icon size={24} strokeWidth={currentView === view ? 2.5 : 2} />
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg pb-safe z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItem('home', '대시보드', Icons.Users)}
        {navItem('learn', '퀴즈', Icons.Brain)}
        {navItem('manage', '사진 추가', Icons.Plus)}
      </div>
    </nav>
  );
};