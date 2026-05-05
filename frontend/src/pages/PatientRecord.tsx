import { useParams } from 'react-router-dom';

export default function PatientRecord() {
  const { patientId } = useParams();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h1 className="text-lg">Patient record</h1>
          <p className="text-sm text-muted-foreground mt-1">Patient id: {patientId}</p>
        </div>

        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">Longitudinal record view is not yet wired.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Needs <code>GET /patients/:id</code> + facts endpoints on the backend.
          </p>
        </div>
      </div>
    </div>
  );
}
