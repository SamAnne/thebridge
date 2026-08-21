import { useState, useRef, useEffect } from "react"
import { useLoaderData } from 'react-router-dom';

export async function loader(){
    let user;
    let resources;
    try {
        const response = await fetch('http://localhost:5000/api/me', {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.error) return; // handle better
        user = data;
        if (user && user.role === 'admin'){
            const response = await fetch('http://localhost:5000/api/resources/unseen', {
                credentials: 'include'
            });
            resources = await response.json();
            return [user,resources];
        }
        return [user, null];
    }
    catch(err){
        // ??
        // redirect ?
    }
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
      <a onClick={() => setIsOpen(!isOpen)} style={{ color: 'blue', cursor: 'pointer' }}>
        {isOpen ? 'Hide' : '▶ Preview'} {name}
      </a>
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
        {/* when signing up, check email for the domain and add appropriate role depending on if the domain is one of the districts, otherwise public role selected (student/parent) */}
        {user && (
            <h3>Hello, {user.email} ({user.role})</h3>
        )}
        {user && user.role === 'admin' && (
            // add files
            // add links
            // order resources by oldest to newest (add options for otherwise?)
            //adding resources
            //review q
            <div>
                <h4>Review Queue</h4>
                <ul>
                    {unseenResources?.length === 0 && <p>No resources in review queue currently.</p>}
                    {unseenResources && unseenResources.map((resource, index) => 
                    (
                        <li key={resource.id}>
                            <h4>Resource {index}</h4>
                            <p>{resource.description}</p>
                            <div>{resource.files.map((file, index) => (
                                <FileRowItem key={index} name={file.fileName} url={file.url} />
                            )                            
                            )}
                            </div>
                            <span>{new Date(resource.date).toLocaleString()}</span><br/>
                            <input type="text" ref={noteVal} placeholder="Notes ..."></input><br/>
                            <button onClick={() => postStatus('approved', resource.id)}>Approve</button>
                            <button onClick={() => postStatus('rejected', resource.id)}>Reject</button>
                            <button onClick={() => postStatus('revision', resource.id)}>Revision Needed</button>
                        </li>
                    )
                    )}
                </ul>
            </div>
            
        )}

        {user && user.role === 'counselor' && (
            //submitting resources
            <div>
                <h5>Submit a Resource</h5>
                <form onSubmit={postResource}>
                    <input
                        type='text'
                        ref={descriptionVal}
                        placeholder="Description goes here"
                        required
                    >
                    </input>
                    <div>
                        <label>
                            Select file/s:
                        </label><br/>
                        <input
                            type="file"
                            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            multiple
                            ref={fileVal}
                        >
                        </input>
                    </div>
                    {error.length > 0 && (<p>{error}</p>)}
                    <button type='submit'>Submit Resource</button>
                </form>
            </div>
            // add all of user resources? with notes and status
        )}
        
    </>
    )
}

export default Dashboard