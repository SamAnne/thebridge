import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { logout } from '../lib/auth';
import AppHeader from '../components/AppHeader';
import type { Settings } from './AdminSettings.loader';
import './AdminSettings.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
    hubName: string;
    contactEmail: string;
    defaultCounty: string;
    acceptingSubmissions: boolean;
}

function AdminSettings() {
    const { settings, error: loadError, currentUser } = useLoaderData() as {
        settings: Settings | null;
        error: string | null;
        currentUser: { email: string; role: string };
    };
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>({
        hubName: settings?.hubName ?? '',
        contactEmail: settings?.contactEmail ?? '',
        defaultCounty: settings?.defaultCounty ?? '',
        acceptingSubmissions: settings?.acceptingSubmissions ?? true,
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saved, setSaved] = useState(false);

    async function handleLogout() {
        await logout();
        navigate('/Login');
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaveError('');
        setSaved(false);

        const hubName = form.hubName.trim();
        const contactEmail = form.contactEmail.trim();
        if (!hubName) {
            setSaveError('Hub name cannot be empty.');
            return;
        }
        if (!EMAIL_PATTERN.test(contactEmail)) {
            setSaveError('Enter a valid contact email address.');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch('http://localhost:5000/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    hubName,
                    contactEmail,
                    defaultCounty: form.defaultCounty.trim(),
                    acceptingSubmissions: form.acceptingSubmissions,
                }),
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                setSaveError(data.error || 'Could not save settings.');
                return;
            }
            setForm({
                hubName: data.hubName,
                contactEmail: data.contactEmail,
                defaultCounty: data.defaultCounty ?? '',
                acceptingSubmissions: data.acceptingSubmissions,
            });
            setSaved(true);
        } catch {
            setSaveError('Could not save settings.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <AppHeader user={currentUser} onLogout={handleLogout} />
            <div className="page admin-settings__page">
                <div className="page__header">
                    <div>
                        <h1 className="page__title">Platform Settings</h1>
                        <p className="page__subtitle">Configure hub-wide details and resource submission access.</p>
                    </div>
                </div>

                {loadError && <p className="alert-error">{loadError}</p>}

                {!loadError && (
                    <div className="admin-settings__content">
                        <form onSubmit={handleSave} noValidate>
                            <div className="card admin-settings__section">
                                <h2 className="admin-settings__section-title">Hub information</h2>
                                <div className="field">
                                    <label htmlFor="hubName">Hub name</label>
                                    <input
                                        id="hubName"
                                        type="text"
                                        value={form.hubName}
                                        onChange={e => setForm(f => ({ ...f, hubName: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="field">
                                    <label htmlFor="contactEmail">Contact email</label>
                                    <input
                                        id="contactEmail"
                                        type="email"
                                        value={form.contactEmail}
                                        onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="field">
                                    <label htmlFor="defaultCounty">Default county</label>
                                    <input
                                        id="defaultCounty"
                                        type="text"
                                        value={form.defaultCounty}
                                        onChange={e => setForm(f => ({ ...f, defaultCounty: e.target.value }))}
                                        placeholder="e.g. Utah"
                                    />
                                </div>
                            </div>

                            <div className="card admin-settings__section">
                                <h2 className="admin-settings__section-title">Resource submissions</h2>
                                <label className="toggle" htmlFor="acceptingSubmissions">
                                    <input
                                        id="acceptingSubmissions"
                                        type="checkbox"
                                        className="toggle__input"
                                        checked={form.acceptingSubmissions}
                                        onChange={e => setForm(f => ({ ...f, acceptingSubmissions: e.target.checked }))}
                                    />
                                    <span className="toggle__track" aria-hidden="true">
                                        <span className="toggle__thumb"></span>
                                    </span>
                                    <span className="toggle__label-text">Accept resource submissions</span>
                                </label>
                                <p className="admin-settings__toggle-hint">
                                    When turned off, counselors cannot submit new resources until it's turned back on.
                                </p>
                            </div>

                            {saveError && <p className="alert-error">{saveError}</p>}
                            {saved && !saveError && <p className="alert-success">Settings saved.</p>}

                            <button className="btn btn--primary" type="submit" disabled={saving}>
                                {saving ? 'Saving…' : 'Save changes'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </>
    );
}

export default AdminSettings;
