import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function SignUp() {
    const emailVal = useRef<HTMLInputElement>(null);
    const passwordVal = useRef<HTMLInputElement>(null);
    const usernameVal = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    // role based on email for counselors
    // get all district/county domains for emails
    async function signUp(e: React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
        try {
            const email = emailVal.current?.value;
            const password = passwordVal.current?.value;
            const name = usernameVal.current?.value;
            const res = await fetch('http://localhost:5000/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, name }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                if (data.error) setError(data.error);
                else setError('Could not sign up.');
                return;
            }
            navigate('/Login?verified=false');
        } catch (err) {
            console.log(err);
            setError('Could not sign up.');
        }
    }

    return (
        <>
            <div className="page page--narrow">
                <p className="page__eyebrow">The Bridge</p>
                <h1 className="page__title">Sign Up</h1>
                <p className="page__subtitle">Sign up and create an account</p>
                <div className="card">
                    <form onSubmit={signUp}>
                        <div className="field">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                type='text'
                                ref={usernameVal}
                                placeholder="John Doe"
                                required
                            >
                            </input>
                        </div>
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
                        <div className='file-div'>
                            <button className="btn btn--primary" type='submit'>Sign Up</button>
                            <span className='link-right' onClick={() => navigate('/Login')}>Log In</span>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}

export default SignUp;