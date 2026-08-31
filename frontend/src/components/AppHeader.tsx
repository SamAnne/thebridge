import { Link, useLocation } from 'react-router-dom';
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
    { to: '/Admin/Settings', label: 'Settings' },
];

function AppHeader({ user, onLogout }: AppHeaderProps) {
    const location = useLocation();
    const isAdmin = user.role === 'admin';

    return (
        <header className="app-header">
            <div className="app-header__bar">
                <div className="app-header__identity">
                    <Link to="/Dashboard" className="app-header__brand">The Bridge</Link>
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
                    <button className="btn btn--ghost btn--small" onClick={onLogout}>Logout</button>
                </div>
            </div>
        </header>
    );
}

export default AppHeader;
