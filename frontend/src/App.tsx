// import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import './App.css'

function App() {
  //const [count, setCount] = useState(0)

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path='/Login' element={<Login />} />
        <Route path="/Dashboard" element={<Dashboard/>} />
      </Routes>
    </>
  )
}

export default App
