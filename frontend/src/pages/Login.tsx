import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom';

// placeholder
function Login() {
    const emailVal = useRef<HTMLInputElement>(null);
    const passwordVal = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

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
        <div className="page page--narrow">
            <p className="page__eyebrow">The Bridge</p>
            <h1 className="page__title">Login</h1>
            <p className="page__subtitle">Sign in to your account</p>
            <div className="card">
                <form onSubmit={login}>
                    <div className="field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type='email'
                            ref={emailVal}
                            placeholder="example@email.com"
                            required
                        >
                        </input>
                    </div>
                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <div className="password-input">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                ref={passwordVal}
                                placeholder='••••••••'
                                required
                            >
                            </input>
                            <button
                                type="button"
                                className="password-input__toggle"
                                onClick={() => setShowPassword(v => !v)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>
                    {error && <p className="alert-error">{error}</p>}
                    <button className="btn btn--primary" type='submit'>Login</button>
                </form>
            </div>
        </div>
    )
}

export default Login