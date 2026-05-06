import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { RequireAuth } from './components/RequireAuth';
import { AppShell } from './components/AppShell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { Permissions } from './pages/Permissions';
import { LiveMap } from './pages/LiveMap';
import { Customers } from './pages/Customers';
import { Products } from './pages/Products';
import { Invoices } from './pages/Invoices';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Returns } from './pages/Returns';
import { Payments } from './pages/Payments';
import { Visits } from './pages/Visits';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { AuditLogs } from './pages/AuditLogs';

export default function App() {
  const init = useAuth((s) => s.init);
  const user = useAuth((s) => s.user);

  useEffect(() => { void init(); }, [init]);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/map"          element={<LiveMap />} />
          <Route path="/agents"       element={<Agents />} />
          <Route path="/permissions"  element={<Permissions />} />
          <Route path="/customers"    element={<Customers />} />
          <Route path="/products"     element={<Products />} />
          <Route path="/invoices"     element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/returns"      element={<Returns />} />
          <Route path="/payments"     element={<Payments />} />
          <Route path="/visits"       element={<Visits />} />
          <Route path="/reports"      element={<Reports />} />
          <Route path="/settings"     element={<Settings />} />
          <Route path="/audit"        element={<AuditLogs />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
