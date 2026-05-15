# Centro Informativo

## Que es

El modulo `Centro Informativo` permite registrar publicaciones internas dentro del dashboard administrativo para compartir noticias, reglas comerciales, precios, comunicados y datos operativos del negocio.

## Autenticacion y permisos

Todos los endpoints requieren `Authorization: Bearer <token>`.

Las respuestas HTTP del backend siguen el envelope general del API:

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: string | null;
  metadata?: Record<string, unknown>;
};
```

Permisos usados por el backend:

- `knowledge-posts:read`
- `knowledge-posts:create`
- `knowledge-posts:update`
- `knowledge-posts:delete`

## Endpoints disponibles

- `GET /api/v1/knowledge-posts`
- `GET /api/v1/knowledge-posts/:id`
- `POST /api/v1/knowledge-posts`
- `PATCH /api/v1/knowledge-posts/:id`
- `DELETE /api/v1/knowledge-posts/:id`
- `POST /api/v1/knowledge-posts/upload-image`
- `POST /api/v1/knowledge-posts/upload-attachment`

## Query params del listado

- `search`: busca por titulo, resumen, contenido o etiquetas.
- `category`: `GENERAL | VENTAS | NOTICIAS | OPERACION | FINANZAS | ESTRATEGIA`
- `status`: `BORRADOR | PUBLICADO | ARCHIVADO`
- `priority`: `BAJA | MEDIA | ALTA | CRITICA`
- `page`: entero >= 1.
- `limit`: entero entre 1 y 50.

`GET`, `PATCH` y `DELETE /knowledge-posts/:id` reciben `id` como UUID v4. No existe endpoint de detalle por `slug`.

## Respuesta del listado

```ts
type KnowledgePostsListResponse = {
  items: KnowledgePost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
```

## Modelo devuelto por la API

```ts
type KnowledgePost = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  imageUrls: string[];
  attachments: Array<{
    name: string;
    url: string;
    mimeType?: string;
    size?: number;
  }> | null;
  category: 'GENERAL' | 'VENTAS' | 'NOTICIAS' | 'OPERACION' | 'FINANZAS' | 'ESTRATEGIA';
  status: 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';
  priority: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  tags: string[];
  authorId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'CUSTOMER';
  } | null;
};
```

## Payload de creacion/actualizacion

```json
{
  "title": "Actualizacion de descuentos B2B",
  "summary": "Cambios internos en politicas comerciales para ventas corporativas.",
  "content": "Detalle interno de la actualizacion...",
  "imageUrls": [
    "https://.../storage/v1/object/public/product-assets/knowledge-posts/ejemplo.jpg"
  ],
  "attachments": [
    {
      "name": "lista-mayoristas.xlsx",
      "url": "https://.../storage/v1/object/public/product-assets/knowledge-posts/attachments/lista-mayoristas.xlsx",
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "size": 32844
    }
  ],
  "category": "VENTAS",
  "status": "PUBLICADO",
  "priority": "ALTA",
  "tags": ["ventas", "b2b", "descuentos"],
  "publishedAt": "2026-05-05T00:00:00.000Z"
}
```

## Reglas importantes del backend

- `title` es obligatorio, minimo 3 caracteres, maximo 180.
- `content` es obligatorio, minimo 10 caracteres.
- `slug` es opcional. Si no se envia, el backend lo deriva desde `title`.
- `summary` es opcional, maximo 500 caracteres.
- `tags` se normalizan a minuscula y sin duplicados.
- `imageUrls` y `attachments` ausentes se guardan como listas vacias.
- `authorId` es opcional. Si no se envia, el backend intenta usar `req.user.id`.
- Si `status` pasa a `PUBLICADO` y no se envia `publishedAt`, el backend asigna la fecha actual.
- `DELETE /knowledge-posts/:id` responde `204 No Content`.

## Upload de imagenes

`POST /api/v1/knowledge-posts/upload-image`

- Content-Type: `multipart/form-data`
- Campo requerido: `file`
- Tamano maximo: 10 MB
- Solo acepta MIME `image/*`

Respuesta esperada en `data`:

```ts
type UploadImageResponse = {
  url: string;
  path: string;
};
```

## Upload de adjuntos

`POST /api/v1/knowledge-posts/upload-attachment`

- Content-Type: `multipart/form-data`
- Campo requerido: `file`
- Tamano maximo: 25 MB
- MIME permitidos:
  - PDF
  - Excel (`.xls`, `.xlsx`)
  - Word (`.doc`, `.docx`)
  - CSV / texto plano
  - ZIP
  - PowerPoint (`.ppt`, `.pptx`)
  - Imagenes `png`, `jpg`, `jpeg`, `webp`

Respuesta esperada en `data`:

```ts
type UploadAttachmentResponse = {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
};
```

## Uso previsto

- Publicar precios y reglas comerciales vigentes.
- Comunicar noticias internas al equipo del dashboard.
- Registrar criterios operativos y financieros de consulta rapida.
- Mantener una fuente centralizada de informacion no transaccional.
