'use client';

import { createClient } from '@/utils/supabase/client';
import { useState, useEffect, ChangeEvent, FormEvent, useRef } from 'react';
import { Plus, Trash2, AlertCircle, UploadCloud, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';
import Link from 'next/link';
import { ApiResponse } from '@/types/api';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/Combobox';
import { CreatableCombobox } from '@/components/ui/CreatableCombobox';
import { apiFetch } from '@/utils/api';
import {
  formatCurrencyInput,
  parseLocalizedNumber,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from '@/lib/numeric-input';

// Utility for cleaner tailwind classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Types based on the backend DTOs implicitly
export type ProductStatus = 'DISPONIBLE' | 'BAJO_PEDIDO' | 'PREVENTA';
export type AttributeType = 'MATERIAL' | 'QUALITY' | 'LINE';
export type PriceRuleScope = 'B2C' | 'B2B';
export type PrintType = 'SERIGRAFIA' | 'DTF';

export interface VariantData {
  id?: string;
  size: string;
  sku: string;
  color: string;
  imageUrl: string;
  costPrice: number;
  salePrice: number;
  netSalePrice?: number | null;
  netPrice?: number | null;
  taxAmount?: number | null;
  marginPercentage?: number | null;
  taxRate: number;
  minPrice: number;
  comparePrice: number;
  stock: number;
  isActive: boolean;
}

export interface AttributeData {
  type: AttributeType;
  value: string;
  priceModifier: number;
  sortOrder: number;
}

export interface PricingRuleData {
  scope: PriceRuleScope;
  minQty: number;
  maxQty?: number;
  discountPct?: number;
  fixedUnitPrice?: number;
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
  seoTitle: string;
  seoDescription: string;
  collection: string;
  collectionId: string;
  tags: string;
  deliveryTime: string;
  status: ProductStatus;
  material: string;
  dimensions: string;
  careInstructions: string;
  printType: PrintType;
  images: ProductImage[];
  variants: VariantData[];
  attributes: AttributeData[];
  pricingRules: PricingRuleData[];
}

interface AdminProductFormProps {
  initialData?: Omit<Partial<ProductFormData>, 'tags' | 'images' | 'collection' | 'attributes' | 'pricingRules'> & {
    id?: string;
    tags?: string | string[];
    images?: ProductImage[] | string[] | Array<ProductImage | string>;
    collection?: string | { id: string, name: string };
    attributes?: Array<Omit<AttributeData, 'type'> & { type: 'SIZE' | AttributeType }>;
    pricingRules?: PricingRuleData[];
  };
}

// Default templates for new products
const DEFAULT_PRODUCT_ATTRIBUTES: AttributeData[] = [];

const DEFAULT_PRICING_RULES: PricingRuleData[] = [];

const normalizeVariantField = (value: string) => value.trim().toLowerCase();

const cleanSkuToken = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

const generateSkuPreview = (name: string, collection: string, size: string, color: string) => {
  const tokens = [
    'TB',
    cleanSkuToken(collection) || 'COL',
    cleanSkuToken(name) || 'PROD',
  ];

  const sizeToken = cleanSkuToken(size);
  if (sizeToken) {
    tokens.push(sizeToken);
  }

  tokens.push(cleanSkuToken(color) || 'BASE');

  return tokens.join('-');
};

const syncAutomaticSkus = (
  variants: VariantData[],
  name: string,
  collection: string,
) => {
  const skuCounts = new Map<string, number>();

  return variants.map((variant) => {
    const baseSku = generateSkuPreview(name, collection, variant.size, variant.color);
    const occurrence = (skuCounts.get(baseSku) || 0) + 1;
    skuCounts.set(baseSku, occurrence);

    return {
      ...variant,
      sku: occurrence === 1 ? baseSku : `${baseSku}-${occurrence}`,
    };
  });
};

const INITIAL_STATE: ProductFormData = {
  name: '',
  slug: '',
  description: '',
  seoTitle: '',
  seoDescription: '',
  collection: '',
  collectionId: '',
  tags: '',
  deliveryTime: '',
  status: 'BAJO_PEDIDO',
  material: '',
  dimensions: '',
  careInstructions: '',
  printType: 'DTF',
  images: [],
  variants: [
    {
      size: '',
      sku: '',
      color: '',
      imageUrl: '',
      costPrice: 0,
      salePrice: 0,
      taxRate: 0.19,
      minPrice: 0,
      comparePrice: 0,
      stock: 0,
      isActive: true,
    }
  ],
  attributes: DEFAULT_PRODUCT_ATTRIBUTES,
  pricingRules: DEFAULT_PRICING_RULES,
};

interface Collection {
  id: string;
  name: string;
}

export const AdminProductForm = ({ initialData }: AdminProductFormProps) => {
  const isEditMode = !!initialData;
  const [wizardOptions, setWizardOptions] = useState<Record<string, Array<{ id: string, name: string, code: string }>>>({});
  const [formData, setFormData] = useState<ProductFormData>(
    initialData
      ? {
          ...INITIAL_STATE,
          ...initialData,
          seoTitle: initialData.seoTitle || '',
          seoDescription: initialData.seoDescription || '',
          material: initialData.material || '',
          dimensions: initialData.dimensions || '',
          careInstructions: initialData.careInstructions || '',
          collection: typeof initialData.collection === 'object' && initialData.collection !== null
            ? (initialData.collection as unknown as Collection).name
            : (initialData.collection as string) || '',
          collectionId: typeof initialData.collection === 'object' && initialData.collection !== null
            ? (initialData.collection as unknown as Collection).id
            : '',
          images: initialData.images
            ? initialData.images.map((img: string | ProductImage) => typeof img === 'string' ? { url: img } : img)
            : [],
          tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : initialData.tags || '',
          variants: initialData.variants && initialData.variants.length > 0
            ? initialData.variants.map((variant) => ({
                id: variant.id,
                size: variant.size || '',
                sku: variant.sku || '',
                color: variant.color || '',
                imageUrl: variant.imageUrl || '',
                costPrice: variant.costPrice ?? 0,
                salePrice: variant.salePrice ?? 0,
                netSalePrice: variant.netSalePrice ?? null,
                netPrice: variant.netPrice ?? null,
                taxAmount: variant.taxAmount ?? null,
                marginPercentage: variant.marginPercentage ?? null,
                taxRate: variant.taxRate ?? 0.19,
                minPrice: variant.minPrice ?? 0,
                comparePrice: variant.comparePrice ?? 0,
                stock: variant.stock ?? 0,
                isActive: variant.isActive ?? true,
              }))
            : INITIAL_STATE.variants,
          attributes: initialData.attributes && initialData.attributes.length > 0
            ? initialData.attributes
                .filter((attribute): attribute is AttributeData => attribute.type !== 'SIZE')
                .map((attribute) => ({
                  type: attribute.type,
                  value: attribute.value,
                  priceModifier: attribute.priceModifier,
                  sortOrder: attribute.sortOrder,
                }))
            : [],
          pricingRules: initialData.pricingRules && initialData.pricingRules.length > 0
            ? initialData.pricingRules
            : [],
        }
      : INITIAL_STATE
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);

  const formatBackendCurrency = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value)
      ? `$${value.toLocaleString('es-CO')}`
      : 'Se calcula al guardar';

  const formatBackendPercentage = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value)
      ? `${value.toFixed(2)}%`
      : 'Se calcula al guardar';

  useEffect(() => {
    const fetchCollections = async () => {
      setIsLoadingCollections(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setCollections([]);
          return;
        }

        const res = await apiFetch('/collections', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401 || res.status === 403) {
          setCollections([]);
          return;
        }

        if (res.ok) {
          const body = await res.json();
          setCollections(body.data || []);
        }
      } catch (err) {
        console.error('Error fetching collections:', err);
      } finally {
        setIsLoadingCollections(false);
      }
    };

    const fetchWizardOptions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setWizardOptions({});
          return;
        }

        const res = await apiFetch('/wizard-options/grouped', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401 || res.status === 403) {
          setWizardOptions({});
          return;
        }

        if (res.ok) {
          const response = await res.json();
          const data = response.data || response;
          console.log('Wizard Options recibidos:', data);
          setWizardOptions(data);
        }
      } catch (err) {
        console.error('Error fetching wizard options:', err);
      }
    };

    fetchCollections();
    fetchWizardOptions();
  }, [supabase.auth]);

  const handleCreateCollection = async (name: string) => {
    try {
      const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Tu sesión expiró. Inicia sesión de nuevo.');
        return;
      }

      const res = await apiFetch('/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, slug }),
      });

      if (res.status === 401 || res.status === 403) {
        toast.error('No tienes permisos para crear colecciones');
        return;
      }

      if (res.ok) {
        const resBody = await res.json();
        const newCollection = resBody.data;
        setCollections(prev => [...prev, newCollection]);
        setFormData(prev => ({
          ...prev,
          collection: newCollection.name,
          collectionId: newCollection.id,
          variants: syncAutomaticSkus(prev.variants, prev.name, newCollection.name),
        }));
        toast.success(`Colección "${name}" creada`);
      } else {
        toast.error('Error al crear colección');
      }
    } catch (err) {
      console.error('Error creating collection:', err);
      toast.error('Error al crear colección');
    }
  };

  const activeVariants = formData.variants.filter((variant) => variant.isActive);
  const referenceVariants = activeVariants.length > 0 ? activeVariants : formData.variants;
  const lowestVariantPrice = referenceVariants.reduce(
    (min, variant) =>
      variant.salePrice > 0 && variant.salePrice < min ? variant.salePrice : min,
    Number.POSITIVE_INFINITY,
  );
  const highestVariantPrice = referenceVariants.reduce(
    (max, variant) => Math.max(max, variant.salePrice),
    0,
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      if (name === 'name' && !prev.slug && !isEditMode) {
        newData.slug = value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      }

      if (name === 'name' || name === 'collection') {
        newData.variants = syncAutomaticSkus(
          prev.variants,
          name === 'name' ? value : prev.name,
          name === 'collection' ? value : prev.collection,
        );
      }

      return newData;
    });
  };

    const handleAttributePriceModifierChange =
      (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
        const sanitizedValue = sanitizeDecimalInput(event.target.value);
        updateAttribute(index, 'priceModifier', sanitizedValue ? parseLocalizedNumber(sanitizedValue) : 0);
      };

    const handlePricingRuleIntegerChange =
      (index: number, field: 'minQty' | 'maxQty' | 'discountPct') => (event: ChangeEvent<HTMLInputElement>) => {
        const sanitizedValue = sanitizeIntegerInput(event.target.value);

        if (sanitizedValue === null) {
          return;
        }

        if (sanitizedValue === '') {
          updatePricingRule(
            index,
            field,
            field === 'discountPct' || field === 'maxQty' ? undefined : 0,
          );
          return;
        }

        updatePricingRule(index, field, Number.parseInt(sanitizedValue, 10));
      };

    const handlePricingRuleCurrencyChange =
      (index: number, field: 'fixedUnitPrice') => (event: ChangeEvent<HTMLInputElement>) => {
        const sanitizedValue = sanitizeDecimalInput(event.target.value);
        updatePricingRule(
          index,
          field,
          sanitizedValue ? parseLocalizedNumber(sanitizedValue) : undefined,
        );
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
    variants: syncAutomaticSkus([
      ...prev.variants,
      {
        size: '',
        sku: '',
        color: '',
        imageUrl: '',
        costPrice: 0,
        salePrice: 0,
        taxRate: 0.19,
        minPrice: 0,
        comparePrice: 0,
        stock: 0,
        isActive: true,
      },
    ], prev.name, prev.collection),
  }));
};

  const updateVariant = (index: number, field: keyof VariantData, value: string | number | boolean) => {
    setFormData((prev) => {
      const newVariants = [...prev.variants];
      newVariants[index] = { ...newVariants[index], [field]: value } as VariantData;

      return {
        ...prev,
        variants: syncAutomaticSkus(newVariants, prev.name, prev.collection),
      };
    });
  };

  const handleVariantCurrencyChange =
    (index: number, field: 'costPrice' | 'salePrice' | 'minPrice' | 'comparePrice') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const sanitizedValue = sanitizeDecimalInput(event.target.value);
      updateVariant(index, field, sanitizedValue ? parseLocalizedNumber(sanitizedValue) : 0);
    };

  const handleVariantTaxRateChange =
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const sanitizedValue = sanitizeDecimalInput(event.target.value);
      updateVariant(index, 'taxRate', sanitizedValue ? parseLocalizedNumber(sanitizedValue) : 0);
    };

  // Attributes Logic
  const addAttribute = () => {
    setFormData(prev => ({
      ...prev,
      attributes: [...prev.attributes, { type: 'MATERIAL', value: '', priceModifier: 0, sortOrder: prev.attributes.length + 1 }]
    }));
  };

  const updateAttribute = (index: number, field: keyof AttributeData, value: string | number) => {
    setFormData(prev => {
      const newAttrs = [...prev.attributes];
      const updatedAttr = { ...newAttrs[index], [field]: value } as AttributeData;

      // Reset value if type changes to prevent data inconsistency
      if (field === 'type') {
        updatedAttr.value = '';
      }

      newAttrs[index] = updatedAttr;
      return { ...prev, attributes: newAttrs };
    });
  };

  const removeAttribute = (index: number) => {
    setFormData(prev => ({ ...prev, attributes: prev.attributes.filter((_, i) => i !== index) }));
  };

  // Pricing Rules Logic
  const addPricingRule = () => {
    setFormData(prev => ({
      ...prev,
      pricingRules: [...prev.pricingRules, { scope: 'B2B', minQty: 12 }]
    }));
  };

  const updatePricingRule = (index: number, field: keyof PricingRuleData, value: string | number | undefined) => {
    setFormData(prev => {
      const newRules = [...prev.pricingRules];
      newRules[index] = { ...newRules[index], [field]: value } as PricingRuleData;
      return { ...prev, pricingRules: newRules };
    });
  };

  const removePricingRule = (index: number) => {
    setFormData(prev => ({ ...prev, pricingRules: prev.pricingRules.filter((_, i) => i !== index) }));
  };

  const submitProductForm = async (e: FormEvent) => {
    e.preventDefault();
    const combinationSet = new Set<string>();
    const normalizedCollectionId = formData.collectionId.trim();
    const normalizedCollectionName = formData.collection.trim();
    const normalizedAttributes = formData.attributes.map((attr) => ({
      ...attr,
      value: attr.value.trim(),
    }));
    const requiresVariantSizing = formData.variants.some((variant) => !!variant.size.trim());

    if (!normalizedCollectionId && !normalizedCollectionName) {
      toast.error('Selecciona o crea una coleccion antes de guardar.');
      return;
    }

    if (normalizedAttributes.some((attr) => !attr.value)) {
      toast.error('Cada atributo adicional debe tener un valor o eliminarse.');
      return;
    }

    for (const variant of formData.variants) {
      if (requiresVariantSizing && !variant.size.trim()) {
        toast.error('Si una variante usa tamano, todas las variantes deben definirlo.');
        return;
      }

      if (!variant.color.trim()) {
        toast.error('Cada variante debe tener un color.');
        return;
      }

      if (!variant.imageUrl.trim()) {
        toast.error('Todas las variantes deben tener una imagen asignada.');
        return;
      }

      if (variant.salePrice <= 0) {
        toast.error(`La variante ${variant.size || variant.sku} debe tener precio de venta mayor a 0.`);
        return;
      }

      if (variant.minPrice > variant.salePrice) {
        toast.error(`La variante ${variant.size || variant.color} no puede tener un precio minimo mayor al precio de venta.`);
        return;
      }

      if (variant.comparePrice > 0 && variant.comparePrice < variant.salePrice) {
        toast.error(`La variante ${variant.size || variant.color} no puede tener precio tachado menor al precio de venta.`);
        return;
      }

      if (variant.taxRate < 0 || variant.taxRate > 1) {
        toast.error(`La tarifa IVA de la variante ${variant.size || variant.color} debe estar entre 0 y 1.`);
        return;
      }

      if (variant.isActive) {
        const combinationKey = `${normalizeVariantField(variant.size)}::${normalizeVariantField(variant.color)}`;
        if (combinationSet.has(combinationKey)) {
          toast.error(`Hay variantes activas duplicadas para ${variant.size || 'sin talla'} / ${variant.color || 'sin color'}.`);
          return;
        }
        combinationSet.add(combinationKey);
      }
    }

    const pricingRuleSet = new Set<string>();
    for (const rule of formData.pricingRules) {
      if (rule.maxQty !== undefined && rule.maxQty < rule.minQty) {
        toast.error(`La regla ${rule.scope} no puede tener cantidad maxima menor a la minima.`);
        return;
      }

      if (
        (rule.discountPct === undefined || rule.discountPct === 0) &&
        rule.fixedUnitPrice === undefined
      ) {
        toast.error(`La regla ${rule.scope} debe definir descuento o precio fijo.`);
        return;
      }

      if (
        rule.discountPct !== undefined &&
        rule.discountPct > 0 &&
        rule.fixedUnitPrice !== undefined
      ) {
        toast.error(`La regla ${rule.scope} no puede mezclar descuento y precio fijo.`);
        return;
      }

      const ruleKey = `${rule.scope}::${rule.minQty}::${rule.maxQty ?? 'open'}`;
      if (pricingRuleSet.has(ruleKey)) {
        toast.error(`Hay reglas duplicadas para ${rule.scope} con cantidad minima ${rule.minQty}.`);
        return;
      }

      pricingRuleSet.add(ruleKey);
    }

    setIsSubmitting(true);

    try {
      const cleanVariants = syncAutomaticSkus(
        formData.variants.map((variant) => ({
          ...variant,
          size: variant.size.trim(),
          color: variant.color.trim(),
        })),
        formData.name,
        formData.collection,
      ).map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        size: variant.size.trim(),
        sku: variant.sku.trim(),
        color: variant.color.trim(),
        imageUrl: variant.imageUrl.trim(),
        costPrice: variant.costPrice,
        salePrice: variant.salePrice,
        taxRate: variant.taxRate,
        minPrice: variant.minPrice,
        comparePrice: variant.comparePrice || undefined,
        isActive: variant.isActive,
      }));

      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        seoTitle: formData.seoTitle.trim() || undefined,
        seoDescription: formData.seoDescription.trim() || undefined,
        collectionId: normalizedCollectionId,
        collectionName: normalizedCollectionName,
        deliveryTime: formData.deliveryTime.trim(),
        status: formData.status,
        material: formData.material.trim() || undefined,
        dimensions: formData.dimensions.trim() || undefined,
        careInstructions: formData.careInstructions.trim() || undefined,
        printType: formData.printType,
        images: formData.images.map((img, index) => ({ url: img.url.trim(), position: index })),
        variants: cleanVariants,
        attributes: normalizedAttributes.map((attr) => ({
          type: attr.type,
          value: attr.value,
          priceModifier: attr.priceModifier,
          sortOrder: attr.sortOrder,
        })),
        pricingRules: formData.pricingRules.map((rule) => ({
          scope: rule.scope,
          minQty: rule.minQty,
          maxQty: rule.maxQty,
          discountPct: rule.discountPct,
          fixedUnitPrice: rule.fixedUnitPrice,
        })),
        tags: typeof formData.tags === 'string'
          ? formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : formData.tags,
      };

      const path = isEditMode
        ? `/catalog/${initialData.id}`
        : '/catalog';

      const method = isEditMode ? 'PATCH' : 'POST';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const response = await apiFetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401 || response.status === 403) {
        toast.error('No tienes permisos para guardar productos');
        return;
      }

      if (!response.ok) {
        let errorMsg = 'Error al guardar el producto';

        try {
          const errorData = await response.json();
          const responseMessage =
            typeof errorData?.message === 'string' || Array.isArray(errorData?.message)
              ? errorData.message
              : typeof errorData?.error === 'string'
                ? errorData.error
                : undefined;

          if (Array.isArray(responseMessage)) {
            errorMsg = responseMessage.join(', ');
          } else if (responseMessage) {
            errorMsg = responseMessage;
          }
        } catch {
          // Keep fallback message if response JSON is invalid.
        }

        toast.error(errorMsg);
        return;
      }

      const responseBody: ApiResponse<{ name: string }> = await response.json();
      const result = responseBody.data;
      toast.success(`Producto "${result.name}" ${isEditMode ? 'actualizado' : 'creado'} correctamente.`);

      if (!isEditMode) {
        setFormData(INITIAL_STATE);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Hubo un problema al guardar el producto.';
      console.error('Unexpected error saving product:', error);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-surface text-primary rounded-lg shadow-sm font-sans transition-colors">
      <div className="mb-8">
        <h2 className="text-2xl font-black tracking-tight mb-2">
          {isEditMode ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <p className="text-muted text-sm font-medium">
          {isEditMode
            ? 'Modifica la información existente del producto.'
            : 'Ingresa la información básica y define las variantes para el catálogo.'}
        </p>
      </div>

      <form onSubmit={submitProductForm} className="space-y-8">

        {/* Sección Imágenes */}
        <section className="space-y-4">
          <label className="block text-xs font-black uppercase tracking-widest text-primary">Imágenes del producto</label>
          <div className="flex flex-wrap gap-4">
            {/* Upload Button */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-24 h-24 flex-shrink-0 border-2 border-dashed border-theme rounded-xl flex flex-col items-center justify-center text-muted bg-base cursor-pointer hover:border-primary hover:text-primary transition-all active:scale-95",
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
                  <span className="text-[10px] font-black uppercase">Subir</span>
                </>
              )}
            </div>

            {/* Images List */}
            {formData.images.filter(img => img.url && img.url.trim() !== '').map((img, idx) => (
              <div key={idx} className="relative w-24 h-24 flex-shrink-0 bg-base border border-theme rounded-xl overflow-hidden group shadow-sm">
                <Image src={img.url || '/placeholder.svg'} alt={`Preview ${idx}`} fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-surface/90 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface shadow-sm"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Fallback URL Input */}
          <details className="text-[10px] font-bold uppercase tracking-widest text-muted">
            <summary className="cursor-pointer hover:text-primary transition-colors">O agregar desde una URL externa</summary>
            <div className="flex gap-2 mt-3">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://..."
                className="flex-1 p-2.5 border border-theme rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-base text-primary font-medium"
              />
              <button
                type="button"
                onClick={addImageFromUrl}
                className="px-4 py-2 bg-primary text-base-color rounded-xl hover:opacity-90 transition-all active:scale-90 shadow-md shadow-primary/10"
              >
                <Plus size={16} />
              </button>
            </div>
          </details>
        </section>

        <hr className="border-theme" />

        {/* Sección General */}
        <section className="space-y-6">
          <div className="rounded-2xl border border-theme bg-base/20 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              Esta sección no define precios del producto base. Solo concentra el estado general, los tiempos y la organización comercial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-[10px] font-black uppercase tracking-widest text-primary">Nombre del producto</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej. Tote Bag Minimalista"
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="collection" className="block text-[10px] font-black uppercase tracking-widest text-primary">Colección</label>
              <CreatableCombobox
                options={collections.map(c => ({ value: c.id, label: c.name }))}
                value={formData.collectionId}
                onChange={(id, name) => setFormData(prev => ({
                  ...prev,
                  collection: name,
                  collectionId: id,
                  variants: syncAutomaticSkus(prev.variants, prev.name, name),
                }))}
                onCreate={handleCreateCollection}
                placeholder="Seleccionar colección..."
                isLoading={isLoadingCollections}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-[10px] font-black uppercase tracking-widest text-primary">Descripción</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Descripción detallada..."
              className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="material" className="block text-[10px] font-black uppercase tracking-widest text-primary">Material base</label>
              <input
                type="text"
                id="material"
                name="material"
                value={formData.material}
                onChange={handleChange}
                placeholder="Ej. Algodon resistente"
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dimensions" className="block text-[10px] font-black uppercase tracking-widest text-primary">Dimensiones base</label>
              <input
                type="text"
                id="dimensions"
                name="dimensions"
                value={formData.dimensions}
                onChange={handleChange}
                placeholder="Ej. 35x40 cm"
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="printType" className="block text-[10px] font-black uppercase tracking-widest text-primary">Tecnica principal</label>
              <select
                id="printType"
                name="printType"
                value={formData.printType}
                onChange={handleChange}
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-bold focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer appearance-none"
              >
                <option value="DTF">DTF</option>
                <option value="SERIGRAFIA">Serigrafia</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="careInstructions" className="block text-[10px] font-black uppercase tracking-widest text-primary">Cuidado</label>
              <input
                type="text"
                id="careInstructions"
                name="careInstructions"
                value={formData.careInstructions}
                onChange={handleChange}
                placeholder="Ej. Lavar a mano con agua fria"
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>
        </section>

        <hr className="border-theme" />

        {/* Sección Precios y Negocio */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-primary tracking-tight">Información general</h3>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                Define el estado comercial general y el tiempo de entrega del producto.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-theme bg-base/30 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              La estrategia de precios se define por variante. Usa la sección de variantes para capturar costo, precio de venta, precio mínimo y precio tachado.
            </p>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <label htmlFor="status" className="block text-[10px] font-black uppercase tracking-widest text-primary">Estado del producto</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-bold focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer appearance-none"
              >
                <option value="DISPONIBLE">Disponible (en stock)</option>
                <option value="BAJO_PEDIDO">Bajo pedido</option>
                <option value="PREVENTA">Preventa</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="deliveryTime" className="block text-[10px] font-black uppercase tracking-widest text-primary">Tiempo de entrega</label>
              <input
                type="text"
                id="deliveryTime"
                name="deliveryTime"
                value={formData.deliveryTime}
                onChange={handleChange}
                placeholder="Ej. 3-5 días hábiles"
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>
          </div>
        </section>

        <hr className="border-theme" />

        {/* Sección SEO */}
        <section className="space-y-6">
          <h3 className="text-lg font-black text-primary tracking-tight">SEO y organización</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="slug" className="block text-[10px] font-black uppercase tracking-widest text-primary">Slug (URL)</label>
              <input
                type="text"
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="nombre-del-producto"
                className="w-full p-3 border border-theme rounded-xl bg-base text-muted font-mono text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tags" className="block text-[10px] font-black uppercase tracking-widest text-primary">Etiquetas</label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="verano, tote, algodón, nuevo"
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <p className="text-[9px] text-muted font-bold uppercase tracking-widest px-1">Separadas por comas.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="seoTitle" className="block text-[10px] font-black uppercase tracking-widest text-primary">Titulo SEO</label>
              <input
                type="text"
                id="seoTitle"
                name="seoTitle"
                value={formData.seoTitle}
                onChange={handleChange}
                placeholder="Titulo opcional para buscadores"
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="seoDescription" className="block text-[10px] font-black uppercase tracking-widest text-primary">Descripcion SEO</label>
              <input
                type="text"
                id="seoDescription"
                name="seoDescription"
                value={formData.seoDescription}
                onChange={handleChange}
                placeholder="Resumen opcional para buscadores"
                className="w-full p-3 border border-theme rounded-xl bg-base text-primary font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted">Vista previa en buscadores</label>
            <div className="bg-white p-6 rounded-2xl border border-theme shadow-sm max-w-2xl overflow-hidden">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 bg-[#f1f3f4] rounded-full flex items-center justify-center text-[10px] text-[#202124] font-bold">T</div>
                <div className="flex flex-col">
                  <span className="text-[12px] text-[#202124] leading-tight font-medium">Tote Bag</span>
                  <span className="text-[11px] text-[#70757a] leading-tight">https://tote-bag.com/products/{formData.slug || 'slug-del-producto'}</span>
                </div>
              </div>
              <h3 className="text-[18px] text-[#1a0dab] hover:underline cursor-pointer leading-tight mb-1 font-medium truncate">
                {formData.name || 'Título del producto'} | Tote Bag
              </h3>
              <p className="text-[13px] text-[#4d5156] leading-relaxed line-clamp-2 font-normal">
                {formData.description || 'Agrega una descripción para ver cómo se verá tu producto en los resultados de búsqueda de Google.'}
              </p>
            </div>
          </div>
        </section>

        <hr className="border-theme" />

        {/* Sección Variantes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-primary tracking-tight">Variantes del producto</h3>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                Cada variante es una referencia comercial independiente con su propio precio, costo, imagen y SKU automatico. El inventario se sincroniza desde recepciones y movimientos.
              </p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary hover:opacity-70 transition-all active:scale-95"
            >
              <Plus size={18} />
              Agregar variante
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-theme bg-base/20 p-4 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Variantes activas</p>
              <p className="text-2xl font-black text-primary">{activeVariants.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                {formData.variants.length} referencia{formData.variants.length === 1 ? '' : 's'} registrada{formData.variants.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-2xl border border-theme bg-base/20 p-4 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Rango de venta</p>
              <p className="text-2xl font-black text-primary">
                {referenceVariants.length > 0 ? `$${lowestVariantPrice.toFixed(2)}` : '$0.00'}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                {referenceVariants.length > 1 ? `hasta $${highestVariantPrice.toFixed(2)}` : 'Según las variantes activas'}
              </p>
            </div>
            <div className="rounded-2xl border border-theme bg-base/20 p-4 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Inventario</p>
              <p className="text-2xl font-black text-primary">
                {formData.variants.reduce((total, variant) => total + (variant.stock || 0), 0)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Stock sincronizado desde compras y descuentos FIFO
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-theme bg-base/30 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              No mezcles dimensiones base con extras opcionales. Si pequeño y grande se venden distinto, deben existir como variantes separadas.
            </p>
          </div>

          <div className="space-y-4">
            {formData.variants.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-theme rounded-3xl text-muted bg-base/30">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">No hay variantes definidas.</p>
              </div>
            )}

            {formData.variants.map((variant, index) => {
              const hasVariantPriceWarning = variant.minPrice > variant.salePrice && variant.salePrice > 0;

              return (
                <div key={variant.id ?? index} className="space-y-4 p-5 border border-theme rounded-2xl bg-base/40 shadow-sm transition-all hover:bg-base/60">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Variante {index + 1}</p>
                      <h4 className="text-base font-black text-primary">
                        {variant.size || 'Tamaño por definir'}{variant.color ? ` / ${variant.color}` : ''}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border",
                        variant.isActive
                          ? "bg-secondary/10 text-secondary border-secondary/20"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {variant.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="text-muted hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-xl"
                        title="Eliminar variante"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Tamaño</label>
                      <Combobox
                        options={(wizardOptions.DIMENSION || []).map((option) => ({ value: option.name, label: option.name }))}
                        value={variant.size}
                        onChange={(value) => updateVariant(index, 'size', value)}
                        placeholder="Seleccionar tamaño..."
                        className="bg-surface"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Color</label>
                      <input
                        type="text"
                        placeholder="Ej. Crudo"
                        value={variant.color}
                        onChange={(e) => updateVariant(index, 'color', e.target.value)}
                        required
                        className="w-full p-2.5 border border-theme rounded-xl bg-surface text-primary text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">SKU</label>
                      <input
                        type="text"
                        value={variant.sku}
                        readOnly
                        className="w-full p-2.5 border border-theme rounded-xl bg-base text-muted text-[10px] font-mono cursor-not-allowed outline-none"
                      />
                      <p className="text-[10px] font-medium text-muted">
                        Sugerencia editable. Formato permitido: letras, números, punto, guion, slash o underscore.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Estado</label>
                      <select
                        value={variant.isActive ? 'ACTIVE' : 'INACTIVE'}
                        onChange={(e) => updateVariant(index, 'isActive', e.target.value === 'ACTIVE')}
                        className="w-full p-2.5 border border-theme rounded-xl bg-surface text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                      >
                        <option value="ACTIVE">Activa</option>
                        <option value="INACTIVE">Inactiva</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Costo unitario</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={variant.costPrice === 0 ? '' : formatCurrencyInput(String(variant.costPrice))}
                        onChange={handleVariantCurrencyChange(index, 'costPrice')}
                        required
                        className="w-full p-2.5 border border-theme rounded-xl bg-surface text-sm font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Precio de venta</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={variant.salePrice === 0 ? '' : formatCurrencyInput(String(variant.salePrice))}
                        onChange={handleVariantCurrencyChange(index, 'salePrice')}
                        required
                        className={cn(
                          "w-full p-2.5 border rounded-xl bg-surface text-sm font-black focus:ring-2 outline-none transition-all",
                          hasVariantPriceWarning
                            ? "border-red-500 text-red-700 focus:ring-red-500/20"
                            : "border-theme focus:ring-primary/20"
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Tarifa IVA</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.19"
                        value={String(variant.taxRate)}
                        onChange={handleVariantTaxRateChange(index)}
                        required
                        className="w-full p-2.5 border border-theme rounded-xl bg-surface text-sm font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                      <p className="text-[10px] font-medium text-muted">Decimal entre 0 y 1.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Precio mínimo</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={variant.minPrice === 0 ? '' : formatCurrencyInput(String(variant.minPrice))}
                        onChange={handleVariantCurrencyChange(index, 'minPrice')}
                        required
                        className="w-full p-2.5 border border-theme rounded-xl bg-surface text-sm font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Precio tachado</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={variant.comparePrice === 0 ? '' : formatCurrencyInput(String(variant.comparePrice))}
                        onChange={handleVariantCurrencyChange(index, 'comparePrice')}
                        className="w-full p-2.5 border border-theme rounded-xl bg-surface text-sm font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl border border-theme bg-base/20 p-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Venta neta</p>
                      <p className="text-lg font-black text-secondary">
                        {formatBackendCurrency(variant.netPrice ?? variant.netSalePrice)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">IVA incluido</p>
                      <p className="text-lg font-black text-primary">
                        {formatBackendCurrency(variant.taxAmount)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Margen bruto</p>
                      <p className="text-lg font-black text-primary">
                        {formatBackendPercentage(variant.marginPercentage)}
                      </p>
                    </div>
                  </div>

                  {hasVariantPriceWarning && (
                    <div className="flex items-start gap-2 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs font-bold">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>El precio de venta no puede quedar por debajo del precio mínimo de esta variante.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px] gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Imagen de la variante</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://..."
                          value={variant.imageUrl}
                          onChange={(e) => updateVariant(index, 'imageUrl', e.target.value)}
                          required
                          className="flex-1 p-2.5 border border-theme rounded-xl bg-surface text-primary text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <label className="cursor-pointer p-2.5 bg-primary rounded-xl text-base-color hover:opacity-90 transition-all active:scale-90 flex items-center justify-center min-w-[44px] shadow-md shadow-primary/10" title="Subir imagen">
                          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
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
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Stock sincronizado</label>
                      <input
                        type="text"
                        readOnly
                        value={String(variant.stock ?? 0)}
                        className="w-full p-2.5 border border-theme rounded-xl bg-base text-sm font-black text-muted cursor-not-allowed outline-none transition-all"
                      />
                      <p className="text-[10px] font-medium text-muted">
                        Se gestiona desde compras e inventario. Este formulario no modifica stock directamente.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <hr className="border-theme" />

        {/* Sección Atributos de configuración */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-primary tracking-tight">Configuraciones adicionales</h3>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                Usa este bloque solo para extras opcionales. El tamaño ahora se define en las variantes del producto.
              </p>
            </div>
            <button
              type="button"
              onClick={addAttribute}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary hover:opacity-70 transition-all active:scale-95"
            >
              <Plus size={18} />
              Agregar atributo
            </button>
          </div>

          <div className="space-y-3">
            {formData.attributes.map((attr, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-end p-5 border border-theme rounded-2xl bg-base/20 shadow-sm transition-all hover:bg-base/30">
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Tipo</label>
                  <select
                    value={attr.type}
                    onChange={(e) => updateAttribute(index, 'type', e.target.value as AttributeType)}
                    className="w-full p-2.5 border border-theme rounded-xl bg-surface text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                  >
                    <option value="MATERIAL">Material</option>
                    <option value="QUALITY">Calidad</option>
                    <option value="LINE">Línea</option>
                  </select>
                </div>
                <div className="col-span-12 md:col-span-5 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Valor</label>
                  <Combobox
                    options={(wizardOptions[attr.type] || []).map(opt => ({ value: opt.name, label: opt.name }))}
                    value={attr.value}
                    onChange={(val) => updateAttribute(index, 'value', val)}
                    placeholder="Seleccionar valor..."
                    className="bg-surface"
                  />
                </div>
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Modificador de precio</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={attr.priceModifier === 0 ? '' : formatCurrencyInput(String(attr.priceModifier))}
                      onChange={handleAttributePriceModifierChange(index)}
                      placeholder="0"
                      className="w-full pl-7 p-2.5 border border-theme rounded-xl bg-surface text-xs font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="col-span-12 md:col-span-1 flex justify-end pb-1">
                  <button
                    type="button"
                    onClick={() => removeAttribute(index)}
                    className="p-2.5 text-muted hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Eliminar atributo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-theme" />

        {/* Sección Reglas de precio y volumen */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-primary tracking-tight">Reglas de precio y volumen</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Hoy estas reglas aplican al producto completo. No existe alcance por variante en este modelo.
              </p>
            </div>
            <button
              type="button"
              onClick={addPricingRule}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary hover:opacity-70 transition-all active:scale-95"
            >
              <Plus size={18} />
              Agregar regla
            </button>
          </div>

          <div className="space-y-3">
            {formData.pricingRules.map((rule, index) => (
              <div key={index} className="p-4 border border-theme rounded-2xl bg-base/20 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Alcance</label>
                    <select
                      value={rule.scope}
                      onChange={(e) => updatePricingRule(index, 'scope', e.target.value)}
                      className="w-full p-2 border border-theme rounded-xl bg-surface text-xs font-bold"
                    >
                      <option value="B2C">B2C (detalle)</option>
                      <option value="B2B">B2B (mayorista)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Cantidad mínima</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rule.minQty}
                      onChange={handlePricingRuleIntegerChange(index, 'minQty')}
                      className="w-full p-2 border border-theme rounded-xl bg-surface text-xs font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Cantidad máxima</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rule.maxQty ?? ''}
                      onChange={handlePricingRuleIntegerChange(index, 'maxQty')}
                      placeholder="Opcional"
                      className="w-full p-2 border border-theme rounded-xl bg-surface text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">% Descuento</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rule.discountPct || ''}
                      onChange={handlePricingRuleIntegerChange(index, 'discountPct')}
                      placeholder="0"
                      className="w-full p-2 border border-theme rounded-xl bg-surface text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Precio fijo</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rule.fixedUnitPrice ? formatCurrencyInput(String(rule.fixedUnitPrice)) : ''}
                      onChange={handlePricingRuleCurrencyChange(index, 'fixedUnitPrice')}
                      placeholder="Opcional"
                      className="w-full p-2 border border-theme rounded-xl bg-surface text-xs font-bold"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removePricingRule(index)}
                      className="p-2 text-muted hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] font-medium text-muted">
                  Usa descuento o precio fijo, no ambos. Si defines cantidad máxima, debe ser mayor o igual a la mínima.
                </p>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-theme" />

        <div className="pt-8 flex justify-end gap-4">
          <Link
            href="/dashboard/products"
            className="px-8 py-4 border border-theme text-primary font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-base active:scale-95 transition-all"
          >
            Volver a productos
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-10 py-4 bg-primary text-base-color font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? 'Guardando...'
              : isEditMode
                ? 'Actualizar producto'
                : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  );
};
