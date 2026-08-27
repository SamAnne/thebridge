// import { useState } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard, { loader as dashboardLoader } from './pages/Dashboard'
import Login from './pages/Login'
import AdminUsers, { loader as adminUsersLoader } from './pages/AdminUsers'
import AdminResources from './pages/AdminResources'
import { loader as adminResourcesLoader } from './pages/AdminResources.loader'
import './App.css'

const router = createBrowserRouter(
  createRoutesFromElements(
      <>
        <Route path="/" element={<Home />} />
        <Route path='/Login' element={<Login />} />
        <Route path="/Dashboard" element={<Dashboard/>} loader={dashboardLoader}/>
        <Route path="/Admin/Users" element={<AdminUsers/>} loader={adminUsersLoader}/>
        <Route path="/Admin/Resources" element={<AdminResources/>} loader={adminResourcesLoader}/>
      </>
  )
);


function App() {
  return <RouterProvider router={router} />;
}

export default App
