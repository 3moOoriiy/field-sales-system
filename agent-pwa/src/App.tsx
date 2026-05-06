import { Route, Routes, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Customers } from './pages/Customers';
import { CustomerCreate } from './pages/CustomerCreate';
import { Products } from './pages/Products';
import { Invoices } from './pages/Invoices';
import { InvoiceCreate } from './pages/InvoiceCreate';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Visits } from './pages/Visits';
import { VisitCheckIn } from './pages/VisitCheckIn';
import { VisitCheckOut } from './pages/VisitCheckOut';
import { PaymentCreate } from './pages/PaymentCreate';
import { Profile } from './pages/Profile';

export default function App() {
  const init = useAuth((s) => s.init);
  const loading = useAuth((s) => s.loading);
  const user = useAuth((s) => s.user);

  useEffect(() => { void init(); }, [init]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-500 text-sm">جاري التحميل…</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/new" element={<CustomerCreate />} />
        <Route path="/products" element={<Products />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<InvoiceCreate />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/visits" element={<Visits />} />
        <Route path="/visits/check-in" element={<VisitCheckIn />} />
        <Route path="/visits/check-out" element={<VisitCheckOut />} />
        <Route path="/payments/new" element={<PaymentCreate />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
