'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import Image from 'next/image';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Download,
  FileArchive,
  FileText,
  Filter,
  Loader2,
  Pencil,
  ImagePlus,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import {
  createKnowledgePost,
  deleteKnowledgePost,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_PRIORITIES,
  KNOWLEDGE_STATUSES,
  listKnowledgePosts,
  type KnowledgeAttachment,
  type KnowledgeCategory,
  type KnowledgePost,
  type KnowledgePostPayload,
  type KnowledgePriority,
  type KnowledgeStatus,
  uploadKnowledgePostAttachment,
  uploadKnowledgePostImage,
  updateKnowledgePost,
} from '@/lib/knowledge-posts';

type KnowledgeFormState = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  imageUrls: string[];
  attachments: KnowledgeAttachment[];
  category: KnowledgeCategory;
  status: KnowledgeStatus;
  priority: KnowledgePriority;
  tagsInput: string;
  publishedAt: string;
};

const PAGE_SIZE = 9;

const INITIAL_FORM_STATE: KnowledgeFormState = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  imageUrls: [],
  attachments: [],
  category: 'GENERAL',
  status: 'BORRADOR',
  priority: 'MEDIA',
  tagsInput: '',
  publishedAt: '',
};

const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  GENERAL: 'General',
  VENTAS: 'Ventas',
  NOTICIAS: 'Noticias',
  OPERACION: 'Operacion',
  FINANZAS: 'Finanzas',
  ESTRATEGIA: 'Estrategia',
};

const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  BORRADOR: 'Borrador',
  PUBLICADO: 'Publicado',
  ARCHIVADO: 'Archivado',
};

const PRIORITY_LABELS: Record<KnowledgePriority, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Critica',
};

function formatKnowledgeDate(value: string | null | undefined) {
  if (!value) {
    return 'Pendiente';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toDatetimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function parseTags(tagsInput: string) {
  return Array.from(
    new Set(
      tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function formatFileSize(size?: number) {
  if (typeof size !== 'number' || Number.isNaN(size) || size <= 0) {
    return 'Tamano no disponible';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getPriorityClasses(priority: KnowledgePriority) {
  if (priority === 'CRITICA') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (priority === 'ALTA') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (priority === 'MEDIA') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  return 'border-zinc-200 bg-base text-muted';
}

function getStatusClasses(status: KnowledgeStatus) {
  if (status === 'PUBLICADO') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'ARCHIVADO') {
    return 'border-zinc-200 bg-zinc-100 text-zinc-700';
  }

  return 'border-primary/20 bg-primary/10 text-primary';
}

function mapPostToForm(post: KnowledgePost): KnowledgeFormState {
  return {
    title: post.title,
    slug: post.slug,
    summary: post.summary ?? '',
    content: post.content,
    imageUrls: post.imageUrls,
    attachments: post.attachments ?? [],
    category: post.category,
    status: post.status,
    priority: post.priority,
    tagsInput: post.tags.join(', '),
    publishedAt: toDatetimeLocalValue(post.publishedAt),
  };
}

function buildPayload(formState: KnowledgeFormState): KnowledgePostPayload {
  return {
    title: formState.title.trim(),
    slug: formState.slug.trim() || undefined,
    summary: formState.summary.trim() || undefined,
    content: formState.content.trim(),
    imageUrls: formState.imageUrls,
    attachments: formState.attachments,
    category: formState.category,
    status: formState.status,
    priority: formState.priority,
    tags: parseTags(formState.tagsInput),
    publishedAt: formState.publishedAt
      ? new Date(formState.publishedAt).toISOString()
      : null,
  };
}

export default function BusinessKnowledgeManager() {
  const [posts, setPosts] = useState<KnowledgePost[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [categoryFilter, setCategoryFilter] = useState<KnowledgeCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<KnowledgeStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<KnowledgePriority | ''>('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [formState, setFormState] = useState<KnowledgeFormState>(INITIAL_FORM_STATE);
  const [editingPost, setEditingPost] = useState<KnowledgePost | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPost, setSelectedPost] = useState<KnowledgePost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgePost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const { role, accessToken } = useDashboardAuth();
  const supabase = createClient();
  const canManage = role === 'ADMIN';

  const activeFiltersLabel = useMemo(() => {
    const parts = [
      categoryFilter ? CATEGORY_LABELS[categoryFilter] : null,
      statusFilter ? STATUS_LABELS[statusFilter] : null,
      priorityFilter ? PRIORITY_LABELS[priorityFilter] : null,
    ].filter(Boolean);

    return parts.join(' / ');
  }, [categoryFilter, priorityFilter, statusFilter]);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? accessToken;
  }, [accessToken, supabase.auth]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setPosts([]);
        setTotalItems(0);
        setTotalPages(1);
        setError('Tu sesion no tiene acceso al dashboard.');
        return;
      }

      const response = await listKnowledgePosts(token, {
        search: deferredSearch,
        category: categoryFilter,
        status: statusFilter,
        priority: priorityFilter,
        page,
        limit: PAGE_SIZE,
      });

      setPosts(response.items);
      setTotalItems(response.total);
      setTotalPages(response.totalPages);
    } catch (loadError) {
      console.error('Knowledge posts fetch failed:', loadError);
      setPosts([]);
      setTotalItems(0);
      setTotalPages(1);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar el centro informativo.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    categoryFilter,
    deferredSearch,
    getAccessToken,
    page,
    priorityFilter,
    statusFilter,
  ]);

  useEffect(() => {
    void loadPosts();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.access_token && !accessToken) {
          setPosts([]);
          setLoading(false);
          return;
        }

        void loadPosts();
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [accessToken, loadPosts, supabase.auth]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, categoryFilter, priorityFilter, statusFilter]);

  useEffect(() => {
    if (page <= totalPages) {
      return;
    }

    setPage(Math.max(1, totalPages));
  }, [page, totalPages]);

  useEffect(() => {
    if (!(showFormModal || selectedPost || deleteTarget)) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [deleteTarget, selectedPost, showFormModal]);

  const closeFormModal = () => {
    if (submitting) {
      return;
    }

    setShowFormModal(false);
    setEditingPost(null);
    setFormState(INITIAL_FORM_STATE);
  };

  const forceCloseFormModal = () => {
    setShowFormModal(false);
    setEditingPost(null);
    setFormState(INITIAL_FORM_STATE);
  };

  const openCreateModal = () => {
    setEditingPost(null);
    setFormState(INITIAL_FORM_STATE);
    setShowFormModal(true);
  };

  const openEditModal = (post: KnowledgePost) => {
    setEditingPost(post);
    setFormState(mapPostToForm(post));
    setShowFormModal(true);
  };

  const handleFormChange = <K extends keyof KnowledgeFormState>(
    field: K,
    value: KnowledgeFormState[K],
  ) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setUploadingImage(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const uploadedUrl = await uploadKnowledgePostImage(token, file);

      if (!uploadedUrl) {
        throw new Error('La API no devolvio la URL de la imagen.');
      }

      setFormState((current) => ({
        ...current,
        imageUrls: Array.from(new Set([...current.imageUrls, uploadedUrl])),
      }));
      toast.success('Imagen agregada a la publicacion.');
    } catch (uploadError) {
      console.error('Knowledge image upload failed:', uploadError);
      toast.error(
        uploadError instanceof Error
          ? uploadError.message
          : 'No fue posible subir la imagen.',
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (imageUrl: string) => {
    setFormState((current) => ({
      ...current,
      imageUrls: current.imageUrls.filter((value) => value !== imageUrl),
    }));
  };

  const handleAttachmentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setUploadingAttachment(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const uploadedAttachment = await uploadKnowledgePostAttachment(token, file);

      if (!uploadedAttachment?.url) {
        throw new Error('La API no devolvio la informacion del archivo.');
      }

      setFormState((current) => ({
        ...current,
        attachments: [
          ...current.attachments.filter(
            (attachment) => attachment.url !== uploadedAttachment.url,
          ),
          uploadedAttachment,
        ],
      }));
      toast.success('Archivo adjunto agregado a la publicacion.');
    } catch (uploadError) {
      console.error('Knowledge attachment upload failed:', uploadError);
      toast.error(
        uploadError instanceof Error
          ? uploadError.message
          : 'No fue posible subir el archivo adjunto.',
      );
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = (attachmentUrl: string) => {
    setFormState((current) => ({
      ...current,
      attachments: current.attachments.filter(
        (attachment) => attachment.url !== attachmentUrl,
      ),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManage) {
      toast.error('Solo administradores pueden gestionar publicaciones.');
      return;
    }

    if (!formState.title.trim() || !formState.content.trim()) {
      toast.error('Titulo y contenido son obligatorios.');
      return;
    }

    setSubmitting(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const payload = buildPayload(formState);

      if (editingPost) {
        await updateKnowledgePost(token, editingPost.id, payload);
        toast.success('Publicacion actualizada.');
      } else {
        await createKnowledgePost(token, payload);
        toast.success('Publicacion creada.');
      }

      forceCloseFormModal();
      await loadPosts();
    } catch (submitError) {
      console.error('Knowledge post submit failed:', submitError);
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible guardar la publicacion.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      await deleteKnowledgePost(token, deleteTarget.id);
      toast.success('Publicacion eliminada.');
      setDeleteTarget(null);

      if (selectedPost?.id === deleteTarget.id) {
        setSelectedPost(null);
      }

      const shouldGoBackOnePage = posts.length === 1 && page > 1;

      if (shouldGoBackOnePage) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
      } else {
        await loadPosts();
      }
    } catch (deleteError) {
      console.error('Knowledge post delete failed:', deleteError);
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible eliminar la publicacion.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-theme bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.7fr))]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por titulo, contenido o etiquetas"
                className="w-full rounded-2xl border border-theme bg-base py-3 pl-11 pr-4 text-sm font-medium text-primary outline-none transition-all placeholder:text-muted focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
              />
            </label>

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as KnowledgeCategory | '')
              }
              className="rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Todas las categorias</option>
              {KNOWLEDGE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as KnowledgeStatus | '')
              }
              className="rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Todos los estados</option>
              {KNOWLEDGE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as KnowledgePriority | '')
              }
              className="rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Todas las prioridades</option>
              {KNOWLEDGE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>

          {canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-base-color shadow-lg shadow-primary/10 transition-all hover:opacity-90 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Nueva publicacion
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-theme pt-4 text-[11px] font-bold text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>
              {totalItems} publicaciones
              {activeFiltersLabel ? ` · ${activeFiltersLabel}` : ''}
            </span>
          </div>
          {!canManage ? (
            <span className="rounded-full border border-theme bg-base px-3 py-1 text-[10px] uppercase tracking-widest text-primary">
              Solo lectura para tu rol
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-3xl border border-theme bg-surface p-6 shadow-sm"
            >
              <div className="h-4 w-32 animate-pulse rounded-full bg-base" />
              <div className="mt-4 h-6 w-3/4 animate-pulse rounded-full bg-base" />
              <div className="mt-3 h-16 animate-pulse rounded-2xl bg-base" />
              <div className="mt-4 h-10 animate-pulse rounded-2xl bg-base" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">No se pudo cargar el Centro Informativo.</p>
              <p className="mt-1 text-sm font-medium">{error}</p>
            </div>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-theme bg-surface px-8 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-xl font-black tracking-tight text-primary">
            No hay publicaciones para esta busqueda
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-muted">
            Ajusta los filtros o crea una nueva publicacion interna para compartir reglas comerciales,
            noticias, comunicados o datos operativos.
          </p>
          {canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-base-color shadow-lg shadow-primary/10 transition-all hover:opacity-90 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Crear primera publicacion
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPost(post)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedPost(post);
                  }
                }}
                className="group min-w-0 rounded-3xl border border-theme bg-surface p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
              >
                {post.imageUrls[0] ? (
                  <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-2xl border border-theme bg-base">
                    <Image
                      src={post.imageUrls[0]}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-theme bg-base px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                      {CATEGORY_LABELS[post.category]}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getStatusClasses(post.status)}`}
                    >
                      {STATUS_LABELS[post.status]}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getPriorityClasses(post.priority)}`}
                    >
                      {PRIORITY_LABELS[post.priority]}
                    </span>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(post);
                        }}
                        className="rounded-xl p-2 text-muted transition-all hover:bg-primary/10 hover:text-primary"
                        title="Editar publicacion"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(post);
                        }}
                        className="rounded-xl p-2 text-muted transition-all hover:bg-red-50 hover:text-red-600"
                        title="Eliminar publicacion"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <h3 className="mt-5 max-w-full text-xl font-black tracking-tight text-primary [overflow-wrap:anywhere]">
                  {post.title}
                </h3>
                <p className="mt-2 text-xs font-mono text-muted">/{post.slug}</p>

                <p className="mt-4 min-h-16 text-sm font-medium leading-relaxed text-muted">
                  {post.summary?.trim()
                    ? truncateText(post.summary, 180)
                    : truncateText(post.content, 180)}
                </p>

                {post.tags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.tags.slice(0, 4).map((tagValue) => (
                      <span
                        key={tagValue}
                        className="inline-flex items-center gap-1 rounded-full border border-theme bg-base px-3 py-1 text-[10px] font-bold text-muted"
                      >
                        <Tag className="h-3 w-3" />
                        {tagValue}
                      </span>
                    ))}
                    {post.tags.length > 4 ? (
                      <span className="rounded-full border border-theme bg-base px-3 py-1 text-[10px] font-bold text-muted">
                        +{post.tags.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 rounded-2xl border border-theme bg-base/40 p-4 text-[11px] font-medium text-muted">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2">
                      <FileArchive className="h-4 w-4" />
                      Adjuntos
                    </span>
                    <span className="text-right font-bold text-primary">
                      {post.attachments?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Actualizado
                    </span>
                    <span className="text-right font-bold text-primary">
                      {formatKnowledgeDate(post.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Autor
                    </span>
                    <span className="text-right font-bold text-primary">
                      {post.author?.email ?? 'Sin asignar'}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-theme bg-surface px-6 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-medium text-muted">
              Pagina <span className="font-black text-primary">{page}</span> de{' '}
              <span className="font-black text-primary">{totalPages}</span>
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-2xl border border-theme bg-base px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                className="rounded-2xl border border-theme bg-base px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      {showFormModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closeFormModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-4xl overflow-hidden rounded-3xl border border-theme bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="flex items-start justify-between gap-4 border-b border-theme px-6 py-5 md:px-8">
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-primary">
                    {editingPost ? 'Editar publicacion' : 'Nueva publicacion'}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-muted">
                    Registra informacion clave del negocio para el equipo comercial y operativo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="rounded-full bg-base p-2 text-muted transition-all hover:text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-6 md:px-8">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Titulo
                    </span>
                    <input
                      type="text"
                      value={formState.title}
                      onChange={(event) => handleFormChange('title', event.target.value)}
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                      required
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Slug
                    </span>
                    <input
                      type="text"
                      value={formState.slug}
                      onChange={(event) => handleFormChange('slug', event.target.value)}
                      placeholder="Se genera automaticamente si lo dejas vacio"
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-mono text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Resumen
                    </span>
                    <textarea
                      value={formState.summary}
                      onChange={(event) => handleFormChange('summary', event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Categoria
                    </span>
                    <select
                      value={formState.category}
                      onChange={(event) =>
                        handleFormChange(
                          'category',
                          event.target.value as KnowledgeCategory,
                        )
                      }
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                    >
                      {KNOWLEDGE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Estado
                    </span>
                    <select
                      value={formState.status}
                      onChange={(event) =>
                        handleFormChange(
                          'status',
                          event.target.value as KnowledgeStatus,
                        )
                      }
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                    >
                      {KNOWLEDGE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Prioridad
                    </span>
                    <select
                      value={formState.priority}
                      onChange={(event) =>
                        handleFormChange(
                          'priority',
                          event.target.value as KnowledgePriority,
                        )
                      }
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                    >
                      {KNOWLEDGE_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {PRIORITY_LABELS[priority]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Publicado en
                    </span>
                    <input
                      type="datetime-local"
                      value={formState.publishedAt}
                      onChange={(event) =>
                        handleFormChange('publishedAt', event.target.value)
                      }
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Imagenes
                    </span>
                    <div className="rounded-2xl border border-theme bg-base/30 p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap gap-3">
                          {formState.imageUrls.map((imageUrl) => (
                            <div
                              key={imageUrl}
                              className="relative h-28 w-28 overflow-hidden rounded-2xl border border-theme bg-surface shadow-sm"
                            >
                              <Image
                                src={imageUrl}
                                alt="Imagen de la publicacion"
                                fill
                                className="object-cover"
                                unoptimized
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(imageUrl)}
                                className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white transition-all hover:bg-black"
                                title="Quitar imagen"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}

                          <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-theme bg-surface text-center transition-all hover:border-primary/30 hover:bg-primary/5">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                              disabled={uploadingImage}
                            />
                            {uploadingImage ? (
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            ) : (
                              <>
                                <ImagePlus className="h-5 w-5 text-primary" />
                                <span className="mt-2 px-2 text-[10px] font-black uppercase tracking-widest text-primary">
                                  Agregar
                                </span>
                              </>
                            )}
                          </label>
                        </div>
                        <p className="text-xs font-medium text-muted">
                          Puedes agregar varias imagenes. Se suben al storage y luego se guardan en la publicacion.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Archivos adjuntos
                    </span>
                    <div className="rounded-2xl border border-theme bg-base/30 p-4">
                      <div className="flex flex-col gap-4">
                        {formState.attachments.length > 0 ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {formState.attachments.map((attachment) => (
                              <div
                                key={attachment.url}
                                className="flex items-start justify-between gap-3 rounded-2xl border border-theme bg-surface p-4 shadow-sm"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="inline-flex items-center gap-2 text-primary">
                                    <FileArchive className="h-4 w-4 shrink-0" />
                                    <p className="truncate text-sm font-black">
                                      {attachment.name}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-xs font-medium text-muted">
                                    {attachment.mimeType ?? 'Archivo'} ·{' '}
                                    {formatFileSize(attachment.size)}
                                  </p>
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary underline decoration-primary/30 underline-offset-4"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Abrir archivo
                                  </a>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAttachment(attachment.url)}
                                  className="rounded-full bg-base p-2 text-muted transition-all hover:text-red-600"
                                  title="Quitar archivo"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-theme bg-surface/80 px-4 py-5 text-sm font-medium text-muted">
                            Agrega PDFs, hojas de calculo, cotizaciones, plantillas o archivos de apoyo.
                          </div>
                        )}

                        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-theme bg-surface px-4 py-4 transition-all hover:border-primary/30 hover:bg-primary/5">
                          <input
                            type="file"
                            accept=".pdf,.csv,.txt,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                            className="hidden"
                            onChange={handleAttachmentUpload}
                            disabled={uploadingAttachment}
                          />
                          <div>
                            <p className="text-sm font-black text-primary">
                              Subir archivo
                            </p>
                            <p className="mt-1 text-xs font-medium text-muted">
                              PDF, Excel, Word, CSV, ZIP, PowerPoint o imagenes PNG, JPG o WEBP.
                            </p>
                          </div>
                          {uploadingAttachment ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : (
                            <FileArchive className="h-5 w-5 text-primary" />
                          )}
                        </label>
                      </div>
                    </div>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Etiquetas
                    </span>
                    <input
                      type="text"
                      value={formState.tagsInput}
                      onChange={(event) =>
                        handleFormChange('tagsInput', event.target.value)
                      }
                      placeholder="ventas, mayoristas, precios, operacion"
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Contenido
                    </span>
                    <textarea
                      value={formState.content}
                      onChange={(event) => handleFormChange('content', event.target.value)}
                      rows={16}
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                      required
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-theme px-6 py-4 md:flex-row md:items-center md:justify-end md:px-8">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="rounded-2xl border border-theme px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary transition-all hover:bg-base"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-base-color shadow-lg shadow-primary/10 transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BookOpen className="h-4 w-4" />
                  )}
                  {editingPost ? 'Guardar cambios' : 'Crear publicacion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedPost ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPost(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-4xl overflow-hidden rounded-3xl border border-theme bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-theme px-6 py-5 md:px-8">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-theme bg-base px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                    {CATEGORY_LABELS[selectedPost.category]}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getStatusClasses(selectedPost.status)}`}
                  >
                    {STATUS_LABELS[selectedPost.status]}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getPriorityClasses(selectedPost.priority)}`}
                  >
                    {PRIORITY_LABELS[selectedPost.priority]}
                  </span>
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-tight text-primary">
                  {selectedPost.title}
                </h3>
                <p className="mt-2 text-xs font-mono text-muted">/{selectedPost.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="rounded-full bg-base p-2 text-muted transition-all hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-6 md:px-8">
              {selectedPost.imageUrls.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedPost.imageUrls.map((imageUrl) => (
                    <div
                      key={imageUrl}
                      className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-theme bg-base"
                    >
                      <Image
                        src={imageUrl}
                        alt={selectedPost.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedPost.summary ? (
                <div className="mt-5 rounded-2xl border border-theme bg-base/40 p-4 text-sm font-medium leading-relaxed text-muted">
                  {selectedPost.summary}
                </div>
              ) : null}

              {selectedPost.attachments?.length ? (
                <div className="mt-5 rounded-3xl border border-theme bg-base/20 p-5">
                  <div className="flex items-center gap-2">
                    <FileArchive className="h-4 w-4 text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Archivos adjuntos
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {selectedPost.attachments.map((attachment) => (
                      <a
                        key={attachment.url}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start justify-between gap-3 rounded-2xl border border-theme bg-surface p-4 transition-all hover:border-primary/30 hover:bg-primary/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-primary">
                            {attachment.name}
                          </p>
                          <p className="mt-1 text-xs font-medium text-muted">
                            {attachment.mimeType ?? 'Archivo'} ·{' '}
                            {formatFileSize(attachment.size)}
                          </p>
                        </div>
                        <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-theme bg-base/40 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Actualizado
                  </p>
                  <p className="mt-2 text-sm font-bold text-primary">
                    {formatKnowledgeDate(selectedPost.updatedAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-theme bg-base/40 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Publicado
                  </p>
                  <p className="mt-2 text-sm font-bold text-primary">
                    {formatKnowledgeDate(selectedPost.publishedAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-theme bg-base/40 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Autor
                  </p>
                  <p className="mt-2 text-sm font-bold text-primary">
                    {selectedPost.author?.email ?? 'Sin asignar'}
                  </p>
                </div>
              </div>

              {selectedPost.tags.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedPost.tags.map((tagValue) => (
                    <span
                      key={tagValue}
                      className="rounded-full border border-theme bg-base px-3 py-1 text-[10px] font-bold text-muted"
                    >
                      {tagValue}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 rounded-3xl border border-theme bg-base/20 p-5">
                <pre className="whitespace-pre-wrap break-words text-sm font-medium leading-7 text-primary">
                  {selectedPost.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!deleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-theme bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-black tracking-tight text-primary">
                Eliminar publicacion
              </h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
                Se eliminara la publicacion <span className="font-black text-primary">{deleteTarget.title}</span>.
                Esta accion no se puede deshacer.
              </p>
            </div>

            <div className="flex gap-3 border-t border-theme px-6 py-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-2xl border border-theme px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary transition-all hover:bg-base disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
