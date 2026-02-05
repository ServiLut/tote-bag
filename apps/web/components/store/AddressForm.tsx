'use client';

import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/Combobox';

interface Department {
  id: string;
  name: string;
}

interface Municipality {
  id: string;
  name: string;
}

interface AddressFormProps {
  onClose: () => void;
  onSuccess: () => void;
  apiUrl: string;
  token: string;
}

export default function AddressForm({ onClose, onSuccess, apiUrl, token }: AddressFormProps) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    firstName: '',
    lastName: '',
    phone: '',
    departmentId: '',
    municipalityId: '',
    address: '',
    neighborhood: '',
    additionalInfo: '',
    isDefault: false,
  });

  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }));
  const municipalityOptions = municipalities.map(m => ({ value: m.id, label: m.name }));

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch(`${apiUrl}/locations/departments`);
        if (res.ok) {
          const response = await res.json();
          setDepartments(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setLoadingLocations(false);
      }
    };

    fetchDepartments();
  }, [apiUrl]);

  useEffect(() => {
    const fetchMunicipalities = async () => {
      if (!formData.departmentId) {
        setMunicipalities([]);
        return;
      }

      try {
        const res = await fetch(`${apiUrl}/locations/municipalities/${formData.departmentId}`);
        if (res.ok) {
          const response = await res.json();
          setMunicipalities(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching municipalities:', error);
      }
    };

    fetchMunicipalities();
  }, [formData.departmentId, apiUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.departmentId || !formData.municipalityId) {
      toast.error('Por favor selecciona departamento y municipio');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success('Dirección agregada correctamente');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Error al agregar la dirección');
      }
    } catch (error) {
      toast.error('Error de red al agregar la dirección');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface w-full max-w-lg rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-theme">
          <h2 className="text-xl font-bold text-primary">Agregar Nueva Dirección</h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Nombre de la dirección (ej: Mi Casa)</label>
              <input
                required
                type="text"
                placeholder="Mi Casa, Oficina..."
                className="w-full px-4 py-2 bg-base border border-theme rounded-lg focus:ring-2 focus:ring-accent outline-none transition-all"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Nombre</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-base border border-theme rounded-lg focus:ring-2 focus:ring-accent outline-none"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Apellido</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-base border border-theme rounded-lg focus:ring-2 focus:ring-accent outline-none"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Teléfono</label>
              <input
                required
                type="tel"
                className="w-full px-4 py-2 bg-base border border-theme rounded-lg focus:ring-2 focus:ring-accent outline-none"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Departamento</label>
                <Combobox
                  options={departmentOptions}
                  value={formData.departmentId}
                  onChange={(val) => setFormData({ ...formData, departmentId: val, municipalityId: '' })}
                  disabled={loadingLocations}
                  placeholder="Seleccionar..."
                  searchPlaceholder="Buscar departamento..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Municipio</label>
                <Combobox
                  options={municipalityOptions}
                  value={formData.municipalityId}
                  onChange={(val) => setFormData({ ...formData, municipalityId: val })}
                  disabled={!formData.departmentId}
                  placeholder={formData.departmentId ? "Seleccionar..." : "Primero elige depto"}
                  searchPlaceholder="Buscar municipio..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Dirección</label>
              <input
                required
                type="text"
                placeholder="Calle 123 #45-67..."
                className="w-full px-4 py-2 bg-base border border-theme rounded-lg focus:ring-2 focus:ring-accent outline-none"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Barrio</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-base border border-theme rounded-lg focus:ring-2 focus:ring-accent outline-none"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Apto, Suite, etc.</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-base border border-theme rounded-lg focus:ring-2 focus:ring-accent outline-none"
                  value={formData.additionalInfo}
                  onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                className="w-4 h-4 rounded border-theme text-accent focus:ring-accent"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              />
              <label htmlFor="isDefault" className="text-sm font-medium text-primary">
                Establecer como dirección predeterminada
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-theme rounded-lg font-bold text-primary hover:bg-base transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-surface rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar Dirección
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
