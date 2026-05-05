import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientList from "./pages/PatientList";
import PatientRecord from "./pages/PatientRecord";
import NewConsult from "./pages/NewConsult";
import PatientHome from "./pages/PatientHome";
import PatientShares from "./pages/PatientShares";
import SharedRecord from "./pages/SharedRecord";
import DoctorLayout from "./components/layout/DoctorLayout";
import PatientLayout from "./components/layout/PatientLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/shared/:token" element={<SharedRecord />} />

          <Route element={<DoctorLayout />}>
            <Route path="/doctor" element={<DoctorDashboard />} />
            <Route path="/doctor/patients" element={<PatientList />} />
            <Route path="/doctor/patients/:patientId" element={<PatientRecord />} />
            <Route path="/doctor/consult/new" element={<NewConsult />} />
            <Route path="/doctor/consult/:consultId" element={<NewConsult />} />
          </Route>

          <Route element={<PatientLayout />}>
            <Route path="/patient" element={<PatientHome />} />
            <Route path="/patient/shares" element={<PatientShares />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
