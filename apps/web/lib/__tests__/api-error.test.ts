describe('api error helpers', () => {
  it('extrae mensajes anidados del payload', async () => {
    const { extractApiErrorMessage } = await import('../api-error');

    expect(
      extractApiErrorMessage(
        { data: { message: ['Uno', 'Dos'] } },
        'fallback',
      ),
    ).toBe('Uno, Dos');
  });

  it('formatea errores de conexion del proxy con hosts legibles', async () => {
    const { formatApiConnectionErrorMessage } = await import('../api-error');

    expect(
      formatApiConnectionErrorMessage(
        'No fue posible conectar con la API. URLs probadas: http://localhost:4004/api/v1/profiles, http://127.0.0.1:4004/api/v1/profiles. Detalle: fetch failed',
        'clientes',
      ),
    ).toBe(
      'No fue posible conectar con la API de clientes. Se intento acceder a localhost:4004, 127.0.0.1:4004. Verifica que el backend este arriba y vuelve a cargar.',
    );
  });

  it('lee el cuerpo JSON de una respuesta fallida sin consumir la original', async () => {
    const { getApiResponseErrorMessage } = await import('../api-error');

    const response = new Response(
      JSON.stringify({
        message:
          'No fue posible conectar con la API. URLs probadas: http://localhost:4004/api/v1/catalog/admin/products. Detalle: fetch failed',
      }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json',
        },
      },
    );

    await expect(
      getApiResponseErrorMessage(
        response,
        'No se pudieron cargar los productos.',
        'productos del catalogo',
      ),
    ).resolves.toBe(
      'No fue posible conectar con la API de productos del catalogo. Se intento acceder a localhost:4004. Verifica que el backend este arriba y vuelve a cargar.',
    );

    await expect(response.json()).resolves.toEqual({
      message:
        'No fue posible conectar con la API. URLs probadas: http://localhost:4004/api/v1/catalog/admin/products. Detalle: fetch failed',
    });
  });
});
