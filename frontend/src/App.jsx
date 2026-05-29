import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login.jsx";
import ClassDetail from "./pages/ClassDetail.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import FaceRegistration from "./pages/FaceRegistration.jsx";
import Profile from "./pages/Profile";

import Forbidden403 from "./pages/errors/Forbidden403.jsx";
import NotFound404 from "./pages/errors/NotFound404.jsx";
import Unauthorized401 from "./pages/errors/Unauthorized401.jsx";
import ServerError500 from "./pages/errors/ServerError500.jsx";

import {
  RequireAuth,
  RequireRole,
  RedirectIfAuthed,
} from "./components/RouteGuards.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireRole allow={["TEACHER", "STUDENT"]}>
              <Dashboard />
            </RequireRole>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireRole allow={["TEACHER", "STUDENT"]}>
              <Profile />
            </RequireRole>
          }
        />
        <Route
          path="/class/:classId"
          element={
            <RequireRole allow={["TEACHER", "STUDENT"]}>
              <ClassDetail />
            </RequireRole>
          }
        />
        <Route
          path="/register-face"
          element={
            <RequireRole allow={["STUDENT"]}>
              <FaceRegistration />
            </RequireRole>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireRole allow={["ADMIN"]}>
              <AdminDashboard />
            </RequireRole>
          }
        />

        <Route path="/401" element={<Unauthorized401 />} />
        <Route path="/403" element={<Forbidden403 />} />
        <Route path="/500" element={<ServerError500 />} />
        <Route path="/404" element={<NotFound404 />} />

        <Route
          path="*"
          element={
            <RequireAuth>
              <NotFound404 />
            </RequireAuth>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
