'use client';

import { useState, useEffect } from 'react';
import { Loader2, Briefcase, MapPin, CheckCircle, Image as ImageIcon, QrCode } from 'lucide-react';

interface B2BQuote {
  id: string;
  businessName: string;
  quantity: number;
  city: string;
  package: 'Starter' | 'Pro' | 'Evento';
  qrType: 'WHATSAPP' | 'WEB' | 'INSTAGRAM';
  status: string;
  logoUrl?: string;
  createdAt: string;
}

export default function B2BQuotesManager() {
  const [quotes, setQuotes] = useState<B2BQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const res = await fetch(`${API_URL}/b2b/quotes`);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const data = await res.json();
      setQuotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`${API_URL}/b2b/quotes/${id}/approve`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to approve');
      
      setQuotes(prev => prev.map(q => 
        q.id === id ? { ...q, status: 'DISEÑO_APROBADO' } : q
      ));
    } catch (err) {
      alert('Error aprobando diseño');
    } finally {
      setProcessingId(null);
    }
  };

  const getPackageColor = (pkg: string) => {
    switch(pkg) {
      case 'Starter': return 'bg-blue-100 text-blue-800';
      case 'Pro': return 'bg-purple-100 text-purple-800';
      case 'Evento': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {quotes.length === 0 ? (
        <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
          No hay solicitudes B2B pendientes.
        </div>
      ) : (
        quotes.map((quote) => (
          <div key={quote.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{quote.businessName}</h3>
                  <div className="flex items-center text-gray-500 text-sm mt-1">
                    <MapPin className="w-3 h-3 mr-1" />
                    {quote.city}
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getPackageColor(quote.package)}`}>
                  {quote.package}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cantidad:</span>
                  <span className="font-semibold text-gray-900">{quote.quantity} uds</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500">Tipo QR:</span>
                  <span className="inline-flex items-center text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
                    <QrCode className="w-3 h-3 mr-1" />
                    {quote.qrType}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded border flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-gray-500">
                    <p className="font-medium text-gray-700 mb-0.5">Logo Adjunto</p>
                    <p className="line-clamp-1 break-all">
                      {quote.logoUrl ? 'Disponible para descarga' : 'No adjunto'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
              {quote.status === 'DISEÑO_APROBADO' ? (
                <div className="w-full py-2 flex items-center justify-center text-green-600 font-medium text-sm gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Diseño Aprobado
                </div>
              ) : (
                <button
                  onClick={() => handleApprove(quote.id)}
                  disabled={!!processingId}
                  className="w-full py-2 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processingId === quote.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                  Aprobar Diseño
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
