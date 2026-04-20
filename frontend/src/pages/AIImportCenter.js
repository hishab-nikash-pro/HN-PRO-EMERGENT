import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Upload, Eye, Trash, CheckCircle, Clock, XCircle, Warning } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AIImportCenter() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!selectedCompany) return;
    loadUploads();
  }, [selectedCompany]);

  const loadUploads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/companies/${selectedCompany.company_id}/ai-uploads`, {
        credentials: 'include'
      });
      const data = await res.json();
      setUploads(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    
    // Check file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'];
    if (!validTypes.includes(file.type)) {
      alert('Unsupported file type. Please upload: Excel, CSV, PDF, PNG, JPG, or ZIP');
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);

      // Upload to backend
      const res = await fetch(`${API}/api/companies/${selectedCompany.company_id}/ai-uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_base64: base64
        })
      });

      if (!res.ok) throw new Error('Upload failed');

      const upload = await res.json();

      // Immediately process the upload
      await processUpload(upload.upload_id);

      // Reload uploads
      await loadUploads();

    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });
  };

  const processUpload = async (uploadId) => {
    try {
      await fetch(`${API}/api/companies/${selectedCompany.company_id}/ai-uploads/${uploadId}/process`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Processing error:', err);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const deleteUpload = async (uploadId) => {
    if (!confirm('Delete this upload?')) return;
    try {
      await fetch(`${API}/api/companies/${selectedCompany.company_id}/ai-uploads/${uploadId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      await loadUploads();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready': return <CheckCircle size={20} weight="fill" style={{ color: '#16a34a' }} />;
      case 'processing': return <Clock size={20} weight="fill" style={{ color: '#0E7490' }} />;
      case 'error': return <XCircle size={20} weight="fill" style={{ color: '#BA1A1A' }} />;
      case 'confirmed': return <CheckCircle size={20} weight="fill" style={{ color: '#0F2D5C' }} />;
      default: return <Clock size={20} style={{ color: '#434655' }} />;
    }
  };

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) return { text: 'High', color: '#16a34a' };
    if (confidence >= 0.5) return { text: 'Medium', color: '#eab308' };
    return { text: 'Low', color: '#f97316' };
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl" data-testid="ai-import-center-page">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>AI Import Center</h1>
          <p className="text-sm mt-0.5" style={{ color: '#434655' }}>Upload documents for intelligent data extraction</p>
        </div>

        {/* Upload Area */}
        <div
          className="rounded-2xl p-8 text-center transition-colors"
          style={{
            background: dragActive ? '#F0F9FF' : '#FFFFFF',
            boxShadow: dragActive ? '0 0 0 2px #0E7490' : '0 1px 3px rgba(0,0,0,0.04)',
            borderWidth: '2px',
            borderStyle: 'dashed',
            borderColor: dragActive ? '#0E7490' : '#C4C5D7'
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload size={48} style={{ color: '#0E7490', margin: '0 auto' }} />
          <p className="mt-4 text-base font-medium" style={{ color: '#191C1E' }}>
            {uploading ? 'Uploading and processing...' : 'Drop files here or click to upload'}
          </p>
          <p className="text-sm mt-1" style={{ color: '#434655' }}>
            Supports: Excel, CSV, PDF, PNG, JPG, ZIP
          </p>
          <input
            type="file"
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
            accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.zip"
            className="hidden"
            id="file-upload"
            disabled={uploading}
            data-testid="ai-import-file-input"
          />
          <label
            htmlFor="file-upload"
            className="inline-block mt-4 px-6 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
            data-testid="ai-import-choose-file-btn"
          >
            Choose File
          </label>
        </div>

        {/* Recent Uploads */}
        <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Recent Uploads</h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#434655' }}>
              <Warning size={48} style={{ color: '#CBD5E1', margin: '0 auto' }} />
              <p className="mt-2">No uploads yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {uploads.map((u) => {
                const confBadge = getConfidenceBadge(u.confidence);
                return (
                  <div key={u.upload_id} data-testid={`ai-upload-row-${u.upload_id}`} className="flex items-center gap-4 p-4 rounded-lg transition-colors hover:bg-[#F7F9FB]" style={{ border: '1px solid #F2F4F6' }}>
                    <div className="flex-shrink-0">{getStatusIcon(u.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: '#191C1E' }}>{u.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: '#434655' }}>
                          {u.detected_type ? u.detected_type.replace('_', ' ').toUpperCase() : 'Processing...'}
                        </span>
                        {u.confidence > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${confBadge.color}20`, color: confBadge.color }}>
                            {confBadge.text} confidence
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.status === 'ready' && (
                        <button
                          onClick={() => navigate(`/ai-import/review/${u.upload_id}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
                          data-testid={`review-btn-${u.upload_id}`}
                        >
                          <Eye size={14} weight="bold" className="inline mr-1" />
                          Review
                        </button>
                      )}
                      <button
                        onClick={() => deleteUpload(u.upload_id)}
                        className="p-1.5 rounded-lg hover:bg-[#FEF2F2] transition-colors"
                        style={{ color: '#BA1A1A' }}
                        data-testid={`delete-btn-${u.upload_id}`}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
