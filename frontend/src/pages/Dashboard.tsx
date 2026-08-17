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
        if (data.error) return;
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
    }
};



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
        resource: string;
        status: string;
        note: string;
        date: string;
    }

    const items = useLoaderData() as any[]
    const [user, setUser] = useState<User | null>(items[0]);
    const [unseenResources, setUnseenResources] = useState<Resource[] | null>(items[1]);
    const resourceVal = useRef<HTMLInputElement>(null);
    const noteVal = useRef<HTMLInputElement>(null);
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
        try {
            const userId = user?.id;
            const resource = resourceVal.current?.value
            await fetch('http://localhost:5000/api/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ resource, userId}),
            });
        } 
        catch(err){
            setError('Could not add resource.')
        }
    }

    useEffect(() => {
        setUser(items[0]);
        setUnseenResources(items[1]);
    }, [items]);
    
    
    return (
    <>
        {user && (
            <h3>Hello, {user.email} ({user.role})</h3>
        )}
        {user && user.role === 'admin' && (
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
                            <p>{resource.resource}</p>
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
                        ref={resourceVal}
                        placeholder="Resources go here"
                        required
                    >
                    </input>
                    <button type='submit'>Submit Resource</button>
                </form>
                {/* past submission? to see notes from admin */}
            </div>
            
        )}
        {error && <p>{error}</p>}
        
    </>
    )
}

export default Dashboard