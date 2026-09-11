import { useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom';

// placeholder
function Login() {
    const emailVal = useRef<HTMLInputElement>(null);
    const passwordVal = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    const [resend, setResend] = useState(false);
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [searchParams] = useSearchParams()
    const verified = searchParams.get('verified')

    const navigate = useNavigate();

    async function resendVerification() {
        const email = emailVal.current?.value;
        setError('');
        setSuccess('');
        if (!email){
            setError('Please enter an email.');
            return;
        }
        const res = await fetch(`http://localhost:5000/verify/resend?email=${email}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await res.json()
        if (data.success){
            setResend(false);
            setSuccess('Verification email resent!');
        }
        else {
            if (!res.ok || data.error) {
                if (data.error) {
                    setError(data.error);
                }
                else setError('Could not sign up.');
                return;
            }
        }
        
    }


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
                if (data.error) {
                    if (data.error === 'This account has not been verified.') setResend(true);
                    else setResend(false);
                    setError(data.error);
                }
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
                {verified === 'true' && <p className="alert-success">Email verified! You can now log in.</p>}
                {verified === 'false' && <p className="alert-success">Verification email has been sent! Please verify your email before logging in.</p>}
                {success && <p className='alert-success'>{success}</p>}
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
                    {error && <p className="alert-error">{error}<br/>{resend && <span className='link-right' onClick={resendVerification}>Resend Email</span>}</p>}
                    <div className='file-div'>
                        <button className="btn btn--primary" type='submit'>Login</button>
                        <span className='link-right' onClick={() => navigate('/Signup')}>Sign Up</span>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Login