import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { navItems } from "./config/nav";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {navItems.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
      </Route>
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
