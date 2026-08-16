import { useNavigate } from 'react-router-dom';
//placeholder
function Home() {
    const navigate = useNavigate();

    return (
    <>
        <h3>Home</h3>
        <button onClick={()=> navigate('/Login')}>Login</button>
    
    
    </>
    )
}

export default Home