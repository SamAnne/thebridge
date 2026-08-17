// import { useState } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard, { loader as dashboardLoader } from './pages/Dashboard'
import Login from './pages/Login'
import './App.css'

const router = createBrowserRouter(
  createRoutesFromElements(
      <>
        <Route path="/" element={<Home />} />
        <Route path='/Login' element={<Login />} />
        <Route path="/Dashboard" element={<Dashboard/>} loader={dashboardLoader}/>
      </>
  )
);


function App() {
  return <RouterProvider router={router} />;
}

export default App
