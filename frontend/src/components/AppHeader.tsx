import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FALLBACK_HUB_NAME, getHubName } from '../lib/hubBranding';
import './AppHeader.css';

interface AppHeaderUser {
    email: string;
    role: string;
}

interface AppHeaderProps {
    user: AppHeaderUser;
    onLogout: () => void | Promise<void>;
}

const ADMIN_NAV_ITEMS = [
    { to: '/Dashboard', label: 'Dashboard' },
    { to: '/Admin/Resources', label: 'Resources' },
    { to: '/Admin/Users', label: 'Users' },
];

// Small inline gear glyph - no icon library in this project, and adding
// one solely for a single settings icon isn't worth the dependency.
function GearIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="3.2" />
            <circle cx="12" cy="12" r="7.5" />
            <line x1="12" y1="2.2" x2="12" y2="4.8" />
            <line x1="12" y1="19.2" x2="12" y2="21.8" />
            <line x1="2.2" y1="12" x2="4.8" y2="12" />
            <line x1="19.2" y1="12" x2="21.8" y2="12" />
            <line x1="5.3" y1="5.3" x2="7.1" y2="7.1" />
            <line x1="16.9" y1="16.9" x2="18.7" y2="18.7" />
            <line x1="18.7" y1="5.3" x2="16.9" y2="7.1" />
            <line x1="7.1" y1="16.9" x2="5.3" y2="18.7" />
        </svg>
    );
}

function AppHeader({ user, onLogout }: AppHeaderProps) {
    const location = useLocation();
    const isAdmin = user.role === 'admin';
    const isOnSettings = location.pathname === '/Admin/Settings';
    const [hubName, setHubName] = useState(FALLBACK_HUB_NAME);

    useEffect(() => {
        let cancelled = false;
        getHubName().then(name => {
            if (!cancelled) setHubName(name);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <header className="app-header">
            <div className="app-header__bar">
                <div className="app-header__identity">
                    <Link to="/Dashboard" className="app-header__brand">{hubName}</Link>
                    {isAdmin && <span className="app-header__badge">Admin</span>}
                </div>

                {isAdmin && (
                    <nav className="app-header__nav" aria-label="Admin">
                        {ADMIN_NAV_ITEMS.map(item => {
                            const isActive = location.pathname === item.to;
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className="app-header__nav-link"
                                    aria-current={isActive ? 'page' : undefined}
                                    data-active={isActive || undefined}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                )}

                <div className="app-header__utility">
                    <span className="app-header__user">
                        {user.email} <span className={`role-pill role-pill--${user.role}`}>{user.role}</span>
                    </span>
                    {isAdmin && (
                        <Link
                            to="/Admin/Settings"
                            className="app-header__icon-link"
                            aria-label="Settings"
                            title="Settings"
                            aria-current={isOnSettings ? 'page' : undefined}
                            data-active={isOnSettings || undefined}
                        >
                            <GearIcon />
                        </Link>
                    )}
                    <button className="btn btn--ghost btn--small" onClick={onLogout}>Logout</button>
                </div>
            </div>
        </header>
    );
}

export default AppHeader;
