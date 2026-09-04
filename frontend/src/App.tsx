// import { useState } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Outlet } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard, { loader as dashboardLoader } from './pages/Dashboard'
import Login from './pages/Login'
import AdminUsers, { loader as adminUsersLoader } from './pages/AdminUsers'
import AdminResources from './pages/AdminResources'
import { loader as adminResourcesLoader } from './pages/AdminResources.loader'
import PublicResources from './pages/PublicResources'
import { loader as publicResourcesLoader } from './pages/PublicResources.loader'
import AdminSettings from './pages/AdminSettings'
import { loader as adminSettingsLoader } from './pages/AdminSettings.loader'
import NavigationProgress from './components/NavigationProgress'
import './App.css'

function RootLayout() {
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
      <Route element={<RootLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/Resources" element={<PublicResources/>} loader={publicResourcesLoader}/>
        <Route path='/Login' element={<Login />} />
        <Route path="/Dashboard" element={<Dashboard/>} loader={dashboardLoader}/>
        <Route path="/Admin/Users" element={<AdminUsers/>} loader={adminUsersLoader}/>
        <Route path="/Admin/Resources" element={<AdminResources/>} loader={adminResourcesLoader}/>
        <Route path="/Admin/Settings" element={<AdminSettings/>} loader={adminSettingsLoader}/>
      </Route>
  )
);


function App() {
  return <RouterProvider router={router} />;
}

export default App
