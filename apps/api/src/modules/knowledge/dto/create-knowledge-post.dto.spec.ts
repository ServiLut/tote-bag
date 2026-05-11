import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateKnowledgePostDto } from './create-knowledge-post.dto';

describe('CreateKnowledgePostDto', () => {
  it('trim strings before validating them', async () => {
    const dto = plainToInstance(CreateKnowledgePostDto, {
      title: '  Publicacion interna  ',
      slug: '   ',
      summary: '  Resumen corto  ',
      content: '  Contenido valido para el centro  ',
      authorId: '  user-1  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('Publicacion interna');
    expect(dto.slug).toBeUndefined();
    expect(dto.summary).toBe('Resumen corto');
    expect(dto.content).toBe('Contenido valido para el centro');
    expect(dto.authorId).toBe('user-1');
  });

  it('rejects whitespace-only title and content', async () => {
    const dto = plainToInstance(CreateKnowledgePostDto, {
      title: '   ',
      content: '         ',
    });

    const errors = await validate(dto);
    const errorFields = errors.map((error) => error.property);

    expect(errorFields).toEqual(expect.arrayContaining(['title', 'content']));
  });

  it('rejects invalid image urls', async () => {
    const dto = plainToInstance(CreateKnowledgePostDto, {
      title: 'Publicacion valida',
      content: 'Contenido suficientemente largo.',
      imageUrls: ['no es una url valida'],
    });

    const errors = await validate(dto);
    const imageUrlsError = errors.find(
      (error) => error.property === 'imageUrls',
    );
    const hasRootConstraints =
      !!imageUrlsError?.constraints &&
      Object.keys(imageUrlsError.constraints).length > 0;
    const hasNestedConstraints =
      imageUrlsError?.children?.some(
        (child) =>
          child.constraints && Object.keys(child.constraints).length > 0,
      ) ?? false;

    expect(imageUrlsError).toBeDefined();
    expect(hasRootConstraints || hasNestedConstraints).toBe(true);
  });
});
