import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom';

// placeholder
function Login() {
    const emailVal = useRef<HTMLInputElement>(null);
    const passwordVal = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    async function login(e: React.SubmitEvent){
        e.preventDefault();
        try {
            const email = emailVal.current?.value;
            const password = passwordVal.current?.value;
            const res = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                if (data.error) setError(data.error);
                else setError('The password or email are incorrect.');
                return;
            }
            navigate('/Dashboard');
        } catch (err) {
            console.log(err);
            setError('The password or email are incorrect.');
        }
    }


    return (
    <>
        <form onSubmit={login}>
            <input
                type='email'
                ref={emailVal}
                placeholder="example@email.com"
                required
            >
            </input>
            <input
                type='password'
                ref={passwordVal}
                placeholder='••••••••'
                required
            >
            </input>
            {error && <p>{error}</p>}
            <button type='submit'>Login</button>
        </form>
    </>
    )
}

export default Login