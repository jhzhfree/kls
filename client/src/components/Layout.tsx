import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Database, Shield, Brain, GraduationCap, BookOpen, Activity
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/', label: '总览', icon: LayoutDashboard },
  { to: '/kb', label: '知识库', icon: Database },
  { to: '/governance', label: '知识治理', icon: Shield },
  { to: '/model-training', label: '模型训练', icon: Brain },
  { to: '/training', label: '知识培训', icon: GraduationCap },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <BookOpen className="w-7 h-7 text-primary-600 mr-2" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            KLS 知识库平台
          </span>
        </div>

        {/* 导航 */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon className="w-5 h-5 mr-3" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* 底部状态 */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center text-xs text-gray-500">
            <Activity className="w-3.5 h-3.5 mr-1.5 text-green-500" />
            <span>系统运行中</span>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
