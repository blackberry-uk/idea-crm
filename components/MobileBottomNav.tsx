import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Lightbulb, CalendarCheck, Users, Settings } from 'lucide-react';

const MobileBottomNav: React.FC = () => {
  const location = useLocation();

  const items = [
    { path: '/', icon: LayoutDashboard, label: 'Home' },
    { path: '/ideas', icon: Lightbulb, label: 'Ideas' },
    { path: '/daily', icon: CalendarCheck, label: 'Calendar' },
    { path: '/contacts', icon: Users, label: 'Contacts' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {items.map(item => {
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`mobile-bottom-nav-item ${isActive ? 'mobile-bottom-nav-item--active' : ''}`}
          >
            <item.icon className="mobile-bottom-nav-icon" />
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
