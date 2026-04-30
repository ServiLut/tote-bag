import { getPublicAppBaseUrl } from '../env';

describe('public env', () => {
  it('usa localhost en desarrollo cuando no hay base publica configurada', () => {
    expect(getPublicAppBaseUrl(undefined, undefined, 'development')?.toString()).toBe(
      'http://localhost:3000/',
    );
  });

  it('exige una base publica valida en produccion', () => {
    expect(getPublicAppBaseUrl(undefined, undefined, 'production')).toBeUndefined();
    expect(() =>
      getPublicAppBaseUrl('http://shop.example.com', undefined, 'production'),
    ).toThrow('NEXT_PUBLIC_BASE_URL must use https in production.');
    expect(() =>
      getPublicAppBaseUrl('https://localhost:3000', undefined, 'production'),
    ).toThrow('NEXT_PUBLIC_BASE_URL must not point to localhost in production.');
  });

  it('normaliza la URL publica a un origen absoluto sin ruta', () => {
    const publicAppBaseUrl = getPublicAppBaseUrl(
      ' "https://shop.example.com/catalog?preview=true#hero" ',
      undefined,
      'production',
    );

    expect(publicAppBaseUrl?.toString()).toBe('https://shop.example.com/');
  });

  it('usa el host de despliegue cuando falta la URL publica explicita', () => {
    expect(
      getPublicAppBaseUrl(undefined, 'shop.example.com', 'production')?.toString(),
    ).toBe('https://shop.example.com/');
  });
});
