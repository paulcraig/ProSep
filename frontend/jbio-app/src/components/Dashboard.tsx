import './Dashboard.css';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';

import { IconButton } from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeIcon from '@mui/icons-material/DarkMode';


type Page = {
  id?: string | number; // string / int / null
  label?: string;
  icon: React.ReactNode;
  component?: React.ReactNode;
  onClick?: () => void;
  link?: string;
};


type DashboardProps = {
  pages: Page[];
  homepage?: string | number;
  darkmode?: boolean;
  logo: string;
};


const slugify = (text: string) => {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
}


const Dashboard: React.FC<DashboardProps> = ({ pages, homepage, darkmode = false, logo }) => {
  const normPages = pages.map((page, idx) => {
    const slug = page.label ? slugify(page.label) : page.id !== undefined ? String(page.id) : `page-${idx + 1}`;
    return { ...page, slug };
  });

  const defaultHome = homepage !== undefined
    ? normPages.find((p) => p.id === homepage || p.slug === homepage)?.slug ?? normPages[0]?.slug ?? ''
    : normPages[0]?.slug ?? '';

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('dashboard-collapsed');
    return saved === 'true';
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dashboard-theme');
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
    return darkmode;
  });

  useEffect(() => {
    localStorage.setItem('dashboard-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem('dashboard-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <Router>
      <div className='dashboard' data-theme={isDarkMode ? 'dark' : 'light'}>

        {/* Sidebar */}
        <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
          <div className='sidebar-nav'>
            {normPages.map((page) => {
              if (page.link) {
                return (
                  <a
                    key={page.slug}
                    href={page.link}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='nav-link'
                  >
                    <div className='icon'>{page.icon}</div>
                    {!collapsed && <span>{page.label ?? page.slug}</span>}
                  </a>
                );
              }
              if (page.onClick) {
                return (
                  <button key={page.slug} onClick={page.onClick} className='nav-link'>
                    <div className='icon'>{page.icon}</div>
                    {!collapsed && <span>{page.label ?? page.slug}</span>}
                  </button>
                );
              }
              return (
                <NavLink
                  key={page.slug}
                  to={`/${page.slug}`}
                  className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                >
                  <div className='icon'>{page.icon}</div>
                  {!collapsed && <span>{page.label ?? page.slug}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className='main'>
          <div className='header'>
            <div className='header-left'>
              <IconButton className='collapse-btn' onClick={() => setCollapsed(!collapsed)} size='large'>
                {collapsed ? <MenuRoundedIcon /> : <MenuOpenRoundedIcon />}
              </IconButton>
              <div className='logo-container'>
                <img src={logo} alt='logo' className='logo' />
              </div>
            </div>
            <div className='header-right'>
              <IconButton onClick={() => setIsDarkMode(!isDarkMode)} size='large'>
                {isDarkMode ? (
                  <LightModeRoundedIcon className='sun-btn' />
                ) : (
                  <DarkModeIcon className='moon-btn' />
                )}
              </IconButton>
            </div>
          </div>

          <div className='content'>
            <Routes>
              {normPages.map((page) =>
                page.component ? (
                  <Route key={page.slug} path={`/${page.slug}`} element={page.component} />
                ) : null
              )}
              <Route path='*' element={<Navigate to={`/${defaultHome}`} replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
};

export default Dashboard;
