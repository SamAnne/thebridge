import { useState, useRef, useEffect } from "react"
import { useLoaderData, useNavigate, redirect } from 'react-router-dom';
import { logout } from '../lib/auth';
import AppHeader from '../components/AppHeader';
import './Dashboard.css';

// /api/me and /api/resources/unseen are fetched concurrently. Unlike the
// other admin pages, /api/me stays the authoritative check here: Dashboard
// is legitimately shared by two roles, and the unseen-queue endpoint
// rejecting a counselor is expected, not a sign they should be logged out.
// The counselor's "wasted" parallel call to an admin-only endpoint is
// rejected by a single fast DB check, so it costs them no real time.
export async function loader(){
    const [meResult, resourcesResult] = await Promise.all([
        fetch('http://localhost:5000/api/me', { credentials: 'include' }).then(r => r.json()).catch(() => null),
        fetch('http://localhost:5000/api/resources/unseen', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]);

    if (!meResult || meResult.error || !['admin', 'counselor'].includes(meResult.role)) {
        throw redirect('/Login');
    }

    if (meResult.role === 'admin'){
        const resources = Array.isArray(resourcesResult) ? resourcesResult : [];
        return [meResult, resources];
    }
    return [meResult, null];
};


function DocumentPreview({ name, url }: { name: string, url: string } ){
    if (!url) return null;
    const isPdf = name ? name.toLowerCase().endsWith('.pdf') : '';

    return (
        <div className="resource-card__preview">
        <h4>Document Preview: {name}</h4>

        {/* this only works if the user has their browser settings as display files instead of downloading them */}
        {isPdf ? (
            <iframe
            src={`${url}#toolbar=0`}
            title="PDF Preview"
            width="100%"
            height="600px"
            style={{ border: 'none', borderRadius: '4px' }}
            />
        ) : (
            <iframe
            src={`https://live.com{encodeURIComponent(fileUrl)}`}
            title="Word Document Preview"
            width="100%"
            height="600px"
            style={{ border: 'none', borderRadius: '4px' }}
            />
        )}
        </div>
    );
}

function FileRowItem({ name, url }: { name: string, url: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="resource-card__file-row">
      <button type="button" className="file-preview-link" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'Hide' : '▶ Preview'} {name}
      </button>
      {isOpen && <DocumentPreview name={name} url={url} />}
    </div>
  );
}

function truncate(text: string, max = 90) {
    if (!text) return 'No description provided';
    if (text.length <= max) return text;
    return text.slice(0, max).trimEnd() + '…';
}

// placeholder
function Dashboard() {

    interface User {
        id: number;
        email: string;
        role?: string;
    }

    interface Resource {
        id: number;
        user: User;
        description: string;
        status: string;
        note: string;
        date: string;
        files: File[];
    }

    interface File {
        id: number;
        url: string;
        fileName: string;
        resourceId: number;
    }

    const items = useLoaderData() as any[]
    const [user, setUser] = useState<User>(items[0]);
    const [unseenResources, setUnseenResources] = useState<Resource[] | null>(items[1]);
    const descriptionVal = useRef<HTMLInputElement>(null);
    const noteVal = useRef<HTMLInputElement>(null);
    const fileVal = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate('/Login');
    }

    async function postStatus(status: string, id: number) {
        try {
            const note = noteVal.current?.value;
            await fetch('http://localhost:5000/api/resources/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id, status, note }),
            });
            setUnseenResources(prevItems => (prevItems || []).filter(item => item.id !== id));
        }
        catch(err){
            setError('Could not set status of resource.')
        }
    }

    async function postResource(e: React.SubmitEvent){
        e.preventDefault();
        // add loading?
        try {
            setError('');
            const formData = new FormData();
            const files = fileVal.current?.files;
            formData.append('description', descriptionVal.current?.value || '');
            if (files){
                for (const file of Array.from(files)) {
                    const allowedTypes = [
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    ];

                    if (!allowedTypes.includes(file.type)) {
                        setError('File type not allowed');
                        return;
                    }
                    formData.append('files', file);
                }
            }

            await fetch('http://localhost:5000/api/resources', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            console.log('added resource');
            alert('Successfully added resource!');
        }
        catch (error) {
            setError('Could not add resource');
        }
    }


    useEffect(() => {
        setUser(items[0]);
        setUnseenResources(items[1]);
    }, [items]);


    return (
    <>
        {user && <AppHeader user={{ email: user.email, role: user.role ?? '' }} onLogout={handleLogout} />}
        <div className="page">
        {/* when signing up, check email for the domain and add appropriate role depending on if the domain is one of the districts, otherwise public role selected (student/parent) */}
        {user && (
            <div className="page__header">
                <div>
                    <h1 className="page__title">Dashboard</h1>
                    <p className="page__subtitle">
                        {user.role === 'admin'
                            ? 'Review submitted resources awaiting approval.'
                            : 'Submit resources for review.'}
                    </p>
                </div>
            </div>
        )}
        {user && user.role === 'admin' && (
            // add files
            // order resources by oldest to newest (add options for otherwise?)
            //adding resources
            //review q
            <div>
                <div className="dashboard__section-header">
                    <h4>Review Queue</h4>
                    {unseenResources && unseenResources.length > 0 && (
                        <span className="dashboard__queue-count">{unseenResources.length} pending</span>
                    )}
                </div>
                {unseenResources?.length === 0 && <p className="empty-state">No resources in review queue currently.</p>}
                <div className="resource-list">
                    {unseenResources && unseenResources.map((resource) =>
                    (
                        <div className="card resource-card" key={resource.id}>
                            <p className="resource-card__description">{truncate(resource.description)}</p>
                            {resource.files.length > 0 && (
                                <div className="resource-card__files">{resource.files.map((file, index) => (
                                    <FileRowItem key={index} name={file.fileName} url={file.url} />
                                )
                                )}
                                </div>
                            )}
                            <span className="resource-card__date">Submitted {new Date(resource.date).toLocaleString()}</span>
                            <div className="resource-card__note">
                                <input type="text" ref={noteVal} placeholder="Notes for the submitter (optional)"></input>
                            </div>
                            <div className="resource-card__actions">
                                <button className="btn btn--primary btn--small" onClick={() => postStatus('approved', resource.id)}>Approve</button>
                                <button className="btn btn--outline btn--small" onClick={() => postStatus('revision', resource.id)}>Revision Needed</button>
                                <button className="btn btn--danger-outline btn--small" onClick={() => postStatus('rejected', resource.id)}>Reject</button>
                            </div>
                        </div>
                    )
                    )}
                </div>
            </div>

        )}

        {user && user.role === 'counselor' && (
            //submitting resources
            <div className="card">
                <h5>Submit a Resource</h5>
                <form onSubmit={postResource}>
                    <div className="field">
                        <label htmlFor="description">Description</label>
                        <input
                            id="description"
                            type='text'
                            ref={descriptionVal}
                            placeholder="Description goes here"
                            required
                        >
                        </input>
                    </div>
                    <div className="field">
                        <label htmlFor="files">Select file/s</label>
                        <input
                            id="files"
                            type="file"
                            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            multiple
                            ref={fileVal}
                        >
                        </input>
                    </div>
                    {error.length > 0 && (<p className="alert-error">{error}</p>)}
                    <button className="btn btn--primary" type='submit'>Submit Resource</button>
                </form>
            </div>
            // add all of user resources? with notes and status
        )}

        </div>
    </>
    )
}

export default Dashboard
