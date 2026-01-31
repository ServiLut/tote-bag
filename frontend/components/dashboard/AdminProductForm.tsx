'use client';

import { createClient } from '@/utils/supabase/client';
import { useState, ChangeEvent, FormEvent, useRef } from 'react';
import { Plus, Trash2, AlertCircle, UploadCloud, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';
import { ApiResponse } from '@/types/api';
import { toast } from 'sonner';

// Utility for cleaner tailwind classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Types based on the backend DTOs implicitly
export type ProductStatus = 'DISPONIBLE' | 'BAJO_PEDIDO' | 'PREVENTA';

export interface VariantData {
  sku: string;
  color: string;
  imageUrl: string;
  stock: number;
}

interface ProductImage {
  id?: string;
  url: string;
  position?: number;
}

interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  collection: string;
  tags: string;
  basePrice: number;
  minPrice: number;
  comparePrice: number;
  costPrice: number;
  deliveryTime: string;
  status: ProductStatus;
  images: ProductImage[];
  variants: VariantData[];
}

interface AdminProductFormProps {
  initialData?: Omit<Partial<ProductFormData>, 'tags' | 'costPrice' | 'comparePrice' | 'images' | 'collection'> & { 
    id?: string; 
    tags?: string | string[];
    costPrice?: number | null;
    comparePrice?: number | null;
    images?: ProductImage[] | string[];
    collection?: string | { name: string };
  };
}

const INITIAL_STATE: ProductFormData = {
  name: '',
  slug: '',
  description: '',
  collection: '',
  tags: '',
  basePrice: 0,
  minPrice: 0,
  comparePrice: 0,
  costPrice: 0,
  deliveryTime: '',
  status: 'BAJO_PEDIDO',
  images: [],
  variants: [
    { sku: '', color: '', imageUrl: '', stock: 0 }
  ],
};

interface Collection {
  name: string;
}

export const AdminProductForm = ({ initialData }: AdminProductFormProps) => {
  const isEditMode = !!initialData;
  const [formData, setFormData] = useState<ProductFormData>(
    initialData 
      ? {
          ...INITIAL_STATE,
          ...initialData,
          collection: typeof initialData.collection === 'object' && initialData.collection !== null 
            ? (initialData.collection as unknown as Collection).name 
            : (initialData.collection as string) || '',
          images: initialData.images 
            ? initialData.images.map((img: string | ProductImage) => typeof img === 'string' ? { url: img } : img)
            : [],
          tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : initialData.tags || '',
          costPrice: initialData.costPrice ?? 0,
          comparePrice: initialData.comparePrice ?? 0,
        } 
      : INITIAL_STATE
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  // Derived state for validation
  const isPriceWarning = formData.basePrice > 0 && formData.basePrice < formData.minPrice;
  const margin = formData.basePrice > 0 && formData.costPrice > 0
    ? ((formData.basePrice - formData.costPrice) / formData.basePrice) * 100
    : 0;

    const generateSku = (name: string, collection: string, color: string) => {
      const clean = (str: string) => str.toUpperCase().replace(/\s+/g, '').replace(/[^\w-]/g, '');
      if (!name && !collection && !color) return '';
      return `TB-${clean(collection || 'COL')}-${clean(name || 'PROD')}-${clean(color || 'CLR')}`;
    };
  
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      
      setFormData((prev) => {
        const newData = { ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value };
        
        // Auto-generate slug from name if slug is untouched AND not in edit mode (to preserve SEO URLs)
        if (name === 'name' && !prev.slug && !isEditMode) {
          newData.slug = value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        }
  
        // Update SKUs of variants if they are empty
        if (name === 'name' || name === 'collection') {
          newData.variants = prev.variants.map(v => ({
            ...v,
            sku: v.sku && !v.sku.startsWith('TB-') ? v.sku : generateSku(newData.name, newData.collection, v.color)
          }));
        }
        
        return newData;
      });
    };
  
    const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        return data.publicUrl;
      });

      const newUrls = await Promise.all(uploadPromises);

      // 3. Agregar al estado
      setFormData(prev => ({ ...prev, images: [...prev.images, ...newUrls.map(url => ({ url }))] }));
      toast.success('Imágenes subidas correctamente');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Upload error:', error);
      toast.error('Error al subir imagen: ' + errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    }
  };

  const handleVariantFileUpload = async (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `variants/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      updateVariant(index, 'imageUrl', data.publicUrl);
      toast.success('Imagen de variante subida');
    } catch (error) {
      console.error('Variant upload error:', error);
      toast.error('Error al subir imagen de variante');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const addImageFromUrl = () => {
    if (imageUrlInput) {
      setFormData(prev => ({ ...prev, images: [...prev.images, { url: imageUrlInput }] }));
      setImageUrlInput('');
      toast.success('Imagen agregada desde URL');
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length === 1) {
      toast.warning('El producto debe tener al menos una variante.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  // Variant Logic
  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        { 
          sku: generateSku(prev.name, prev.collection, ''), 
          color: '', 
          imageUrl: '', 
          stock: 0 
        },
      ],
    }));
  };

  const updateVariant = (index: number, field: keyof VariantData, value: string | number) => {
    setFormData((prev) => {
      const newVariants = [...prev.variants];
      const v = { ...newVariants[index], [field]: value } as VariantData;
      
      // Auto-generate SKU when color changes if SKU is empty or auto-pattern
      if (field === 'color') {
        v.sku = generateSku(prev.name, prev.collection, v.color);
      }
      
      newVariants[index] = v;
      return { ...prev, variants: newVariants };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isPriceWarning) {
      toast.error('Por favor corrige las advertencias de precio.');
      return;
    }

    // Validate variants have images
    if (formData.variants.some(v => !v.imageUrl)) {
      toast.error('Todas las variantes deben tener una imagen asignada.');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      // 1. Clean Variants: Remove IDs and other metadata
      const cleanVariants = formData.variants.map(v => ({
        sku: v.sku,
        color: v.color,
        imageUrl: v.imageUrl,
        stock: v.stock,
      }));

      // 2. Construct Clean Payload (Explicit Destructuring)
      // This ensures we don't send 'id', 'createdAt', etc. which triggers 400 Bad Request
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        collectionName: formData.collection,
        basePrice: formData.basePrice,
        minPrice: formData.minPrice,
        comparePrice: formData.comparePrice,
        costPrice: formData.costPrice,
        deliveryTime: formData.deliveryTime,
        status: formData.status,
        images: formData.images.map((img, index) => ({ url: img.url, position: index })),
        variants: cleanVariants,
        tags: typeof formData.tags === 'string' 
          ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
          : formData.tags,
      };

      const url = isEditMode  
        ? `${apiUrl}/products/${initialData.id}` 
        : `${apiUrl}/products`;
      
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Format validation errors if available
        let errorMsg = errorData.message;
        if (Array.isArray(errorMsg)) {
           errorMsg = errorMsg.join(', ');
        }
        throw new Error(errorMsg || 'Error al guardar el producto');
      }

      const responseBody: ApiResponse<{ name: string }> = await response.json();
      const result = responseBody.data;
      toast.success(`Producto "${result.name}" ${isEditMode ? 'actualizado' : 'creado'} exitosamente.`);
      
      if (!isEditMode) {
        setFormData(INITIAL_STATE); // Reset form only on create
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Hubo un problema al guardar el producto.';
      console.error('Error saving product:', error);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full max-w-4xl mx-auto p-8 bg-[#F5F5F0] text-[#171717] rounded-lg shadow-sm font-sans overflow-y-auto overscroll-contain">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-2">
          {isEditMode ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>
        <p className="text-gray-600 text-sm">
          {isEditMode 
            ? 'Modifica la información existente del producto.' 
            : 'Ingresa la información básica y define las variantes para el catálogo.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Sección Imágenes */}
        <section className="space-y-4">
          <label className="block text-sm font-medium">Imágenes del Producto</label>
          <div className="flex flex-wrap gap-4">
            {/* Upload Button */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-24 h-24 flex-shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 bg-white cursor-pointer hover:border-black hover:text-black transition-colors",
                isUploading && "opacity-50 cursor-wait"
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <UploadCloud className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-medium">Subir</span>
                </>
              )}
            </div>

            {/* Images List */}
            {formData.images.filter(img => img.url && img.url.trim() !== '').map((img, idx) => (
              <div key={idx} className="relative w-24 h-24 flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden group shadow-sm">
                <Image src={img.url} alt={`Preview ${idx}`} fill className="object-cover" unoptimized />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-white/90 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Fallback URL Input */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-black">O agregar por URL externa</summary>
            <div className="flex gap-2 mt-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://..."
                className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-black outline-none"
              />
              <button
                type="button"
                onClick={addImageFromUrl}
                className="px-4 py-2 bg-gray-200 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </details>
        </section>

        <hr className="border-gray-300" />

        {/* Sección General */}
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium">Nombre del Producto</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej. Tote Bag Minimalista"
                className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="collection" className="block text-sm font-medium">Colección</label>
              <input
                type="text"
                id="collection"
                name="collection"
                value={formData.collection}
                onChange={handleChange}
                placeholder="Ej. Verano 2026"
                className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium">Descripción</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Descripción detallada para SEO y usuario..."
              className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all resize-none"
              required
            />
          </div>
        </section>

        <hr className="border-gray-300" />

        {/* Sección Precios y Negocio */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">Estrategia de Precios</h3>
            {margin > 0 && (
              <span className={`text-xs font-bold px-2 py-1 rounded ${margin < 30 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                Margen: {margin.toFixed(1)}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label htmlFor="basePrice" className="block text-xs font-bold uppercase text-gray-500">Precio Venta</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  <span className="text-gray-500 sm:text-sm font-medium">$</span>
                </div>
                <input
                  type="number"
                  id="basePrice"
                  name="basePrice"
                  min="0"
                  value={formData.basePrice === 0 ? '' : formData.basePrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  className={cn(
                    "w-full pl-8 pr-3 py-3 border rounded-xl outline-none transition-all bg-white",
                    isPriceWarning ? "border-red-500 focus:ring-red-500 text-red-700" : "border-zinc-200 focus:ring-black"
                  )}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="comparePrice" className="block text-xs font-bold uppercase text-gray-500">Precio Tachado</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm font-medium">$</span>
                </div>
                <input
                  type="number"
                  id="comparePrice"
                  name="comparePrice"
                  min="0"
                  value={formData.comparePrice === 0 ? '' : formData.comparePrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full block pl-7 p-3 border border-zinc-200 rounded-xl bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="costPrice" className="block text-xs font-bold uppercase text-gray-500">Costo Unitario</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm font-medium">$</span>
                </div>
                <input
                  type="number"
                  id="costPrice"
                  name="costPrice"
                  min="0"
                  value={formData.costPrice === 0 ? '' : formData.costPrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full block pl-7 p-3 border border-zinc-200 rounded-xl bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="minPrice" className="block text-xs font-bold uppercase text-gray-500">Precio Mínimo (PMA)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm font-medium">$</span>
                </div>
                <input
                  type="number"
                  id="minPrice"
                  name="minPrice"
                  min="0"
                  value={formData.minPrice === 0 ? '' : formData.minPrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full block pl-7 p-3 border border-zinc-200 rounded-xl bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all duration-200"
                  required
                />
              </div>
            </div>
          </div>

          {isPriceWarning && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>Advertencia: El precio de venta es inferior al precio mínimo autorizado (PMA).</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <label htmlFor="status" className="block text-sm font-medium">Estado del Producto</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none cursor-pointer appearance-none"
              >
                <option value="DISPONIBLE">Disponible (Stock)</option>
                <option value="BAJO_PEDIDO">Bajo Pedido</option>
                <option value="PREVENTA">Preventa</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="deliveryTime" className="block text-sm font-medium">Tiempo de Entrega</label>
              <input
                type="text"
                id="deliveryTime"
                name="deliveryTime"
                value={formData.deliveryTime}
                onChange={handleChange}
                placeholder="Ej. 3-5 días hábiles"
                className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                required
              />
            </div>
          </div>
        </section>

        <hr className="border-gray-300" />

        {/* Sección SEO */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold">SEO y Organización</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="slug" className="block text-sm font-medium">Slug (URL)</label>
              <input
                type="text"
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="nombre-del-producto"
                className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm font-mono text-gray-600"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tags" className="block text-sm font-medium">Etiquetas (Tags)</label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="verano, tote, algodon, nuevo"
                className="w-full p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500">Separadas por comas.</p>
            </div>
          </div>
        </section>

        <hr className="border-gray-300" />

        {/* Sección Variantes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Inventario y Opciones</h3>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center gap-2 text-sm font-medium text-black hover:text-gray-700 transition-colors"
            >
              <Plus size={18} />
              Agregar Variante
            </button>
          </div>

          <div className="space-y-4">
            {formData.variants.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 bg-gray-50/50">
                <p>No hay variantes definidas. Agrega colores o versiones de este producto.</p>
              </div>
            )}

            {formData.variants.map((variant, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-start p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <label className="text-xs font-medium text-gray-500">Color</label>
                  <input
                    type="text"
                    placeholder="Ej. Crudo"
                    value={variant.color}
                    onChange={(e) => updateVariant(index, 'color', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-black outline-none"
                    required
                  />
                </div>

                <div className="col-span-12 md:col-span-4 space-y-1">
                  <label className="text-xs font-medium text-gray-500">Imagen (URL o Subir)</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={variant.imageUrl}
                      onChange={(e) => updateVariant(index, 'imageUrl', e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-black outline-none"
                    />
                    <label className="cursor-pointer p-2 bg-gray-100 rounded hover:bg-gray-200 text-gray-600 hover:text-black transition-colors flex items-center justify-center min-w-[40px]" title="Subir imagen">
                      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleVariantFileUpload(index, e)}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="col-span-6 md:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-500">Stock</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={variant.stock}
                    onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div className="col-span-6 md:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-500">SKU (Auto/Manual)</label>
                  <input
                    type="text"
                    placeholder="TB-..."
                    value={variant.sku}
                    onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div className="col-span-12 md:col-span-1 flex justify-end pt-6">
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                    title="Eliminar variante"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-black text-white font-medium rounded-md hover:bg-gray-800 focus:ring-4 focus:ring-gray-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting 
              ? 'Guardando...' 
              : isEditMode 
                ? 'Actualizar Producto' 
                : 'Crear Producto'}
          </button>
        </div>
      </form>
    </div>
  );
};
