'use client';

import { useState, useRef } from 'react';

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    
    if (selectedFile) {
      // Validate file type
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls)$/i)) {
        setMessage({ type: 'error', text: 'Please select a valid Excel file (.xlsx or .xls)' });
        return;
      }
      
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'File size must be less than 10MB' });
        return;
      }
    }
    
    setFile(selectedFile);
    setMessage(null);
    setResult([]);
  };

  const upload = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select an Excel file first' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('http://127.0.0.1:8080/upload-excel/', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text}`);
      }

      const json = await res.json();
      
      if (json.status !== 'success') {
        setMessage({ type: 'error', text: json.message || 'An error occurred while processing the file' });
      } else {
        const scheduleData = json.data || [];
        setResult(scheduleData);
        setMessage({ 
          type: 'success', 
          text: `Successfully scheduled ${json.count} appointment${json.count !== 1 ? 's' : ''}` 
        });
        
        // Store data in sessionStorage for the building view
        if (scheduleData.length > 0) {
          sessionStorage.setItem('scheduleData', JSON.stringify(scheduleData));
        }
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setMessage({ 
        type: 'error', 
        text: err.message || 'Failed to upload file. Please check your connection and try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult([]);
    setMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Appointment Scheduler</h1>
              <p className="text-gray-400">Upload an Excel file to schedule multiple appointments at once</p>
            </div>
            {result.length > 0 ? (
              <a
                href="/building-view"
                className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                View Buildings
              </a>
            ) : (
              <div className="relative group">
                <button
                  disabled
                  className="px-6 py-3 bg-slate-600 text-gray-400 font-medium rounded-lg cursor-not-allowed flex items-center gap-2 opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  View Buildings
                </button>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
                  <div className="bg-slate-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap">
                    Please upload and schedule data first
                    <div className="absolute top-full right-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Excel File
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="block w-full text-sm text-gray-300 border border-slate-600 rounded-lg cursor-pointer bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              {file && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-700 rounded-lg hover:bg-slate-600 border border-slate-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {file && (
              <p className="mt-2 text-sm text-gray-400">
                Selected: <span className="font-medium text-gray-300">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={upload}
            disabled={loading || !file}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-800 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scheduling...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload & Schedule
              </>
            )}
          </button>

          {/* Message Display */}
          {message && (
            <div className={`mt-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-900/30 border border-green-700' :
              message.type === 'error' ? 'bg-red-900/30 border border-red-700' :
              'bg-blue-900/30 border border-blue-700'
            }`}>
              <div className="flex items-start gap-3">
                {message.type === 'success' && (
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {message.type === 'error' && (
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <p className={`text-sm ${
                  message.type === 'success' ? 'text-green-300' :
                  message.type === 'error' ? 'text-red-300' :
                  'text-blue-300'
                }`}>
                  {message.text}
                </p>
              </div>
            </div>
          )}

          {/* Results Table */}
          {result.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-white mb-4">Scheduled Appointments</h2>
              <div className="overflow-x-auto rounded-lg border border-slate-600">
                <table className="min-w-full divide-y divide-slate-600">
                  <thead className="bg-slate-700">
                    <tr>
                      {Object.keys(result[0]).map((k) => (
                        <th
                          key={k}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                        >
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-slate-800 divide-y divide-slate-700">
                    {result.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-700 transition-colors">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}