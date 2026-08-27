import { useMemo, useState } from 'react';
import { useLoaderData, Link, useNavigate } from 'react-router-dom';
import { logout } from '../lib/auth';
import type { AdminResource } from './AdminResources.loader';
import './AdminResources.css';

const STATUS_LABELS: Record<string, string> = {
    unseen: 'Unseen',
    approved: 'Approved',
    rejected: 'Rejected',
    revision: 'Revision Needed',
};

interface EditForm {
    description: string;
    countiesText: string;
    districtsText: string;
}

function truncate(text: string, max = 140) {
    if (text.length <= max) return text;
    return text.slice(0, max).trimEnd() + '…';
}

function parseTags(value: string): string[] {
    return value.split(',').map(v => v.trim()).filter(Boolean);
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString();
}

function AdminResources() {
    const { resources: loaderResources, error: loadError } = useLoaderData() as {
        resources: AdminResource[];
        error: string | null;
    };
    const [resources, setResources] = useState(loaderResources);
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [publishedFilter, setPublishedFilter] = useState('all');

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({ description: '', countiesText: '', districtsText: '' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const [confirmingUnpublishId, setConfirmingUnpublishId] = useState<number | null>(null);
    const [publishingId, setPublishingId] = useState<number | null>(null);
    const [publishErrorId, setPublishErrorId] = useState<number | null>(null);
    const [publishError, setPublishError] = useState('');

    const filteredResources = useMemo(() => {
        const q = search.trim().toLowerCase();
        return resources.filter(resource => {
            if (statusFilter !== 'all' && resource.status !== statusFilter) return false;
            if (publishedFilter === 'published' && !resource.published) return false;
            if (publishedFilter === 'unpublished' && resource.published) return false;
            if (!q) return true;
            return resource.description.toLowerCase().includes(q);
        });
    }, [resources, search, statusFilter, publishedFilter]);

    async function handleLogout() {
        await logout();
        navigate('/Login');
    }

    function startEdit(resource: AdminResource) {
        setEditingId(resource.id);
        setEditForm({
            description: resource.description,
            countiesText: resource.counties.join(', '),
            districtsText: resource.districts.join(', '),
        });
        setSaveError('');
        setConfirmingUnpublishId(null);
    }

    function cancelEdit() {
        setEditingId(null);
        setSaveError('');
    }

    async function saveEdit(id: number) {
        const description = editForm.description.trim();
        if (!description) {
            setSaveError('Description cannot be empty.');
            return;
        }

        setSaving(true);
        setSaveError('');
        try {
            const response = await fetch(`http://localhost:5000/api/resources/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    description,
                    counties: parseTags(editForm.countiesText),
                    districts: parseTags(editForm.districtsText),
                }),
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                setSaveError(data.error || 'Could not save changes.');
                return;
            }
            setResources(prev => prev.map(r => (r.id === id ? data : r)));
            setEditingId(null);
        } catch {
            setSaveError('Could not save changes.');
        } finally {
            setSaving(false);
        }
    }

    async function publish(resource: AdminResource) {
        setPublishingId(resource.id);
        setPublishErrorId(null);
        setPublishError('');
        try {
            const response = await fetch(`http://localhost:5000/api/resources/${resource.id}/publish`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                setPublishErrorId(resource.id);
                setPublishError(data.error || 'Could not publish this resource.');
                return;
            }
            setResources(prev => prev.map(r => (r.id === resource.id ? data : r)));
        } catch {
            setPublishErrorId(resource.id);
            setPublishError('Could not publish this resource.');
        } finally {
            setPublishingId(null);
        }
    }

    async function confirmUnpublish(resource: AdminResource) {
        setPublishingId(resource.id);
        setPublishErrorId(null);
        setPublishError('');
        try {
            const response = await fetch(`http://localhost:5000/api/resources/${resource.id}/unpublish`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                setPublishErrorId(resource.id);
                setPublishError(data.error || 'Could not unpublish this resource.');
                return;
            }
            setResources(prev => prev.map(r => (r.id === resource.id ? data : r)));
            setConfirmingUnpublishId(null);
        } catch {
            setPublishErrorId(resource.id);
            setPublishError('Could not unpublish this resource.');
        } finally {
            setPublishingId(null);
        }
    }

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <p className="page__eyebrow">Admin</p>
                    <h1 className="page__title">Resource Management</h1>
                    <p className="page__subtitle">
                        {filteredResources.length === resources.length
                            ? `${resources.length} resource${resources.length === 1 ? '' : 's'}`
                            : `${filteredResources.length} of ${resources.length} resources`}
                    </p>
                </div>
                <div className="page__header-actions">
                    <Link className="btn btn--outline btn--small" to="/Dashboard">Back to Dashboard</Link>
                    <button className="btn btn--outline btn--small" onClick={handleLogout}>Logout</button>
                </div>
            </div>

            {loadError && (
                <p className="alert-error">{loadError}</p>
            )}

            {!loadError && (
                <>
                    <div className="admin-resources__filters">
                        <input
                            type="text"
                            className="admin-resources__search"
                            placeholder="Search by description..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            aria-label="Search resources"
                        />
                        <select
                            className="admin-resources__select"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            aria-label="Filter by review status"
                        >
                            <option value="all">All review statuses</option>
                            <option value="unseen">Unseen</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="revision">Revision Needed</option>
                        </select>
                        <select
                            className="admin-resources__select"
                            value={publishedFilter}
                            onChange={e => setPublishedFilter(e.target.value)}
                            aria-label="Filter by publication state"
                        >
                            <option value="all">Published + unpublished</option>
                            <option value="published">Published only</option>
                            <option value="unpublished">Unpublished only</option>
                        </select>
                    </div>

                    {resources.length === 0 ? (
                        <p className="admin-resources__empty">No resources yet.</p>
                    ) : filteredResources.length === 0 ? (
                        <p className="admin-resources__empty">No resources match your filters.</p>
                    ) : (
                        <div className="admin-resources__list">
                            {filteredResources.map(resource => {
                                const isEditing = editingId === resource.id;
                                const isConfirmingUnpublish = confirmingUnpublishId === resource.id;
                                const isBusy = publishingId === resource.id;

                                return (
                                    <div className="card admin-resources__card" key={resource.id}>
                                        {isEditing ? (
                                            <>
                                                <div className="field">
                                                    <label htmlFor={`description-${resource.id}`}>Description</label>
                                                    <textarea
                                                        id={`description-${resource.id}`}
                                                        className="admin-resources__edit-textarea"
                                                        value={editForm.description}
                                                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="field">
                                                    <label htmlFor={`counties-${resource.id}`}>Counties (comma-separated)</label>
                                                    <input
                                                        id={`counties-${resource.id}`}
                                                        className="admin-resources__edit-input"
                                                        value={editForm.countiesText}
                                                        onChange={e => setEditForm(f => ({ ...f, countiesText: e.target.value }))}
                                                        placeholder="e.g. Utah, Wasatch"
                                                    />
                                                </div>
                                                <div className="field">
                                                    <label htmlFor={`districts-${resource.id}`}>Districts (comma-separated)</label>
                                                    <input
                                                        id={`districts-${resource.id}`}
                                                        className="admin-resources__edit-input"
                                                        value={editForm.districtsText}
                                                        onChange={e => setEditForm(f => ({ ...f, districtsText: e.target.value }))}
                                                        placeholder="e.g. Alpine School District"
                                                    />
                                                </div>
                                                {saveError && <p className="alert-error">{saveError}</p>}
                                                <div className="admin-resources__actions">
                                                    <button className="btn btn--primary btn--small" disabled={saving} onClick={() => saveEdit(resource.id)}>
                                                        {saving ? 'Saving…' : 'Save'}
                                                    </button>
                                                    <button className="btn btn--outline btn--small" disabled={saving} onClick={cancelEdit}>Cancel</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="admin-resources__badges">
                                                    <div>
                                                        <span className="admin-resources__badge-label">Review status</span>
                                                        <span className={`review-status-pill review-status-pill--${resource.status}`}>
                                                            {STATUS_LABELS[resource.status] ?? resource.status}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="admin-resources__badge-label">Public visibility</span>
                                                        <span className={`publication-pill publication-pill--${resource.published ? 'published' : 'unpublished'}`}>
                                                            {resource.published ? 'Published' : 'Unpublished'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <p className="admin-resources__description">{truncate(resource.description)}</p>

                                                <div className="admin-resources__tags">
                                                    <div>
                                                        <strong>Counties:</strong>{' '}
                                                        {resource.counties.length === 0 ? (
                                                            <span className="admin-resources__muted">No counties tagged</span>
                                                        ) : (
                                                            resource.counties.map(county => (
                                                                <span className="tag-pill" key={county}>{county}</span>
                                                            ))
                                                        )}
                                                    </div>
                                                    <div>
                                                        <strong>Districts:</strong>{' '}
                                                        {resource.districts.length === 0 ? (
                                                            <span className="admin-resources__muted">No districts tagged</span>
                                                        ) : (
                                                            resource.districts.map(district => (
                                                                <span className="tag-pill" key={district}>{district}</span>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="admin-resources__files">
                                                    <strong>Files:</strong>{' '}
                                                    {resource.files.length === 0 ? (
                                                        <span className="admin-resources__muted">None attached</span>
                                                    ) : (
                                                        resource.files.map(file => (
                                                            <a key={file.id} href={file.url} target="_blank" rel="noreferrer">
                                                                {file.fileName}
                                                            </a>
                                                        ))
                                                    )}
                                                </div>

                                                <p className="admin-resources__meta">
                                                    Submitted {formatDate(resource.date)} by {resource.user.email} · Updated {formatDate(resource.updatedAt)}
                                                </p>

                                                <div className="admin-resources__actions">
                                                    <button className="btn btn--outline btn--small" onClick={() => startEdit(resource)}>Edit</button>

                                                    {resource.published ? (
                                                        isConfirmingUnpublish ? (
                                                            <span className="admin-resources__confirm">
                                                                <span>Unpublish this resource? It will disappear from the public site.</span>
                                                                <button
                                                                    className="btn btn--danger btn--small"
                                                                    disabled={isBusy}
                                                                    onClick={() => confirmUnpublish(resource)}
                                                                >
                                                                    Yes, unpublish
                                                                </button>
                                                                <button
                                                                    className="btn btn--outline btn--small"
                                                                    disabled={isBusy}
                                                                    onClick={() => setConfirmingUnpublishId(null)}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </span>
                                                        ) : (
                                                            <button className="btn btn--outline btn--small" onClick={() => setConfirmingUnpublishId(resource.id)}>
                                                                Unpublish
                                                            </button>
                                                        )
                                                    ) : resource.status === 'approved' ? (
                                                        <button
                                                            className="btn btn--primary btn--small"
                                                            disabled={isBusy}
                                                            onClick={() => publish(resource)}
                                                        >
                                                            {isBusy ? 'Publishing…' : 'Publish'}
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button className="btn btn--primary btn--small" disabled>Publish</button>
                                                            <span className="admin-resources__muted admin-resources__hint">
                                                                Only approved resources can be published.
                                                            </span>
                                                        </>
                                                    )}
                                                </div>

                                                {publishErrorId === resource.id && (
                                                    <p className="alert-error admin-resources__inline-error">{publishError}</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default AdminResources;
