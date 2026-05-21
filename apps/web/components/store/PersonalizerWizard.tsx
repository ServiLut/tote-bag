'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  Check,
  Loader2,
  AlertCircle,
  Truck,
  Leaf,
  ShoppingBag,
  Star,
  Briefcase,
  Box
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';
import { ApiResponse } from '@/types/api';
import { Product } from '@/types/product';
import { translateStoreText, translateStoreValue } from '@/lib/storefront-translations';

interface WizardOption {
  id: string;
  category: string;
  name: string;
  code: string;
  description?: string;
  basePriceModifier: number;
  allowedMaterialValues?: string[];
  imageUrl?: string;
}

interface GroupedOptions {
  LINE: WizardOption[];
  DIMENSION: WizardOption[];
  MATERIAL: WizardOption[];
  TECHNIQUE: WizardOption[];
}

interface PersonalizerWizardProps {
  productId?: string;
  productSlug?: string;
  mode?: 'wizard' | 'direct';
}

type Step = 1 | 2 | 3 | 4 | 5;
type ProductResolution = {
  product: Product;
  variant: {
    id: string;
    sku: string;
    size: string;
    color: string;
    imageUrl: string;
    stock: number;
  };
};

class ProductResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductResolutionError';
  }
}

const getLineIcon = (code: string) => {
  if (code.includes('ECO')) return Leaf;
  if (code.includes('COMERCIAL')) return ShoppingBag;
  if (code.includes('PREMIUM')) return Star;
  if (code.includes('CORPORATIVA')) return Briefcase;
  return Box;
};

const isOtherTechniqueOption = (option: PersonalizerTechniqueOption) => {
  const normalized = `${option.code} ${option.name}`.toLowerCase();
  return normalized.includes('cierre') || normalized.includes('boton') || normalized.includes('botón');
};

/* personalizer-wizard-test-helpers:start */
export interface PersonalizerTechniqueOption {
  code: string;
  name: string;
  allowedMaterialValues?: string[];
}

export interface PersonalizerTechniqueActionGuard {
  hasCompatibleTechniqueOptions: boolean;
  hasUploadedLogo: boolean;
  hasDesignUrl: boolean;
  hasPreparedDesign?: boolean;
  hasConfigCode: boolean;
  isUploadingLogo?: boolean;
  isPricingLoading?: boolean;
}

const isOtherTechniqueOptionForGuard = (option: PersonalizerTechniqueOption) => {
  const normalized = `${option.code} ${option.name}`.toLowerCase();
  return normalized.includes('cierre') || normalized.includes('boton') || normalized.includes('botón');
};

const isTechniqueCompatibleWithMaterial = (
  option: PersonalizerTechniqueOption,
  material: string,
) =>
  !option.allowedMaterialValues ||
  option.allowedMaterialValues.length === 0 ||
  option.allowedMaterialValues.includes(material);

export const getCompatibleTechniqueOptions = (
  options: PersonalizerTechniqueOption[],
  material: string,
) =>
  options.filter(
    (option) =>
      !isOtherTechniqueOptionForGuard(option) &&
      isTechniqueCompatibleWithMaterial(option, material),
  );

export const getCompatibleOtherOptions = (
  options: PersonalizerTechniqueOption[],
  material: string,
) =>
  options.filter(
    (option) =>
      isOtherTechniqueOptionForGuard(option) &&
      isTechniqueCompatibleWithMaterial(option, material),
  );

export const isTechniqueActionBlocked = ({
  hasCompatibleTechniqueOptions,
  hasUploadedLogo,
  hasDesignUrl,
  hasPreparedDesign = false,
  hasConfigCode,
  isUploadingLogo = false,
  isPricingLoading = false,
}: PersonalizerTechniqueActionGuard) =>
  isPricingLoading ||
  isUploadingLogo ||
  !hasCompatibleTechniqueOptions ||
  !hasUploadedLogo ||
  (!hasDesignUrl && !hasPreparedDesign) ||
  !hasConfigCode;

export const PERSONALIZER_INLINE_DRAFT_MAX_BYTES = 1024 * 1024;

export const shouldInlineDraftDesign = (fileSize?: number | null) =>
  typeof fileSize === 'number' &&
  fileSize > 0 &&
  fileSize <= PERSONALIZER_INLINE_DRAFT_MAX_BYTES;

export const resolveRestoredSizeSelection = ({
  restoredSize,
  resolvedVariantSize,
  currentSize,
}: {
  restoredSize?: string | null;
  resolvedVariantSize?: string | null;
  currentSize?: string | null;
}) =>
  restoredSize?.trim() ||
  resolvedVariantSize?.trim() ||
  currentSize?.trim() ||
  '';
/* personalizer-wizard-test-helpers:end */

const getDimensionVisualLabel = (option: WizardOption) => {
  const candidate = option.description?.trim();
  return candidate ? candidate : option.name;
};

const DESIGN_FILE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};

const PERSONALIZER_DRAFT_STORAGE_KEY = 'storefront.personalizer.draft.v1';

type PersonalizerDraft = {
  redirectPath: string;
  step: Step;
  uploadedLogo: string | null;
  designFileName: string | null;
  designFileType: string | null;
  requiresDesignReupload?: boolean;
  logoScale: number;
  configCode: string;
  calculatedUnitPrice: number;
  calculatedTotalPrice: number;
  resolvedProductId: string;
  resolvedVariant: ProductResolution['variant'] | null;
  selections: {
    line: string;
    size: string;
    material: string;
    quantity: number;
    markingType: string;
    extraOptions: string[];
    designUrl: string;
  };
};

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(
  dataUrl: string,
  fileName: string,
  mimeType?: string | null,
) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const type = mimeType || blob.type || 'image/png';
  return new File([blob], fileName, { type });
}

const ensureDesignFileName = (file: File) => {
  const trimmedName = file.name.trim();
  const fallbackName = 'diseno-personalizado';
  const safeBaseName = (trimmedName || fallbackName).replace(/\s+/g, '-');
  const hasKnownExtension = /\.(png|jpe?g|webp)$/i.test(safeBaseName);
  const inferredExtension = DESIGN_FILE_EXTENSION_BY_MIME_TYPE[file.type];

  if (hasKnownExtension || !inferredExtension) {
    return safeBaseName;
  }

  return `${safeBaseName}${inferredExtension}`;
};

const getActiveCommercialVariants = (product?: Partial<Product> | null) =>
  (product?.variants || []).filter(
    (variant) => variant.isActive !== false && !!variant.id && !!variant.sku,
  );

const getReferenceVariant = (product?: Partial<Product> | null) => {
  const activeVariants = getActiveCommercialVariants(product);

  return (
    activeVariants
      .filter((variant) => typeof variant.salePrice === 'number')
      .sort((left, right) => (left.salePrice ?? 0) - (right.salePrice ?? 0))[0]
    || activeVariants[0]
    || null
  );
};

const resolveVariantBySize = (
  product: Partial<Product> | null | undefined,
  size: string,
  preferredVariantId?: string | null,
) => {
  const activeVariants = getActiveCommercialVariants(product);
  const normalizedSize = size.trim().toLowerCase();
  const matchingVariants = activeVariants.filter(
    (variant) => variant.size?.trim().toLowerCase() === normalizedSize,
  );

  if (matchingVariants.length === 0) {
    return null;
  }

  return (
    matchingVariants.find((variant) => variant.id === preferredVariantId)
    || matchingVariants[0]
  );
};

const resolveProductSelection = (product?: Partial<Product> | null): ProductResolution | null => {
  const variant = getReferenceVariant(product);

  if (!product?.id || !variant?.id || !variant?.sku) {
    return null;
  }

  return {
    product: product as Product,
    variant: {
      id: variant.id,
      sku: variant.sku,
      size: variant.size || '',
      color: variant.color || 'Base',
      imageUrl: variant.imageUrl || '',
      stock: variant.stock || 0,
    },
  };
};

const findPreferredProduct = (
  products: Product[],
  preferredSlug?: string,
): Product | null => {
  const candidates = preferredSlug
    ? [
        ...products.filter((product) => product.slug === preferredSlug),
        ...products.filter((product) => product.slug !== preferredSlug),
      ]
    : products;

  return (
    candidates.find((product) => !!resolveProductSelection(product)) || null
  );
};

export default function PersonalizerWizard({
  productId,
  productSlug = 'tote-bag-clasica',
  mode = 'wizard',
}: PersonalizerWizardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const isDirectMode = mode === 'direct';
  const loginRedirectBasePath = isDirectMode
    ? '/personaliza'
    : '/personaliza/configurador';
  const getTranslatedLineName = (line?: Pick<WizardOption, 'code' | 'name'> | null) =>
    translateStoreValue('line', line?.code || line?.name, t) || line?.name || '';
  const getCompactLineName = (line?: Pick<WizardOption, 'code' | 'name'> | null) => {
    const translatedName = getTranslatedLineName(line);
    const rawName = translatedName || line?.name || line?.code || '';

    return rawName
      .replace(/^l[ií]nea\s+/i, '')
      .replace(/^line_/i, '')
      .trim();
  };
  const getTranslatedLineDescription = (
    line?: Pick<WizardOption, 'code' | 'name' | 'description'> | null,
  ) =>
    translateStoreText(
      'store_description',
      'line',
      line?.code || line?.name,
      line?.description || '',
      t,
    );
  const getTranslatedMaterialName = (material?: string | null) =>
    translateStoreValue('material', material, t) || material || '';
  const getTranslatedSizeName = (size?: string | null) =>
    translateStoreValue('size', size, t) || size || '';
  const getTranslatedTechniqueName = (
    technique?: Pick<WizardOption, 'code' | 'name'> | PersonalizerTechniqueOption | null,
  ) =>
    translateStoreValue('technique', technique?.code || technique?.name, t)
    || technique?.name
    || '';
  const getCompactTechniqueName = (
    technique?: Pick<WizardOption, 'code' | 'name'> | PersonalizerTechniqueOption | null,
  ) => {
    const translatedName = getTranslatedTechniqueName(technique);
    const rawName = translatedName || technique?.name || technique?.code || '';

    return rawName
      .replace(/^technique_/i, '')
      .replace(/^t[eé]cnica\s+/i, '')
      .replace(/_/g, ' ')
      .trim();
  };
  const loginRedirectParams = new URLSearchParams();
  if (productId) {
    loginRedirectParams.set('productId', productId);
  } else if (productSlug) {
    loginRedirectParams.set('product', productSlug);
  }
  const loginRedirectPath = loginRedirectParams.size > 0
    ? `${loginRedirectBasePath}?${loginRedirectParams.toString()}`
    : loginRedirectBasePath;

  const [step, setStep] = useState<Step>(isDirectMode ? 4 : 1);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [wizardOptions, setWizardOptions] = useState<GroupedOptions | null>(null);
  const [resolvedProduct, setResolvedProduct] = useState<Product | null>(null);
  const [resolvedProductId, setResolvedProductId] = useState(productId ?? '');
  const [resolvedVariant, setResolvedVariant] = useState<{
    id: string;
    sku: string;
    size: string;
    color: string;
    imageUrl: string;
    stock: number;
  } | null>(null);

  const [selections, setSelections] = useState({
    line: '',
    size: '',
    material: '',
    quantity: 1,
    markingType: '',
    extraOptions: [] as string[],
    designUrl: '',
    customFile: null as File | null,
  });

  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [designFileName, setDesignFileName] = useState<string | null>(null);
  const [designFileType, setDesignFileType] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState(50);
  const [calculatedUnitPrice, setCalculatedUnitPrice] = useState(0);
  const [calculatedTotalPrice, setCalculatedTotalPrice] = useState(0);
  const [configCode, setConfigCode] = useState('');
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredDraftRef = useRef<PersonalizerDraft | null>(null);

  useEffect(() => {
    setStep(isDirectMode ? 4 : 1);
  }, [isDirectMode]);

  useEffect(() => {
    setResolvedProductId(productId ?? '');
    setResolvedProduct(null);
    setResolvedVariant(null);
  }, [productId]);

  useEffect(() => {
    if (productId) {
      return;
    }

    setResolvedProduct(null);
    setResolvedVariant(null);
  }, [productId, productSlug]);

  useEffect(() => {
    if (resolvedProduct) return;

    const fetchBaseProduct = async () => {
      try {
        let resolvedSelection: ProductResolution | null = null;
        let selectedProduct: Product | null = null;

        if (productId) {
          const res = await apiFetch(`/catalog/${encodeURIComponent(productId)}`);
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          const body = (await res.json()) as ApiResponse<Product>;
          selectedProduct = body.data;
          resolvedSelection = resolveProductSelection(selectedProduct);

          if (!resolvedSelection) {
            throw new ProductResolutionError('Missing product id');
          }
        } else {
          const res = await apiFetch('/catalog/products');
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          const body = (await res.json()) as ApiResponse<Product[]>;
          selectedProduct = findPreferredProduct(body.data, productSlug);
          resolvedSelection = resolveProductSelection(selectedProduct);

          if (!resolvedSelection) {
            setOptionsError(t('wizard_unavailable'));
            return;
          }
        }

        setResolvedProduct(selectedProduct);
        setResolvedProductId(resolvedSelection.product.id);
        setResolvedVariant(resolvedSelection.variant);
        setSelections((prev) => ({
          ...prev,
          size: resolveRestoredSizeSelection({
            restoredSize: restoredDraftRef.current?.selections.size,
            resolvedVariantSize: resolvedSelection.variant.size,
            currentSize: prev.size,
          }),
        }));
        restoredDraftRef.current = null;
      } catch (error) {
        if (error instanceof ProductResolutionError) {
          setOptionsError(t('wizard_unavailable'));
          return;
        }

        console.error('Fetch base product error:', error);
        setOptionsError(t('wizard_unavailable'));
      }
    };

    void fetchBaseProduct();
  }, [productId, productSlug, resolvedProduct, t]);

  useEffect(() => {
    if (!resolvedProduct) {
      return;
    }

    const activeVariants = getActiveCommercialVariants(resolvedProduct);
    if (activeVariants.length === 0) {
      return;
    }

    const nextVariant = selections.size
      ? resolveVariantBySize(resolvedProduct, selections.size, resolvedVariant?.id)
      : getReferenceVariant(resolvedProduct);

    if (!nextVariant) {
      return;
    }

    if (nextVariant.id !== resolvedVariant?.id) {
      setResolvedVariant({
        id: nextVariant.id as string,
        sku: nextVariant.sku,
        size: nextVariant.size || '',
        color: nextVariant.color || 'Base',
        imageUrl: nextVariant.imageUrl || '',
        stock: nextVariant.stock || 0,
      });
    }

    if (!selections.size && nextVariant.size) {
      setSelections((prev) => ({
        ...prev,
        size: nextVariant.size || prev.size,
      }));
    }
  }, [resolvedProduct, resolvedVariant?.id, selections.size]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        setOptionsError(null);
        const res = await apiFetch('/wizard-options/grouped');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
        }
        const resBody = await res.json();
        const data = resBody.data as GroupedOptions;
        setWizardOptions(data);
        const defaultMarking =
          data.TECHNIQUE?.find((option) => !isOtherTechniqueOption(option))?.code || '';

        setSelections(prev => ({
          ...prev,
          line: data.LINE?.[0]?.code || '',
          size: prev.size || data.DIMENSION?.[0]?.name || '',
          material: data.MATERIAL?.[0]?.name || '',
          markingType: defaultMarking,
        }));
      } catch (err) {
        console.error('Fetch options error:', err);
        const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
        const message = isNetworkError
          ? t('wizard_connection_error')
          : t('wizard_init_error');

        setOptionsError(message);
        toast.error(message, {
          action: {
            label: t('retry'),
            onClick: () => window.location.reload(),
          },
        });
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, [t]);

  useEffect(() => {
    return () => {
      if (uploadedLogo?.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedLogo);
      }
    };
  }, [uploadedLogo]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rawDraft = window.sessionStorage.getItem(
      PERSONALIZER_DRAFT_STORAGE_KEY,
    );
    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as PersonalizerDraft;
      if (draft.redirectPath !== loginRedirectPath) {
        return;
      }

      restoredDraftRef.current = draft;
      setStep(draft.step);
      setUploadedLogo(draft.uploadedLogo);
      setDesignFileName(draft.designFileName);
      setDesignFileType(draft.designFileType);
      setLogoScale(draft.logoScale);
      setConfigCode(draft.configCode);
      setCalculatedUnitPrice(draft.calculatedUnitPrice);
      setCalculatedTotalPrice(draft.calculatedTotalPrice);
      setResolvedProductId(draft.resolvedProductId);
      setResolvedVariant(draft.resolvedVariant);
      setSelections((prev) => ({
        ...prev,
        ...draft.selections,
        extraOptions: draft.selections.extraOptions,
        customFile: null,
      }));
      if (draft.requiresDesignReupload) {
        toast.error(
          t('wizard_draft_requires_reupload', {
            defaultValue:
              'Vuelve a cargar tu diseño para terminar la solicitud. Guardamos la configuración, pero no el archivo local.',
          }),
        );
      }
      window.sessionStorage.removeItem(PERSONALIZER_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to restore personalization draft:', error);
      window.sessionStorage.removeItem(PERSONALIZER_DRAFT_STORAGE_KEY);
    }
  }, [loginRedirectPath, t]);

  const persistDraft = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const canInlineDraftDesign = shouldInlineDraftDesign(selections.customFile?.size);
    const requiresDesignReupload = !!selections.customFile && !canInlineDraftDesign;
    const draftPreview = selections.customFile
      ? canInlineDraftDesign
        ? uploadedLogo?.startsWith('data:')
          ? uploadedLogo
          : await fileToDataUrl(selections.customFile)
        : null
      : uploadedLogo;

    const draft: PersonalizerDraft = {
      redirectPath: loginRedirectPath,
      step,
      uploadedLogo: draftPreview,
      designFileName: requiresDesignReupload ? null : designFileName,
      designFileType: requiresDesignReupload ? null : designFileType,
      requiresDesignReupload,
      logoScale,
      configCode,
      calculatedUnitPrice,
      calculatedTotalPrice,
      resolvedProductId,
      resolvedVariant,
      selections: {
        line: selections.line,
        size: selections.size,
        material: selections.material,
        quantity: selections.quantity,
        markingType: selections.markingType,
        extraOptions: selections.extraOptions,
        designUrl: requiresDesignReupload ? '' : selections.designUrl,
      },
    };

    try {
      window.sessionStorage.setItem(
        PERSONALIZER_DRAFT_STORAGE_KEY,
        JSON.stringify(draft),
      );
    } catch (error) {
      console.error('Failed to persist personalization draft with file preview:', error);

      try {
        const fallbackDraft: PersonalizerDraft = {
          ...draft,
          uploadedLogo: null,
          designFileName: null,
          designFileType: null,
          requiresDesignReupload: !!selections.customFile || draft.requiresDesignReupload,
          selections: {
            ...draft.selections,
            designUrl: '',
          },
        };

        window.sessionStorage.setItem(
          PERSONALIZER_DRAFT_STORAGE_KEY,
          JSON.stringify(fallbackDraft),
        );
      } catch (fallbackError) {
        console.error('Failed to persist personalization draft fallback:', fallbackError);
      }
    }
  }, [
    calculatedTotalPrice,
    calculatedUnitPrice,
    configCode,
    designFileName,
    designFileType,
    loginRedirectPath,
    logoScale,
    resolvedProductId,
    resolvedVariant,
    selections,
    step,
    uploadedLogo,
  ]);

  const persistDesignToStorage = useCallback(async (accessToken: string) => {
    if (
      selections.designUrl &&
      !selections.designUrl.startsWith('data:') &&
      !selections.designUrl.startsWith('blob:')
    ) {
      return selections.designUrl;
    }

    let file = selections.customFile;

    if (!file && uploadedLogo?.startsWith('data:')) {
      file = await dataUrlToFile(
        uploadedLogo,
        designFileName || 'diseno-personalizado.png',
        designFileType,
      );
    }

    if (!file) {
      return '';
    }

    const normalizedFileName = ensureDesignFileName(file);
    setIsUploadingLogo(true);

    try {
      const signedUploadResponse = await apiFetch('/personalizations/signed-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fileName: normalizedFileName,
          mimeType: file.type,
          size: file.size,
        }),
      });

      if (!signedUploadResponse.ok) {
        const errorBody = await signedUploadResponse.json().catch(() => ({}));
        const message =
          typeof errorBody.message === 'string'
            ? errorBody.message
            : t('wizard_upload_persist_error');
        throw new Error(message);
      }

      const signedBody = (await signedUploadResponse.json()) as {
        data?: {
          path?: string;
          token?: string;
          publicUrl?: string;
        };
      };
      const uploadPath = signedBody.data?.path;
      const uploadToken = signedBody.data?.token;
      const publicUrl = signedBody.data?.publicUrl;

      if (!uploadPath || !uploadToken || !publicUrl) {
        throw new Error(t('wizard_upload_signed_url_error'));
      }

      const { error: uploadError } = await supabase.storage
        .from('product-assets')
        .uploadToSignedUrl(uploadPath, uploadToken, file);

      if (uploadError) {
        throw uploadError;
      }

      setDesignFileName(normalizedFileName);
      setDesignFileType(file.type || null);
      setSelections((prev) => ({
        ...prev,
        customFile: file,
        designUrl: publicUrl,
      }));

      return publicUrl;
    } finally {
      setIsUploadingLogo(false);
    }
  }, [
    designFileName,
    designFileType,
    selections.customFile,
    selections.designUrl,
    supabase.storage,
    t,
    uploadedLogo,
  ]);

  const fetchPricing = useCallback(async () => {
    if (!selections.size || !selections.material || !wizardOptions || loadingOptions) return;
    if (!resolvedProductId || !resolvedVariant?.id || !selections.line || !selections.size || !selections.material) return;

    setIsPricingLoading(true);
    setPricingError(null);
    try {
      const personalizationOptions: Array<{ code: string; options: string[] }> = [];
      if ((selections.designUrl || uploadedLogo) && selections.markingType) {
        personalizationOptions.push({
          code: selections.markingType,
          options: [selections.markingType]
        });
      }
      selections.extraOptions.forEach((optionCode) => {
        personalizationOptions.push({
          code: optionCode,
          options: [optionCode],
        });
      });

      const res = await apiFetch('/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: resolvedProductId,
          variantId: resolvedVariant.id,
          line: selections.line,
          size: selections.size,
          material: selections.material,
          quantity: Number(selections.quantity),
          personalizations: personalizationOptions
        })
      });

      if (!res.ok) {
        let errMessage = `Pricing error (${res.status})`;
        try {
          const text = await res.text();
          if (text) {
            try {
              const parsed = JSON.parse(text) as {
                message?: string | string[];
                error?: string;
              };
              if (Array.isArray(parsed.message)) {
                errMessage = parsed.message.join(', ');
              } else if (typeof parsed.message === 'string') {
                errMessage = parsed.message;
              } else if (typeof parsed.error === 'string') {
                errMessage = parsed.error;
              }
            } catch {
              errMessage = text;
            }
          } else {
            errMessage = `Error ${res.status}: ${res.statusText}`;
          }
        } catch {
          errMessage = `Error ${res.status}: ${res.statusText}`;
        }
        console.warn('[Pricing Request Failed]', { status: res.status, message: errMessage });
        throw new Error(errMessage);
      }
      const body = await res.json();
      if (body.data) {
        setCalculatedUnitPrice(body.data.unitPrice);
        setCalculatedTotalPrice(body.data.total);
        if (body.data.snapshot) {
          setConfigCode(body.data.snapshot.configCode);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('wizard_price_error');
      setCalculatedUnitPrice(0);
      setCalculatedTotalPrice(0);
      setConfigCode('');
      setPricingError(message);
      console.warn('Pricing fetch failed:', message);
    } finally {
      setIsPricingLoading(false);
    }
  }, [selections, resolvedProductId, resolvedVariant?.id, wizardOptions, uploadedLogo, loadingOptions, t]);

  useEffect(() => {
    if (step >= 1 && wizardOptions) fetchPricing();
  }, [fetchPricing, step, selections.quantity, wizardOptions]);

  useEffect(() => {
    if (!wizardOptions) return;

    const validTechniqueOptions = wizardOptions.TECHNIQUE.filter(
      (option) =>
        !isOtherTechniqueOption(option) &&
        (!option.allowedMaterialValues ||
          option.allowedMaterialValues.length === 0 ||
          option.allowedMaterialValues.includes(selections.material)),
    );

    const validOtherOptionCodes = wizardOptions.TECHNIQUE.filter(
      (option) =>
        isOtherTechniqueOption(option) &&
        (!option.allowedMaterialValues ||
          option.allowedMaterialValues.length === 0 ||
          option.allowedMaterialValues.includes(selections.material)),
    ).map((option) => option.code);

    setSelections((prev) => {
      const nextExtraOptions = prev.extraOptions.filter((code) =>
        validOtherOptionCodes.includes(code),
      );
      const nextMarkingType = validTechniqueOptions.some(
        (option) => option.code === prev.markingType,
      )
        ? prev.markingType
        : (validTechniqueOptions[0]?.code || '');

      if (
        nextMarkingType === prev.markingType &&
        nextExtraOptions.length === prev.extraOptions.length
      ) {
        return prev;
      }

      return {
        ...prev,
        markingType: nextMarkingType,
        extraOptions: nextExtraOptions,
      };
    });
  }, [wizardOptions, selections.material]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const normalizedFileName = ensureDesignFileName(file);

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('wizard_file_too_large'));
      e.target.value = '';
      return;
    }

    try {
      const previewUrl = await fileToDataUrl(file);
      setUploadedLogo(previewUrl);
      setDesignFileName(normalizedFileName);
      setDesignFileType(file.type || null);
      setSelections(prev => ({ ...prev, customFile: file, designUrl: '' }));
      toast.success(t('wizard_design_uploaded'));
    } catch (error) {
      console.error('Custom design preparation error:', error);
      setSelections(prev => ({ ...prev, customFile: null, designUrl: '' }));
      setUploadedLogo(null);
      setDesignFileName(null);
      setDesignFileType(null);
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('wizard_upload_retry_error');
      toast.error(message);
    } finally {
      e.target.value = '';
    }
  };

  const techniqueOptions = wizardOptions?.TECHNIQUE || [];
  const availableTechniqueOptions = getCompatibleTechniqueOptions(
    techniqueOptions,
    selections.material,
  );
  const availableOtherOptions = getCompatibleOtherOptions(
    techniqueOptions,
    selections.material,
  );
  const hasCompatibleTechniqueOptions = availableTechniqueOptions.length > 0;
  const hasPreparedDesign =
    !!selections.customFile || !!uploadedLogo?.startsWith('data:');
  const techniqueActionBlocked = isTechniqueActionBlocked({
    hasCompatibleTechniqueOptions,
    hasUploadedLogo: !!uploadedLogo,
    hasDesignUrl: !!selections.designUrl,
    hasPreparedDesign,
    hasConfigCode: !!configCode,
    isUploadingLogo,
    isPricingLoading,
  });

  const nextStep = () => {
    if (step === 4 && techniqueActionBlocked) {
      if (!hasCompatibleTechniqueOptions) {
        toast.error(t('wizard_not_compatible', { material: getTranslatedMaterialName(selections.material) }));
      }
      return;
    }

    setStep(prev => (prev < 5 ? (prev + 1) as Step : prev));
  };
  const prevStep = () => setStep(prev => (prev > 1 ? (prev - 1) as Step : prev));

  const handleFinish = async () => {
    if (!wizardOptions) {
      toast.error(t('wizard_unavailable'));
      return;
    }

    if (!resolvedProductId || !resolvedVariant?.id || !configCode || calculatedUnitPrice <= 0) {
      toast.error(t('wizard_confirm_error'));
      return;
    }

    if (!selections.line || !selections.size || !selections.material) {
      toast.error(t('wizard_complete_configuration'));
      return;
    }

    if (!hasCompatibleTechniqueOptions) {
      toast.error(t('wizard_not_compatible', { material: getTranslatedMaterialName(selections.material) }));
      return;
    }

    if (isUploadingLogo) {
      toast.error(t('wizard_image_uploading_wait'));
      return;
    }

    const selectedPersonalizations = [
      ...((selections.designUrl || uploadedLogo) && selections.markingType
        ? [{ code: selections.markingType, options: [selections.markingType] }]
        : []),
      ...selections.extraOptions.map((optionCode) => ({
        code: optionCode,
        options: [optionCode],
      })),
    ];

    setIsSubmittingRequest(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        await persistDraft();
        router.push(`/login?redirect=${encodeURIComponent(loginRedirectPath)}`);
        return;
      }

      const persistedDesignUrl = uploadedLogo
        ? await persistDesignToStorage(session.access_token)
        : '';

      if (uploadedLogo && !persistedDesignUrl) {
        toast.error(t('wizard_image_not_available'));
        return;
      }

      const response = await apiFetch('/personalizations/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: resolvedProductId,
          variantId: resolvedVariant.id,
          line: selections.line,
          size: selections.size,
          material: selections.material,
          quantity: Number(selections.quantity),
          customImageURL: persistedDesignUrl || undefined,
          personalizations: selectedPersonalizations,
        }),
      });

      if (response.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(loginRedirectPath)}`);
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const detail =
          typeof errorBody.message === 'string'
            ? errorBody.message
            : Array.isArray(errorBody.message)
              ? errorBody.message.join(', ')
            : t('wizard_request_register_error');
        throw new Error(detail);
      }

      const body = await response.json();
      const requestId =
        body?.data?.id && typeof body.data.id === 'string' ? body.data.id : null;

      setSubmittedRequestId(requestId);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(PERSONALIZER_DRAFT_STORAGE_KEY);
      }
      toast.success(t('wizard_request_sent_success'));
    } catch (error) {
      console.error('Personalization request error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : t('wizard_request_send_error'),
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (submittedRequestId) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] flex flex-col items-center justify-center py-24 px-8 gap-5 shadow-xl text-center">
        <Check className="w-10 h-10 text-primary" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">
          {t('wizard_request_sent_badge')}
        </p>
        <h2 className="text-3xl font-serif text-primary">
          {t('wizard_request_sent_title')}
        </h2>
        <p className="text-sm text-muted max-w-2xl">
          {t('wizard_request_sent_description', { configCode })}
          {submittedRequestId ? ` ${t('wizard_request_sent_id', { requestId: submittedRequestId })}` : ''}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.push('/profile')}
            className="px-6 py-3 bg-primary text-base-color rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            {t('wizard_go_profile')}
          </button>
          <button
            onClick={() => router.push('/catalog')}
            className="px-6 py-3 border border-theme text-primary rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            {t('wizard_continue_browsing')}
          </button>
        </div>
      </div>
    );
  }

  if (loadingOptions) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] flex flex-col items-center justify-center py-40 gap-4 shadow-xl">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted">{t('wizard_loading_experience')}</p>
      </div>
    );
  }

  if (optionsError || !wizardOptions) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] flex flex-col items-center justify-center py-24 px-8 gap-5 shadow-xl text-center">
        <AlertCircle className="w-10 h-10 text-accent" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">
          {t('wizard_unavailable_title')}
        </p>
        <p className="text-sm text-muted max-w-md">
          {optionsError || t('wizard_load_options_error')}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-primary text-base-color rounded-xl text-[10px] font-black uppercase tracking-widest"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  const noPersonalizationOptionsAvailable =
    availableTechniqueOptions.length === 0 && availableOtherOptions.length === 0;
  const estimatedPriceLabel =
    selections.quantity > 1 ? t('estimated_total') : t('estimated_price');
  const commercialVariants = getActiveCommercialVariants(resolvedProduct);
  const sizeChoices = wizardOptions.DIMENSION.map((option) => ({
    id: option.id,
    name: option.name,
    visualLabel: getDimensionVisualLabel(option),
  }));
  const selectedBaseLine = wizardOptions.LINE.find(
    (line) => line.code === selections.line,
  );
  const selectedBaseMaterial = wizardOptions.MATERIAL.find(
    (material) => material.name === selections.material,
  );
  const selectedBaseSize = sizeChoices.find(
    (sizeChoice) => sizeChoice.name === selections.size,
  );
  const baseConfigurationSummary = [
    {
      label: t('wizard_line_short'),
      value: getCompactLineName(selectedBaseLine) || t('wizard_pending'),
    },
    {
      label: t('filters_material'),
      value: getTranslatedMaterialName(selectedBaseMaterial?.name) || t('wizard_pending'),
    },
    {
      label: t('wizard_size_short'),
      value: getTranslatedSizeName(selectedBaseSize?.name || selections.size)
        || selectedBaseSize?.visualLabel
        || t('wizard_pending'),
    },
    {
      label: t('wizard_quantity'),
      value: `${selections.quantity} ${selections.quantity === 1 ? t('wizard_unit_singular') : t('wizard_unit_plural')}`,
    },
  ];

  if (isDirectMode) {
    return (
      <div className="w-full max-w-6xl mx-auto bg-surface border border-theme rounded-[2.5rem] overflow-hidden shadow-2xl">
        <main className="p-8 md:p-12 space-y-8">
            <section className="space-y-6 rounded-[2rem] border border-theme bg-base/40 p-6 md:p-8">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
                <div className="space-y-4">
                  <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                    {t('wizard_base_configuration')}
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-primary">
                      {t('wizard_base_panel_title')}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm text-muted">
                      {t('wizard_base_panel_description')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-theme bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                      {getTranslatedLineName(selectedBaseLine) || t('wizard_line_pending')}
                    </span>
                    <span className="rounded-full border border-theme bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                      {getTranslatedMaterialName(selectedBaseMaterial?.name) || t('wizard_material_pending')}
                    </span>
                    <span className="rounded-full border border-theme bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                      {getTranslatedSizeName(selectedBaseSize?.name || selections.size)
                        || selectedBaseSize?.visualLabel
                        || t('wizard_size_pending')}
                    </span>
                    <span className="rounded-full border border-theme bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                      {selections.quantity} {selections.quantity === 1 ? t('wizard_unit_singular') : t('wizard_unit_plural')}
                    </span>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-primary/10 bg-white/90 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                    {t('wizard_active_summary')}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    {baseConfigurationSummary.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-theme bg-base/40 px-4 py-3"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-bold text-primary">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-5 rounded-[1.75rem] border border-theme bg-white/75 p-5 md:p-6">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                      {t('wizard_product_identity')}
                    </h4>
                    <p className="text-sm text-muted">
                      {t('wizard_product_identity_description')}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {t('wizard_line_short')}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t('wizard_line_description')}
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {wizardOptions.LINE.map((line) => {
                        const Icon = getLineIcon(line.code);
                        const isSelected = selections.line === line.code;

                        return (
                          <button
                            key={line.id}
                            onClick={() =>
                              setSelections((prev) => ({ ...prev, line: line.code }))
                            }
                            className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-theme hover:border-primary/30'
                            }`}
                          >
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                isSelected
                                  ? 'bg-primary text-white'
                                  : 'bg-base text-primary'
                              }`}
                            >
                              <Icon size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black uppercase tracking-wide text-primary">
                                {getCompactLineName(line)}
                              </p>
                              <p className="mt-1 text-[11px] text-muted">
                                {getTranslatedLineDescription(line)}
                              </p>
                            </div>
                            {isSelected && <Check className="shrink-0 text-primary" size={16} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {t('filters_material')}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t('wizard_material_description')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {wizardOptions.MATERIAL.map((mat) => (
                        <button
                          key={mat.id}
                          onClick={() =>
                            setSelections((prev) => ({
                              ...prev,
                              material: mat.name,
                            }))
                          }
                          className={`rounded-full border-2 px-4 py-2 text-[10px] font-black uppercase tracking-wide transition-all ${
                            selections.material === mat.name
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : 'border-theme text-muted hover:border-primary/30'
                          }`}
                        >
                          {getTranslatedMaterialName(mat.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-[1.75rem] border border-theme bg-white/75 p-5 md:p-6">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                      {t('wizard_measurements_volume')}
                    </h4>
                    <p className="text-sm text-muted">
                      {t('wizard_measurements_volume_description')}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {t('wizard_size_short')}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t('wizard_size_description')}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {sizeChoices.map((dim) => (
                        <button
                          key={dim.id}
                          onClick={() => {
                            const matchedVariant = commercialVariants.length > 0
                              ? resolveVariantBySize(
                                  resolvedProduct,
                                  dim.name,
                                  resolvedVariant?.id,
                                )
                              : null;

                            setSelections((prev) => ({ ...prev, size: dim.name }));

                            if (matchedVariant?.id) {
                              setResolvedVariant({
                                id: matchedVariant.id,
                                sku: matchedVariant.sku,
                                size: matchedVariant.size || '',
                                color: matchedVariant.color || 'Base',
                                imageUrl: matchedVariant.imageUrl || '',
                                stock: matchedVariant.stock || 0,
                              });
                            }
                          }}
                          className={`rounded-2xl border-2 p-4 text-center transition-all ${
                            selections.size === dim.name
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-theme hover:border-primary/30'
                          }`}
                        >
                          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                            {dim.visualLabel}
                          </span>
                          <span className="mt-2 block text-xs font-bold text-primary">
                            {getTranslatedSizeName(dim.name)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-theme bg-base/40 p-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {t('wizard_quantity')}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t('wizard_quantity_description')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-3 rounded-2xl border border-theme bg-white px-3 py-2">
                        <button
                          onClick={() =>
                            setSelections((prev) => ({
                              ...prev,
                              quantity: Math.max(1, prev.quantity - 1),
                            }))
                          }
                          className="p-1 text-primary transition-colors hover:opacity-70"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="min-w-10 text-center text-sm font-black text-primary">
                          {selections.quantity}
                        </span>
                        <button
                          onClick={() =>
                            setSelections((prev) => ({
                              ...prev,
                              quantity: prev.quantity + 1,
                            }))
                          }
                          className="p-1 text-primary transition-colors hover:opacity-70"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <p className="text-xs text-muted">
                        {t('wizard_quantity_estimate_note')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">
                      {t('wizard_upload_design')}
                    </h4>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-4 border-2 border-dashed border-theme rounded-2xl flex items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <Upload
                        size={20}
                        className="text-muted group-hover:text-primary"
                      />
                      <span className="text-sm font-bold text-primary">
                        {t('wizard_upload_image')}
                      </span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </button>
                    {isUploadingLogo && (
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                        <Loader2 size={14} className="animate-spin" />
                        {t('wizard_image_persisting')}
                      </div>
                    )}
                    {uploadedLogo && (
                      <div className="mt-4 p-4 bg-base/50 rounded-2xl border border-theme animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary">
                            {t('wizard_design_size')}
                          </label>
                          <span className="text-[10px] font-bold text-muted">
                            {logoScale}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={logoScale}
                          onChange={(e) => setLogoScale(Number(e.target.value))}
                          className="w-full h-1.5 bg-theme rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted uppercase text-center">
                      {t('wizard_recommended_background')}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">
                      {t('wizard_marking_technique')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {availableTechniqueOptions.map((technique) => (
                        <button
                          key={technique.code}
                          onClick={() =>
                            setSelections((prev) => ({
                              ...prev,
                              markingType: technique.code,
                            }))
                          }
                          className={`py-3 rounded-xl border-2 font-bold text-[10px] transition-all uppercase tracking-tighter ${
                            selections.markingType === technique.code
                              ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                              : 'border-theme text-muted hover:border-primary/30'
                          }`}
                        >
                          {getCompactTechniqueName(technique)}
                        </button>
                      ))}
                      {availableTechniqueOptions.length === 0 && (
                        <div className="col-span-2 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                          <AlertCircle
                            className="text-red-500 shrink-0"
                            size={16}
                          />
                          <p className="text-[10px] font-medium text-red-700">
                            {t('wizard_not_compatible', {
                              material: getTranslatedMaterialName(selections.material),
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">
                      {t('wizard_other_options')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {availableOtherOptions.map((option) => {
                        const isSelected = selections.extraOptions.includes(
                          option.code,
                        );

                        return (
                          <button
                            key={option.code}
                            onClick={() =>
                              setSelections((prev) => ({
                                ...prev,
                                extraOptions: prev.extraOptions.includes(
                                  option.code,
                                )
                                  ? prev.extraOptions.filter(
                                      (code) => code !== option.code,
                                    )
                                  : [...prev.extraOptions, option.code],
                              }))
                            }
                            className={`py-3 rounded-xl border-2 font-bold text-[10px] transition-all uppercase tracking-tighter ${
                              isSelected
                                ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                                : 'border-theme text-muted hover:border-primary/30'
                          }`}
                        >
                          {getTranslatedTechniqueName(option)}
                        </button>
                      );
                      })}
                      {availableOtherOptions.length === 0 &&
                        !noPersonalizationOptionsAvailable && (
                          <div className="col-span-2 p-4 bg-base/50 border border-theme rounded-2xl">
                            <p className="text-[10px] font-medium text-muted">
                              {t('wizard_other_options_empty')}
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-full max-w-sm aspect-[4/6] bg-gray-100 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
                    {(() => {
                      const selectedMaterial = wizardOptions.MATERIAL.find(
                        (material) => material.name === selections.material,
                      );
                      const canvasImage =
                        selectedMaterial?.imageUrl || '/placeholder.svg';

                      return (
                        <Image
                          src={canvasImage}
                          alt={t('wizard_mockup_alt')}
                          fill
                          sizes="(max-width: 1024px) 100vw, 384px"
                          className="object-cover transition-opacity duration-500"
                        />
                      );
                    })()}

                    <div className="absolute top-[44%] left-[28%] w-[45%] h-[35%] border-2 border-dashed border-gray-400/50 rounded-lg flex items-center justify-center z-10 overflow-hidden">
                      {uploadedLogo ? (
                        <div className="relative w-full h-full flex items-center justify-center p-2">
                          <Image
                            src={uploadedLogo}
                            alt={t('wizard_logo_preview_alt')}
                            width={200}
                            height={200}
                            style={{
                              width: `${logoScale}%`,
                              height: 'auto',
                              objectFit: 'contain',
                            }}
                            className="animate-in zoom-in-50 duration-300 transition-all"
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center px-4">
                          {t('wizard_print_area')}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-muted font-black uppercase tracking-widest">
                    {t('wizard_interactive_preview')}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-primary/15 bg-primary/[0.03] p-6 md:p-8">
              <div className="mx-auto w-full max-w-3xl space-y-5">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary">
                    {t('wizard_estimated_prices')}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    {t('wizard_estimated_prices_description')}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-theme bg-surface px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                      {t('wizard_estimated_price_large_label')}
                    </p>
                    <p className="mt-2 text-lg font-bold text-primary">
                      {t('wizard_estimated_price_large_value')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-theme bg-surface px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                      {t('wizard_estimated_price_small_label')}
                    </p>
                    <p className="mt-2 text-lg font-bold text-primary">
                      {t('wizard_estimated_price_small_value')}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-white px-5 py-4">
                  <p className="text-sm font-semibold text-primary">
                    {t('wizard_estimated_price_note')}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex pt-8 border-t border-theme bg-surface sticky bottom-0 left-0 right-0 md:relative z-20 pb-4 md:pb-0">
              <button
                onClick={handleFinish}
                disabled={
                  isSubmittingRequest ||
                  !resolvedProductId ||
                  !resolvedVariant?.id ||
                  !selections.line ||
                  !selections.size ||
                  !selections.material ||
                  techniqueActionBlocked
                }
                className="flex-1 px-8 py-4 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20 disabled:opacity-50"
              >
                {isSubmittingRequest ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('wizard_submitting_request')}
                  </>
                ) : (
                  <>
                    {t('wizard_submit_review')} <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
        </main>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-surface border border-theme rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[600px]">
      <aside className="w-full md:w-1/3 bg-primary p-8 text-base-color flex flex-col justify-between">
        <div>
          <div className="mb-10">
            <h2 className="text-2xl font-serif font-bold">{t('customization')}</h2>
            <p className="text-base-color/60 text-sm">{t('step')} {step} {t('of')} 5</p>
          </div>

          <nav className="space-y-6">
            {[
              { s: 1, label: t('production_line') },
              { s: 2, label: t('dimensions') },
              { s: 3, label: t('product_material') },
              { s: 4, label: t('customization') },
              { s: 5, label: t('final_summary') }
            ].map(item => (
              <div key={item.s} className={`flex items-center gap-4 transition-all ${step === item.s ? 'opacity-100 translate-x-2' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black ${step === item.s ? 'bg-accent border-accent' : 'border-base-color'}`}>
                  {step > item.s ? <Check size={14} /> : item.s}
                </div>
                <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 p-6 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
          <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">{estimatedPriceLabel}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${calculatedTotalPrice.toLocaleString('es-CO')}</span>
            <span className="text-[10px] opacity-60">{t('wizard_currency_unit')}</span>
          </div>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-base-color/70">
            {t('tax_included')}
          </p>
          {selections.quantity > 1 && (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-base-color/70">
              ${calculatedUnitPrice.toLocaleString('es-CO')} {t('wizard_unit_each')}
            </p>
          )}
          {pricingError && (
            <p className="mt-3 text-[10px] font-bold text-amber-100">
              {pricingError}
            </p>
          )}
          {isPricingLoading && <Loader2 size={12} className="animate-spin mt-2" />}
        </div>
      </aside>

      <main className="flex-1 p-8 md:p-12 flex flex-col">
        <div className="flex-grow">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h3 className="text-2xl font-serif text-primary mb-2">{t('wizard_step_1_title')}</h3>
                <p className="text-muted text-sm">{t('wizard_step_1_description')}</p>
              </div>
              <div className="grid gap-4">
                {wizardOptions?.LINE.map(line => {
                  const Icon = getLineIcon(line.code);
                  return (
                    <button
                      key={line.id}
                      onClick={() => setSelections(prev => ({ ...prev, line: line.code }))}
                      className={`flex items-center gap-6 p-6 rounded-2xl border-2 transition-all text-left group ${selections.line === line.code ? 'border-primary bg-primary/5' : 'border-theme hover:border-primary/30'}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selections.line === line.code ? 'bg-primary text-white' : 'bg-base text-primary group-hover:bg-primary/10'}`}>
                        <Icon size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-primary">{getTranslatedLineName(line)}</h4>
                        <p className="text-xs text-muted">{getTranslatedLineDescription(line)}</p>
                      </div>
                      {selections.line === line.code && <Check className="ml-auto text-primary" size={20} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h3 className="text-2xl font-serif text-primary mb-2">{t('wizard_step_2_title')}</h3>
                <p className="text-muted text-sm">{t('wizard_step_2_description')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {sizeChoices.map(dim => (
                  <button
                    key={dim.id}
                    onClick={() => {
                      const matchedVariant = commercialVariants.length > 0
                        ? resolveVariantBySize(resolvedProduct, dim.name, resolvedVariant?.id)
                        : null;

                      setSelections(prev => ({ ...prev, size: dim.name }));

                      if (matchedVariant?.id) {
                        setResolvedVariant({
                          id: matchedVariant.id,
                          sku: matchedVariant.sku,
                          size: matchedVariant.size || '',
                          color: matchedVariant.color || 'Base',
                          imageUrl: matchedVariant.imageUrl || '',
                          stock: matchedVariant.stock || 0,
                        });
                      }
                    }}
                    className={`p-8 rounded-3xl border-2 flex flex-col items-center justify-center gap-4 transition-all ${selections.size === dim.name ? 'border-primary bg-primary/5' : 'border-theme hover:border-primary/30'}`}
                  >
                    <div className="relative flex items-center justify-center">
                      <div
                        className={`w-16 h-20 border-2 rounded-lg transition-all ${selections.size === dim.name ? 'border-primary bg-primary/20' : 'border-muted opacity-30'}`}
                        style={{ transform: `scale(${dim.name.toLowerCase().includes('peque') ? 0.75 : dim.name.toLowerCase().includes('grand') ? 1.2 : 1})` }}
                      />
                      <span className="absolute text-[9px] font-black uppercase tracking-[0.14em] text-primary">
                        {dim.visualLabel}
                      </span>
                    </div>
                    <span className="font-black uppercase tracking-widest text-[10px]">{getTranslatedSizeName(dim.name)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="space-y-4">
                <h3 className="text-2xl font-serif text-primary mb-2">{t('wizard_step_3_title')}</h3>
                <p className="text-muted text-sm">{t('wizard_step_3_description')}</p>
                <div className="flex flex-wrap gap-3 mt-6">
                  {wizardOptions?.MATERIAL.map(mat => (
                    <button
                      key={mat.id}
                      onClick={() => setSelections(prev => ({ ...prev, material: mat.name }))}
                      className={`px-6 py-3 rounded-full border-2 font-bold text-xs transition-all ${selections.material === mat.name ? 'bg-primary border-primary text-white' : 'border-theme text-muted'}`}
                    >
                      {getTranslatedMaterialName(mat.name)}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-serif text-primary mb-2">{t('wizard_step_4_title')}</h3>
                    <p className="text-muted text-sm">{t('wizard_step_4_description')}</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">{t('wizard_upload_design')}</h4>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-4 border-2 border-dashed border-theme rounded-2xl flex items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <Upload size={20} className="text-muted group-hover:text-primary" />
                      <span className="text-sm font-bold text-primary">{t('wizard_upload_image')}</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </button>
                    {isUploadingLogo && (
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                        <Loader2 size={14} className="animate-spin" />
                        {t('wizard_image_persisting')}
                      </div>
                    )}
                    {uploadedLogo && (
                      <div className="mt-4 p-4 bg-base/50 rounded-2xl border border-theme animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary">{t('wizard_design_size')}</label>
                          <span className="text-[10px] font-bold text-muted">{logoScale}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={logoScale}
                          onChange={(e) => setLogoScale(Number(e.target.value))}
                          className="w-full h-1.5 bg-theme rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted uppercase text-center">{t('wizard_recommended_background')}</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">{t('wizard_marking_technique')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {availableTechniqueOptions.map((technique) => (
                        <button
                          key={technique.code}
                          onClick={() => setSelections(prev => ({ ...prev, markingType: technique.code }))}
                          className={`py-3 rounded-xl border-2 font-bold text-[10px] transition-all uppercase tracking-tighter ${selections.markingType === technique.code ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20' : 'border-theme text-muted hover:border-primary/30'}`}
                        >
                          {getCompactTechniqueName(technique)}
                        </button>
                      ))}
                      {availableTechniqueOptions.length === 0 && (
                        <div className="col-span-2 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                          <AlertCircle className="text-red-500 shrink-0" size={16} />
                          <p className="text-[10px] font-medium text-red-700">
                            {t('wizard_not_compatible', { material: getTranslatedMaterialName(selections.material) })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">{t('wizard_other_options')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {availableOtherOptions.map(option => {
                        const isSelected = selections.extraOptions.includes(option.code);
                        return (
                          <button
                            key={option.code}
                            onClick={() =>
                              setSelections((prev) => ({
                                ...prev,
                                extraOptions: prev.extraOptions.includes(option.code)
                                  ? prev.extraOptions.filter((code) => code !== option.code)
                                  : [...prev.extraOptions, option.code],
                              }))
                            }
                            className={`py-3 rounded-xl border-2 font-bold text-[10px] transition-all uppercase tracking-tighter ${isSelected ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20' : 'border-theme text-muted hover:border-primary/30'}`}
                          >
                            {getTranslatedTechniqueName(option)}
                          </button>
                        );
                      })}
                      {availableOtherOptions.length === 0 && !noPersonalizationOptionsAvailable && (
                        <div className="col-span-2 p-4 bg-base/50 border border-theme rounded-2xl">
                          <p className="text-[10px] font-medium text-muted">
                            {t('wizard_other_options_empty')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-full max-w-sm aspect-[4/6] bg-gray-100 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
                    {(() => {
                      const selectedMaterial = wizardOptions?.MATERIAL.find(m => m.name === selections.material);
                      const canvasImage = selectedMaterial?.imageUrl || '/placeholder.svg';

                      return (
                        <Image
                          src={canvasImage}
                          alt={t('wizard_mockup_alt')}
                          fill
                          sizes="(max-width: 1024px) 100vw, 384px"
                          className="object-cover transition-opacity duration-500"
                        />
                      );
                    })()}

                    <div className="absolute top-[44%] left-[28%] w-[45%] h-[35%] border-2 border-dashed border-gray-400/50 rounded-lg flex items-center justify-center z-10 overflow-hidden">
                      {uploadedLogo ? (
                        <div className="relative w-full h-full flex items-center justify-center p-2">
                          <Image
                            src={uploadedLogo}
                            alt={t('wizard_logo_preview_alt')}
                            width={200}
                            height={200}
                            style={{ width: `${logoScale}%`, height: 'auto', objectFit: 'contain' }}
                            className="animate-in zoom-in-50 duration-300 transition-all"
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center px-4">{t('wizard_print_area')}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-muted font-black uppercase tracking-widest">{t('wizard_interactive_preview')}</p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div>
                <h3 className="text-3xl font-serif text-primary mb-2">{t('wizard_ready_title')}</h3>
                <p className="text-muted text-sm">{t('wizard_ready_description')}</p>
              </div>

              <div className="bg-base/50 rounded-3xl p-8 border border-theme space-y-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">{t('production_line')}</p><p className="font-bold text-primary">{getTranslatedLineName(selectedBaseLine) || selections.line}</p></div>
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">{t('dimensions')}</p><p className="font-bold text-primary">{getTranslatedSizeName(selections.size)}</p></div>
                  <div><p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">{t('product_material')}</p><p className="font-bold text-primary">{getTranslatedMaterialName(selections.material)}</p></div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted tracking-[0.2em] mb-1">{t('customization')}</p>
                    <p className="font-bold text-primary">
                      {[
                        getTranslatedTechniqueName(
                          wizardOptions?.TECHNIQUE.find((technique) => technique.code === selections.markingType) || null,
                        ),
                        ...selections.extraOptions.map((optionCode) =>
                          getTranslatedTechniqueName(
                            wizardOptions?.TECHNIQUE.find((technique) => technique.code === optionCode) || {
                              code: optionCode,
                              name: optionCode,
                            },
                          ) || optionCode,
                        ),
                      ]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-theme flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="text-secondary" size={20} />
                    <div className="text-[10px] font-bold text-muted">
                      {t('wizard_estimated_delivery')} <br />
                      <span className="text-primary uppercase">{t('wizard_estimated_delivery_time')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-muted mb-1">{t('wizard_quantity')}</p>
                    <div className="flex items-center gap-3 bg-white border border-theme rounded-xl px-3 py-1">
                      <button onClick={() => setSelections(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))} className="p-1 hover:text-primary transition-colors"><ChevronLeft size={14} /></button>
                      <span className="font-black text-xs">{selections.quantity}</span>
                      <button onClick={() => setSelections(p => ({ ...p, quantity: p.quantity + 1 }))} className="p-1 hover:text-primary transition-colors"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        <div className="mt-auto flex gap-4 pt-8 border-t border-theme bg-surface sticky bottom-0 left-0 right-0 md:relative z-20 pb-4 md:pb-0">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="px-6 md:px-8 py-4 border-2 border-theme rounded-2xl text-primary font-black uppercase tracking-widest text-[10px] hover:bg-base transition-all flex items-center gap-2 bg-white"
            >
              <ChevronLeft size={16} /> <span className="hidden md:inline">{t('back')}</span>
            </button>
          )}
          {step < 5 ? (
            <button
              onClick={nextStep}
              disabled={
                !wizardOptions ||
                !resolvedProductId ||
                 !resolvedVariant?.id ||
                (step === 1 && !selections.line) ||
                (step === 2 && !selections.size) ||
                (step === 3 && !selections.material) ||
                (step === 4 &&
                  techniqueActionBlocked)
              }
              className="flex-1 px-8 py-4 bg-primary text-base-color rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              {t('continue')} <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSubmittingRequest}
              className="flex-1 px-8 py-4 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20 disabled:opacity-50"
            >
              {isSubmittingRequest ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t('wizard_submitting_request')}
                </>
              ) : (
                <>
                  {t('wizard_submit_review')} <ChevronRight size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
