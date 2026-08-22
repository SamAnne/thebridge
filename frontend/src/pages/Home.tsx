import { useNavigate } from 'react-router-dom';

function Home() {
    const navigate = useNavigate();

    return (
        <div className="page page--narrow page--centered">
            <p className="page__eyebrow">The Bridge</p>
            <h1 className="page__title">Home</h1>
            <p className="page__subtitle">Sign in to submit or review resources.</p>
            <button className="btn btn--primary" onClick={() => navigate('/Login')}>Login</button>
        </div>
    )
}

export default Home
