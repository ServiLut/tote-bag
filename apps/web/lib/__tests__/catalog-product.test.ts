import { resolveCatalogProductResponse } from '../catalog-product';

describe('catalog product response', () => {
  it('marca 404 como producto faltante', async () => {
    const result = await resolveCatalogProductResponse<{ id: string }>(
      new Response(null, { status: 404 }),
    );

    expect(result).toEqual({ kind: 'missing' });
  });

  it('marca errores no 404 como indisponibilidad operativa', async () => {
    const result = await resolveCatalogProductResponse<{ id: string }>(
      new Response(null, { status: 500 }),
    );

    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('extrae el producto cuando la respuesta es exitosa', async () => {
    const result = await resolveCatalogProductResponse<{ id: string }>(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'product-1' },
          error: null,
          metadata: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    expect(result).toEqual({
      kind: 'found',
      product: { id: 'product-1' },
    });
  });
});
