import { useEffect, useState } from "react"
// placeholder
function Dashboard() {

    interface User {
        id: number;
        email: string;
        role: string;
    }
    const [user, setUser] = useState<User| null>(null);

    useEffect(() => {
        async function fetchUser() {
            const response = await fetch('http://localhost:5000/api/me', {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.error) return;
            setUser(data);
        }
        fetchUser();
    }, []);
    return (
    <>
        {user && (
            <h3>Hello, {user.email} ({user.role})</h3>
        )}
        
    </>
    )
}

export default Dashboard