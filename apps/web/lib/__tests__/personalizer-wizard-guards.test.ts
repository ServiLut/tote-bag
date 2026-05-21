import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

interface PersonalizerTechniqueOption {
  code: string;
  name: string;
  allowedMaterialValues?: string[];
}

interface PersonalizerTechniqueActionGuard {
  hasCompatibleTechniqueOptions: boolean;
  hasUploadedLogo: boolean;
  hasDesignUrl: boolean;
  hasPreparedDesign?: boolean;
  hasConfigCode: boolean;
  isUploadingLogo?: boolean;
  isPricingLoading?: boolean;
}

interface ResolveRestoredSizeSelectionInput {
  restoredSize?: string | null;
  resolvedVariantSize?: string | null;
  currentSize?: string | null;
}

interface PersonalizerWizardHelperExports {
  getCompatibleTechniqueOptions: (
    options: PersonalizerTechniqueOption[],
    material: string,
  ) => PersonalizerTechniqueOption[];
  getCompatibleOtherOptions: (
    options: PersonalizerTechniqueOption[],
    material: string,
  ) => PersonalizerTechniqueOption[];
  isTechniqueActionBlocked: (
    input: PersonalizerTechniqueActionGuard,
  ) => boolean;
  shouldInlineDraftDesign: (fileSize?: number | null) => boolean;
  resolveRestoredSizeSelection: (
    input: ResolveRestoredSizeSelectionInput,
  ) => string;
}

const loadPersonalizerWizardHelpers = (): PersonalizerWizardHelperExports => {
  const componentPath = path.resolve(
    __dirname,
    '../../components/store/PersonalizerWizard.tsx',
  );
  const source = fs.readFileSync(componentPath, 'utf8');
  const match = source.match(
    /\/\* personalizer-wizard-test-helpers:start \*\/([\s\S]*?)\/\* personalizer-wizard-test-helpers:end \*\//,
  );

  if (!match?.[1]) {
    throw new Error('No se encontro el bloque de helpers de PersonalizerWizard.');
  }

  const transpiled = ts.transpileModule(match[1], {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
    },
  }).outputText;

  const moduleLike = {
    exports: {} as Partial<PersonalizerWizardHelperExports>,
  };
  const evaluateHelpers = new Function('exports', 'module', transpiled);
  evaluateHelpers(moduleLike.exports, moduleLike);

  return moduleLike.exports as PersonalizerWizardHelperExports;
};

describe('personalizer wizard guards', () => {
  const {
    getCompatibleTechniqueOptions,
    getCompatibleOtherOptions,
    isTechniqueActionBlocked,
    shouldInlineDraftDesign,
    resolveRestoredSizeSelection,
  } = loadPersonalizerWizardHelpers();

  it('no considera opciones extra como tecnica compatible para avanzar o enviar', () => {
    const options: PersonalizerTechniqueOption[] = [
      {
        code: 'CIERRE-MAGNETICO',
        name: 'Cierre magnetico',
        allowedMaterialValues: ['Lona'],
      },
      {
        code: 'BOTON-PRESION',
        name: 'Boton a presion',
        allowedMaterialValues: ['Cuero'],
      },
    ];

    expect(getCompatibleTechniqueOptions(options, 'Cuero')).toEqual([]);
    expect(getCompatibleOtherOptions(options, 'Cuero')).toEqual([options[1]]);
  });

  it('bloquea la accion dependiente de tecnica cuando no hay tecnica compatible', () => {
    expect(
      isTechniqueActionBlocked({
        hasCompatibleTechniqueOptions: false,
        hasUploadedLogo: true,
        hasDesignUrl: true,
        hasPreparedDesign: true,
        hasConfigCode: true,
      }),
    ).toBe(true);

    expect(
      isTechniqueActionBlocked({
        hasCompatibleTechniqueOptions: true,
        hasUploadedLogo: true,
        hasDesignUrl: false,
        hasPreparedDesign: true,
        hasConfigCode: true,
      }),
    ).toBe(false);
  });

  it('solo serializa disenios pequenos en el borrador de sessionStorage', () => {
    expect(shouldInlineDraftDesign(256 * 1024)).toBe(true);
    expect(shouldInlineDraftDesign(5 * 1024 * 1024)).toBe(false);
  });

  it('preserva la talla restaurada del borrador sobre la variante base', () => {
    expect(
      resolveRestoredSizeSelection({
        restoredSize: '45x38',
        resolvedVariantSize: '30x35',
        currentSize: '',
      }),
    ).toBe('45x38');

    expect(
      resolveRestoredSizeSelection({
        restoredSize: '',
        resolvedVariantSize: '30x35',
        currentSize: 'otro',
      }),
    ).toBe('30x35');
  });
});
