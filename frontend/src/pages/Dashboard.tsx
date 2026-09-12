import { useState, useRef, useEffect } from "react"
import { useLoaderData, useNavigate, redirect } from 'react-router-dom';
import { logout } from '../lib/auth';
import AppHeader from '../components/AppHeader';
import './Dashboard.css';
import '../App.css';

// /api/me, /api/resources/unseen, and /api/settings are fetched
// concurrently. Unlike the other admin pages, /api/me stays the
// authoritative check here: Dashboard is legitimately shared by two roles,
// and the unseen-queue endpoint rejecting a counselor is expected, not a
// sign they should be logged out. The "wasted" parallel calls to
// admin-only/role-gated endpoints are rejected by a single fast DB check,
// so they cost no real time either way.
export async function loader(){
    const [meResult, resourcesResult, settingsResult] = await Promise.all([
        fetch('http://localhost:5000/api/me', { credentials: 'include' }).then(r => r.json()).catch(() => null),
        fetch('http://localhost:5000/api/resources/unseen', { credentials: 'include' }).then(r => r.json()).catch(() => null),
        fetch('http://localhost:5000/api/settings', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]);

    if (!meResult || meResult.error || !['admin', 'counselor'].includes(meResult.role)) {
        throw redirect('/Login');
    }

    // Defaults to accepting submissions if settings couldn't be loaded -
    // this only affects what the counselor form shows; the real gate is
    // enforced server-side in POST /api/resources regardless.
    const acceptingSubmissions = settingsResult && typeof settingsResult.acceptingSubmissions === 'boolean'
        ? settingsResult.acceptingSubmissions
        : true;

    if (meResult.role === 'admin'){
        const resources = Array.isArray(resourcesResult) ? resourcesResult : [];
        return [meResult, resources, acceptingSubmissions];
    }
    if (meResult.role === 'counselor'){
        const response = await fetch('http://localhost:5000/api/resources/me', {
            credentials: 'include'
        });
        const resourcesCounselor = await response.json();
        console.log(resourcesCounselor);
        const resources = Array.isArray(resourcesCounselor) ? resourcesCounselor : [];
        return [meResult, resources, acceptingSubmissions];
    }
    return [meResult, null, acceptingSubmissions];
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
        user?: User;
        description: string;
        status: string;
        note: string;
        date: string;
        files: File[];
        error?: string;
    }

    interface File {
        id: number;
        url: string;
        fileName: string;
        resourceId: number;
        delete?: boolean;
    }

    const items = useLoaderData() as any[]
    const [user, setUser] = useState<User>(items[0]);
    const [acceptingSubmissions, setAcceptingSubmissions] = useState<boolean>(items[2]);
    const [unseenResources, setUnseenResources] = useState<Resource[]>(items[1]);
    const [counselorResources, setcounselorResources] = useState<Resource[]>(items[1]);
    const descriptionVal = useRef<HTMLInputElement>(null);
    // One note input per rendered card, keyed by resource id - a single
    // shared ref here would only ever point at the last-rendered card's
    // input, so a note typed on one resource could get submitted for
    // whichever resource's Approve/Reject/Revision button was clicked.
    const noteRefs = useRef<Map<number, HTMLInputElement>>(new Map());
    const fileVal = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const navigate = useNavigate();
    const updateResource = async (e: React.SubmitEvent<HTMLFormElement>, resourceId: Number) =>{
        e.preventDefault();
        console.log("resourceid is " + resourceId);
        try {
            const data = new FormData(e.currentTarget);
            const resource = counselorResources.find(resource => resource.id === resourceId);
            if (resource){
                resource.error = undefined;
                const deletedFileIds = resource.files
                    .filter(file => file.delete === true)
                    .map(file => file.id);
                const formData = new FormData();
                formData.append('description', data.get('description') || '');
                formData.append('removedFileIds', JSON.stringify(deletedFileIds || []));
                const files = data.getAll("files");
                // for ts
                const allFiles = files
                    .filter((file): file is globalThis.File => file instanceof File)
                    .filter((file) => file.size > 0);
                if (allFiles){
                    for (const file of Array.from(allFiles)) {
                        const allowedTypes = [
                        'application/pdf',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        ];

                        if (!allowedTypes.includes(file.type)) {
                            throw new Error('File type not allowed');
                        }
                        formData.append('newFiles', file);
                    }
                }
                console.log("finished appending");
                const res = await fetch('http://localhost:5000/api/resources/update' + resourceId, {
                    method: 'PATCH',
                    credentials: 'include',
                    body: formData,
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || 'Could not update resource');
                }
                const updatedResource = await res.json(); // { status, note, description, files } — no id, that's fine

                setcounselorResources((prev) =>
                    prev.map((r) =>
                        r.id === resourceId ? { ...r, ...updatedResource } : r
                    )
                );
            }
            console.log(data);
        }
        catch (error) {
            setcounselorResources((prev) =>
                prev.map((r) =>
                    r.id === resourceId ? { ...r, error: 'Something went wrong, could not updated resource' } : r
                )
            );
        }
    }

    function deleteFile(resourceId: number, fileId: number){
        // sets delete to true in counselorResources, but loads back when reloading
        // just for keeping track for updating the resource for resubmission
        setcounselorResources(counselorResources => counselorResources.map(resource => {
            if (resource.id === resourceId) {
            return {
                ...resource,
                files: resource.files.map(file => {
                if (file.id === fileId) {
                    return {
                    ...file,
                    delete: true 
                    };
                }
                return file; 
                })
            };
            }
            return resource;
        })
        );
    }

    async function handleLogout() {
        await logout();
        navigate('/Login');
    }

    function displayFileName(fileName: string): string {
        const underscoreIndex = fileName.indexOf('_');
        return underscoreIndex !== -1 ? fileName.slice(underscoreIndex + 1) : fileName;
    }

    async function postStatus(status: string, id: number) {
        try {
            const note = noteRefs.current.get(id)?.value;
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
            setConfirmation('');
            const formData = new FormData();
            const files = fileVal.current?.files;
            formData.append('description', descriptionVal.current?.value || '');
            // add a limit of 10
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

            const response = await fetch('http://localhost:5000/api/resources', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Could not update resource');
            }
            
            const updatedResource: any = await res.json(); // { status, note, description, files } — no id, that's fine
            const resource: Resource = {
                id: updatedResource.id,
                description: updatedResource.description,
                status: updatedResource.status,
                note: updatedResource.note,
                date: updatedResource.date,
                files: updatedResource.files.map((child: any) => ({
                    id: child.id,
                    url: child.url,
                    fileName: child.fileName,
                    resourceId: child.resourceId
                }))
            }
            setcounselorResources(prev => [...prev, resource]);
            setConfirmation("Successfully added resource!");
            descriptionVal.current && (descriptionVal.current.value = "");
            fileVal.current && (fileVal.current.value = "");
        }
        catch (error) {
            setError('Could not add resource');
        }
    }

    function getStatusColor(status: string): string {
        switch (status) {
            case 'approved': return 'green';
            case 'rejected': return 'orange';
            case 'revision': return 'red';
            case 'unseen': return 'gray';
            default: return 'gray';
        }
    }
    

    useEffect(() => {
        setUser(items[0]);
        setAcceptingSubmissions(items[2]);
        if (user.role === 'admin'){
            setUnseenResources(items[1]);
        }
        else if (user.role === 'counselor'){
            setcounselorResources(items[1])
        }
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
                                <input
                                    type="text"
                                    ref={el => {
                                        if (el) noteRefs.current.set(resource.id, el);
                                        else noteRefs.current.delete(resource.id);
                                    }}
                                    placeholder="Notes for the submitter (optional)"
                                ></input>
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
                {acceptingSubmissions ? (
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
                        <div className="file-div">
                            <button className="btn btn--primary" type='submit'>Submit Resource</button>
                            {confirmation.length > 0 && (<span className="success-txt">{confirmation}</span>)} 
                        </div>
                    </form>
                ) : (
                    <p className="empty-state">Submissions are currently closed. Please check back later.</p>
                )}
                <div>
                    <h5>Revision Requested Resources</h5>
                    <div className="resource-grid">
                        {counselorResources?.filter((r) => r.status === 'revision').length === 0 && <p>No resources to revise.</p>}
                        {counselorResources && counselorResources.filter((r) => r.status === 'revision').map((resource, index) =>
                        (
                            <form className="card resource-card" key={resource.id} onSubmit={(e) => updateResource(e, resource.id)}>
                                <h4>Resource {index}</h4>
                                <div className="field">
                                    <label htmlFor='description'>Description</label>
                                    <input name="description" type="text" defaultValue={resource.description || ""}></input>
                                </div>
                                {resource.files.length === 0 && <p style={{fontSize: 12}}>No files attached</p>}
                                <div className="field">
                                    {resource.files.map((file, index) => (
                                        <div>
                                            {!file.delete && ( 
                                                <div className="file-div">
                                                    <FileRowItem key={index} name={displayFileName(file.fileName)} url={file.url} />
                                                    <button className="close-button" type="button" onClick={() => deleteFile(resource.id, file.id)}>x</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    
                                </div>
                                <div className="field">
                                    <label htmlFor="files">Select file/s</label>
                                    <input
                                        id="files"
                                        name="files"
                                        type="file"
                                        accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        multiple
                                    >
                                    </input>
                                </div>
                                <span className="resource-card__date">{new Date(resource.date).toLocaleString()}</span>
                                <p className="resource-card__note">
                                    Note: {resource.note}
                                </p>
                                {resource.error && (<p className="alert-error">{resource.error}</p>)}
                                <button className="btn btn--primary" type="submit">Resubmit Resource</button>
                            </form>
                        )
                        )}
                    </div>
                    <h5>My Resources</h5>
                    <div className="resource-grid">
                        {counselorResources?.length === 0 && <p>No resources submitted.</p>}
                        {counselorResources && counselorResources.filter((r) => r.status !== 'revision').map((resource, index) =>
                        (
                            <div className="card resource-card" key={resource.id}>
                                <h4>Resource {index} <span className="resource-card__status" style={{ backgroundColor: getStatusColor(resource.status) }}>{resource.status.charAt(0).toUpperCase() + resource.status.slice(1)}</span></h4>
                                <p>{resource.description}</p>
                                <div>{resource.files.map((file, index) => (
                                    <FileRowItem key={index} name={file.fileName} url={file.url} />
                                )
                                )}
                                </div>
                                <span className="resource-card__date">{new Date(resource.date).toLocaleString()}</span>
                                <p className="resource-card__note">
                                    Note: {resource.note? resource.note : "No Note"}
                                </p>
                            </div>
                        )
                        )}
                    </div>
                </div>
            </div>
        )}

        </div>
    </>
    )
}

export default Dashboard
