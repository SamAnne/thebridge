import { useMemo, useState } from 'react';
import { useLoaderData, Link, useNavigate } from 'react-router-dom';
import { requireRole, logout } from '../lib/auth';
import './AdminUsers.css';

interface RegisteredUser {
    id: number;
    name: string | null;
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

interface EditForm {
    name: string;
    district: string;
    county: string;
}

function AdminUsers() {
    const loaderUsers = useLoaderData() as RegisteredUser[];
    const [users, setUsers] = useState(loaderUsers);
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({ name: '', district: '', county: '' });
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);

    function startEdit(user: RegisteredUser) {
        setEditingId(user.id);
        setEditForm({ name: user.name ?? '', district: user.district ?? '', county: user.county ?? '' });
        setSaveError('');
    }

    function cancelEdit() {
        setEditingId(null);
        setSaveError('');
    }

    async function saveEdit(id: number) {
        setSaving(true);
        setSaveError('');
        try {
            const response = await fetch(`http://localhost:5000/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(editForm),
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                setSaveError(data.error || 'Could not save changes.');
                return;
            }
            setUsers(prev => prev.map(u => (u.id === id ? data : u)));
            setEditingId(null);
        } catch {
            setSaveError('Could not save changes.');
        } finally {
            setSaving(false);
        }
    }

    const roles = useMemo(
        () => Array.from(new Set(users.map(u => u.role.role))).sort(),
        [users]
    );

    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter(user => {
            if (roleFilter !== 'all' && user.role.role !== roleFilter) return false;
            if (!q) return true;
            return [user.name, user.email, user.district, user.county]
                .some(field => field?.toLowerCase().includes(q));
        });
    }, [users, search, roleFilter]);

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
                    <p className="page__subtitle">
                        {filteredUsers.length === users.length
                            ? `${users.length} account${users.length === 1 ? '' : 's'}`
                            : `${filteredUsers.length} of ${users.length} accounts`}
                    </p>
                </div>
                <div className="page__header-actions">
                    <Link className="btn btn--outline btn--small" to="/Dashboard">Back to Dashboard</Link>
                    <button className="btn btn--outline btn--small" onClick={handleLogout}>Logout</button>
                </div>
            </div>

            <div className="admin-users__filters">
                <input
                    type="text"
                    className="admin-users__search"
                    placeholder="Search by name, email, district, or county..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search users"
                />
                <select
                    className="admin-users__role-filter"
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                    aria-label="Filter by role"
                >
                    <option value="all">All roles</option>
                    {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>
            </div>

            <div className="card admin-users__card">
                {filteredUsers.length === 0 ? (
                    <p className="admin-users__empty">
                        {users.length === 0 ? 'No registered users yet.' : 'No users match your search.'}
                    </p>
                ) : (
                <table className="admin-users__table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>District</th>
                            <th>County</th>
                            <th>Join Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => {
                            const isEditing = editingId === user.id;
                            return (
                            <tr key={user.id}>
                                {isEditing ? (
                                    <>
                                        <td>
                                            <input
                                                className="admin-users__edit-input"
                                                value={editForm.name}
                                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                aria-label="Name"
                                            />
                                        </td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`role-pill role-pill--${user.role.role}`}>
                                                {user.role.role}
                                            </span>
                                        </td>
                                        <td>
                                            <input
                                                className="admin-users__edit-input"
                                                value={editForm.district}
                                                onChange={e => setEditForm(f => ({ ...f, district: e.target.value }))}
                                                aria-label="District"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                className="admin-users__edit-input"
                                                value={editForm.county}
                                                onChange={e => setEditForm(f => ({ ...f, county: e.target.value }))}
                                                aria-label="County"
                                            />
                                        </td>
                                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <div className="admin-users__actions">
                                                <button className="btn btn--primary btn--small" disabled={saving} onClick={() => saveEdit(user.id)}>Save</button>
                                                <button className="btn btn--outline btn--small" disabled={saving} onClick={cancelEdit}>Cancel</button>
                                            </div>
                                            {saveError && <p className="alert-error admin-users__edit-error">{saveError}</p>}
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className={user.name ? '' : 'admin-users__muted'}>{user.name ?? '—'}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`role-pill role-pill--${user.role.role}`}>
                                                {user.role.role}
                                            </span>
                                        </td>
                                        <td className={user.district ? '' : 'admin-users__muted'}>{user.district ?? '—'}</td>
                                        <td className={user.county ? '' : 'admin-users__muted'}>{user.county ?? '—'}</td>
                                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <button className="btn btn--outline btn--small" onClick={() => startEdit(user)}>Edit</button>
                                        </td>
                                    </>
                                )}
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
                )}
            </div>
        </div>
    );
}

export default AdminUsers;
