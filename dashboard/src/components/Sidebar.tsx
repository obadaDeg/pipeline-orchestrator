import { Briefcase, LogOut, User, Users, Zap } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Pipelines', icon: Zap, end: true },
  { to: '/jobs', label: 'Jobs', icon: Briefcase, end: false },
  { to: '/teams', label: 'Teams', icon: Users, end: false },
  { to: '/account', label: 'Account', icon: User, end: false },
];

export function Sidebar() {
  const { userEmail, logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <Zap size={22} className="text-indigo-600 shrink-0" />
        <span className="ml-2 font-semibold text-gray-900 text-sm">Pipeline Orchestrator</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 p-4">
        <p className="text-xs text-gray-500 truncate mb-2">{userEmail ?? ''}</p>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
