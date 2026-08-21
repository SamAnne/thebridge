import { useLoaderData, Link, useNavigate } from 'react-router-dom';
import { requireRole, logout } from '../lib/auth';
import './AdminUsers.css';

interface RegisteredUser {
    id: number;
    email: string;
    district: string | null;
    county: string | null;
    createdAt: string;
    role: { role: string };
}

export async function loader() {
    await requireRole('admin');
    const response = await fetch('http://localhost:5000/api/users', {
        credentials: 'include'
    });
    const users = await response.json();
    return users as RegisteredUser[];
}

function AdminUsers() {
    const users = useLoaderData() as RegisteredUser[];
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate('/Login');
    }

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <p className="page__eyebrow">Admin</p>
                    <h1 className="page__title">Registered Users</h1>
                    <p className="page__subtitle">{users.length} account{users.length === 1 ? '' : 's'}</p>
                </div>
                <div className="page__header-actions">
                    <Link className="btn btn--outline btn--small" to="/Dashboard">Back to Dashboard</Link>
                    <button className="btn btn--outline btn--small" onClick={handleLogout}>Logout</button>
                </div>
            </div>

            <div className="card admin-users__card">
                <table className="admin-users__table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Role</th>
                            <th>District</th>
                            <th>County</th>
                            <th>Join Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>{user.email}</td>
                                <td>
                                    <span className={`role-pill role-pill--${user.role.role}`}>
                                        {user.role.role}
                                    </span>
                                </td>
                                <td className={user.district ? '' : 'admin-users__muted'}>{user.district ?? '—'}</td>
                                <td className={user.county ? '' : 'admin-users__muted'}>{user.county ?? '—'}</td>
                                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AdminUsers;
