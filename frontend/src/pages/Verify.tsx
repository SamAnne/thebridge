import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom';

function Verify() {
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams()

    useEffect(() => {
        const verify = async () => {
            const token = searchParams.get('token')
            
            if (!token) return

            // send token to your backend
            const res = await fetch(`http://localhost:5000/verify?token=${token}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const data = await res.json()
            if (data.success){
                navigate('/Login?verified=true')
            }
            else {
                if (!res.ok || data.error) {
                    if (data.error) setError(data.error);
                    else setError('Could not sign up.');
                    return;
                }
            }
    
        }
        verify();
    }, [])

    return (
        <div className="page page--narrow page--centered page--vcentered">
            <p className="page__eyebrow">The Bridge</p>
            <h1 className="page__title">Verifying your email...</h1>
            {error && <p className="alert-error">{error}</p>}
        </div>
    )
}

export default Verify
