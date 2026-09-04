import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
    const navigate = useNavigate();

    return (
        <div className="page page--narrow page--centered page--vcentered">
            <p className="page__eyebrow">The Bridge</p>
            <h1 className="page__title">Find the right resources.</h1>
            <p className="page__subtitle">
                Discover resources available to students and communities across Utah.
            </p>
            <div className="home__actions">
                <button className="btn btn--primary" onClick={() => navigate('/Resources')}>Browse Resources</button>
                <button className="btn btn--outline" onClick={() => navigate('/Login')}>Sign In</button>
            </div>
        </div>
    )
}

export default Home
