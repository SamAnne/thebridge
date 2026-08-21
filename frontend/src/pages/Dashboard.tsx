import { useState, useRef, useEffect } from "react"
import { useLoaderData, Link, useNavigate } from 'react-router-dom';
import { requireRole, logout } from '../lib/auth';
import './Dashboard.css';

export async function loader(){
    const user = await requireRole('admin', 'counselor');
    if (user.role === 'admin'){
        const response = await fetch('http://localhost:5000/api/resources/unseen', {
            credentials: 'include'
        });
        const resources = await response.json();
        return [user, resources];
    }
    return [user, null];
};


function DocumentPreview({ name, url }: { name: string, url: string } ){
    if (!url) return null;
    const isPdf = name ? name.toLowerCase().endsWith('.pdf') : '';

    return (
        <div style={{ marginTop: '1.5rem', border: '1px solid #ccc', borderRadius: '8px', padding: '1rem' }}>
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
    <div style={{ marginBottom: '1rem' }}>
      <button type="button" className="file-preview-link" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'Hide' : '▶ Preview'} {name}
      </button>
      {isOpen && <DocumentPreview name={name} url={url} />}
    </div>
  );
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
    <div className="page">
        {/* when signing up, check email for the domain and add appropriate role depending on if the domain is one of the districts, otherwise public role selected (student/parent) */}
        {user && (
            <div className="page__header">
                <div>
                    <p className="page__eyebrow">The Bridge</p>
                    <h1 className="page__title">Dashboard</h1>
                    <p className="dashboard__greeting">
                        {user.email} <span className={`role-pill role-pill--${user.role}`}>{user.role}</span>
                    </p>
                </div>
                <div className="page__header-actions">
                    {user.role === 'admin' && (
                        <Link className="btn btn--outline btn--small" to="/Admin/Users">Registered Users</Link>
                    )}
                    <button className="btn btn--outline btn--small" onClick={handleLogout}>Logout</button>
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
                </div>
                {unseenResources?.length === 0 && <p>No resources in review queue currently.</p>}
                <div className="resource-grid">
                    {unseenResources && unseenResources.map((resource, index) =>
                    (
                        <div className="card resource-card" key={resource.id}>
                            <h4>Resource {index}</h4>
                            <p>{resource.description}</p>
                            <div>{resource.files.map((file, index) => (
                                <FileRowItem key={index} name={file.fileName} url={file.url} />
                            )
                            )}
                            </div>
                            <span className="resource-card__date">{new Date(resource.date).toLocaleString()}</span>
                            <div className="resource-card__note">
                                <input type="text" ref={noteVal} placeholder="Notes ..."></input>
                            </div>
                            <div className="resource-card__actions">
                                <button className="btn btn--primary btn--small" onClick={() => postStatus('approved', resource.id)}>Approve</button>
                                <button className="btn btn--outline btn--small" onClick={() => postStatus('rejected', resource.id)}>Reject</button>
                                <button className="btn btn--outline btn--small" onClick={() => postStatus('revision', resource.id)}>Revision Needed</button>
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
    )
}

export default Dashboard