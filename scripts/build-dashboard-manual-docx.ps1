param(
 [string]$OutputPath = "C:\Users\user\Desktop\deybis\tote-bag\MANUAL_DASHBOARD_EJECUTIVO.docx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Escape-Xml {
  param([string]$Text)

  if ($null -eq $Text) {
    return ""
  }

  return $Text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;")
}

function New-ParagraphXml {
  param(
    [string]$Text,
    [string]$Style = "Normal",
    [switch]$Bold
  )

  $styleXml = ""
  if ($Style -and $Style -ne "Normal") {
    $styleXml = "<w:pStyle w:val=""$Style""/>"
  }

  $runProps = ""
  if ($Bold) {
    $runProps = "<w:rPr><w:b/></w:rPr>"
  }

  return "<w:p><w:pPr>$styleXml</w:pPr><w:r>$runProps<w:t xml:space=""preserve"">$(Escape-Xml $Text)</w:t></w:r></w:p>"
}

function New-BlankParagraphXml {
  return "<w:p/>"
}

function Write-Utf8File {
  param(
    [string]$Path,
    [string]$Content
  )

  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

$purposeBullets = @(
  "Revisar el estado general del negocio.",
  "Atender pedidos y casos pendientes.",
  "Mantener actualizado el catálogo.",
  "Controlar cotizaciones corporativas y personalizaciones.",
  "Registrar compras, recepciones y movimientos logísticos.",
  "Monitorear flujo de caja, gastos, nómina y reportes contables.",
  "Auditar cambios y administrar accesos."
)

$roles = @(
  "ADMIN: acceso total a todos los módulos del dashboard.",
  "MANAGER: acceso a resumen, pedidos, productos, B2B, personalizaciones, PQRS, centro informativo y varios módulos logísticos.",
  "Operativos privilegiados: acceso más limitado, principalmente a pedidos y productos."
)

$modules = @(
  @{ Title = "1. Resumen"; Route = "/dashboard"; Purpose = "Vista principal del panel para leer pedidos del día, acciones urgentes, carga comercial, stock crítico e indicadores rápidos de operación y finanzas." },
  @{ Title = "2. Pedidos"; Route = "/dashboard/orders"; Purpose = "Centro de control de órdenes para crear pedidos, revisar pagos pendientes, seguir producción y coordinar el paso hacia logística." },
  @{ Title = "3. Productos"; Route = "/dashboard/products"; Purpose = "Administra catálogo, precios, estados, colecciones, configuración técnica y matriz de compatibilidad de materiales." },
  @{ Title = "4. Clientes"; Route = "/dashboard/customers"; Purpose = "Centraliza la gestión de clientes: búsqueda, creación manual, edición de datos y activación o desactivación de cuentas." },
  @{ Title = "5. Corporativo (B2B)"; Route = "/dashboard/b2b"; Purpose = "Gestiona solicitudes empresariales, cotizaciones masivas, validación de logos y apoyo comercial antes de producción." },
  @{ Title = "6. Personalizaciones"; Route = "/dashboard/personalizaciones"; Purpose = "Administra configuraciones, artes y estados de aprobación de solicitudes personalizadas." },
  @{ Title = "7. PQRS"; Route = "/dashboard/pqrs"; Purpose = "Bandeja interna de peticiones, quejas, reclamos y sugerencias con filtros, seguimiento y actualización de estado." },
  @{ Title = "8. Centro Informativo"; Route = "/dashboard/conocimiento"; Purpose = "Base de conocimiento interna para reglas comerciales, lineamientos operativos y novedades del negocio." },
  @{ Title = "9. Dashboard Financiero"; Route = "/dashboard/finanzas"; Purpose = "Consolida KPIs financieros, ingresos, compras, OpEx, cuentas por cobrar, impuestos, gastos fijos y punto de equilibrio." },
  @{ Title = "10. Flujo de Caja"; Route = "/dashboard/finanzas/cash-flow"; Purpose = "Monitorea liquidez, entradas, salidas, saldo acumulado y comportamiento financiero por periodo." },
  @{ Title = "11. Gastos Operativos"; Route = "/dashboard/finanzas/opex"; Purpose = "Registra egresos operativos, clasifica por categoría y alimenta el análisis financiero general." },
  @{ Title = "12. Nómina"; Route = "/dashboard/finanzas/nomina"; Purpose = "Gestiona colaboradores, turnos, evidencias fotográficas, cuentas de cobro y pagos de nómina." },
  @{ Title = "13. Proveedores de Envío"; Route = "/dashboard/logistica/proveedores"; Purpose = "Administra transportadoras, estado activo e información de contacto para despachos." },
  @{ Title = "14. Gestión de Envíos"; Route = "/dashboard/logistica/envios"; Purpose = "Opera despachos y devoluciones: asignación de guía, etiqueta, consumo de bolsas y manejo de excepciones." },
  @{ Title = "15. Proveedores de Insumos"; Route = "/dashboard/logistica/insumos"; Purpose = "Administra proveedores de abastecimiento, saldos, lotes asociados y pagos." },
  @{ Title = "16. Pagos y Facturación"; Route = "/dashboard/compras/facturacion"; Purpose = "Gestiona facturas de compra, abonos, comprobantes y control de saldo pendiente con proveedores." },
  @{ Title = "17. Recepción de Lotes"; Route = "/dashboard/compras/recepcion"; Purpose = "Registra el ingreso físico de mercancía, insumos y herramientas, incluyendo soporte documental y costos." },
  @{ Title = "18. Inventario FIFO"; Route = "/dashboard/logistica/inventario"; Purpose = "Controla stock, lotes, costo promedio, valorización de inventario y alertas de reabastecimiento." },
  @{ Title = "19. Salidas no comerciales"; Route = "/dashboard/logistica/inventario/salidas-no-comerciales"; Purpose = "Registra descuentos de stock por regalos, muestras, pruebas internas o uso operativo sin generar venta." },
  @{ Title = "20. Precios y Márgenes"; Route = "/dashboard/strategy/pricing"; Purpose = "Simulador interno de rentabilidad para estimar precio de venta y margen real; no publica reglas automáticamente." },
  @{ Title = "21. Reportes Contables"; Route = "/dashboard/reportes"; Purpose = "Genera cierres contables, estado de resultados, valorización de inventario y exportaciones a Excel o PDF. Acceso solo ADMIN." },
  @{ Title = "22. Auditoría"; Route = "/dashboard/audit"; Purpose = "Registra quién creó, editó o eliminó información y permite comparar valores anteriores y nuevos." },
  @{ Title = "23. Configuración"; Route = "/dashboard/settings y /dashboard/settings/users"; Purpose = "Administra perfil del usuario y, en caso de ADMIN, gestión de usuarios y roles del sistema." }
)

$flow = @(
  "Inicio de jornada: revisar Resumen, Pedidos, PQRS y Gestión de Envíos.",
  "Operación diaria: registrar compras en Recepción de Lotes, actualizar Pagos y Facturación, validar Inventario FIFO y cargar OpEx o Nómina cuando corresponda.",
  "Cierre y control: revisar Dashboard Financiero, Flujo de Caja, Reportes Contables y Auditoría."
)

$relations = @(
  "Pedidos se conecta con logística, inventario y finanzas.",
  "Recepción de Lotes alimenta Inventario FIFO.",
  "Pagos y Facturación impacta cuentas por pagar y reportes financieros.",
  "Salidas no comerciales afectan inventario sin pasar por ventas.",
  "Nómina, OpEx y compras impactan el Dashboard Financiero.",
  "Auditoría funciona como capa transversal de control."
)

$paragraphs = New-Object System.Collections.Generic.List[string]
$paragraphs.Add((New-ParagraphXml -Text "Manual Ejecutivo del Dashboard Tote Bag" -Style "Title"))
$paragraphs.Add((New-ParagraphXml -Text "Documento de referencia para entender para qué sirve cada módulo del dashboard administrativo y cómo se relaciona con la operación del negocio."))
$paragraphs.Add((New-BlankParagraphXml))
$paragraphs.Add((New-ParagraphXml -Text "Objetivo del dashboard" -Style "Heading1"))
$paragraphs.Add((New-ParagraphXml -Text "El dashboard centraliza la operación administrativa de Tote Bag. Desde aquí se controlan ventas, catálogo, clientes, personalizaciones, abastecimiento, logística, inventario, finanzas, auditoría y configuración interna."))
$paragraphs.Add((New-ParagraphXml -Text "Su propósito es convertir el panel en una herramienta de control operativo, financiero y administrativo para que el equipo pueda tomar decisiones y ejecutar procesos sin depender de múltiples sistemas dispersos."))
foreach ($bullet in $purposeBullets) {
  $paragraphs.Add((New-ParagraphXml -Text "- $bullet"))
}
$paragraphs.Add((New-BlankParagraphXml))
$paragraphs.Add((New-ParagraphXml -Text "Acceso por rol" -Style "Heading1"))
foreach ($roleLine in $roles) {
  $paragraphs.Add((New-ParagraphXml -Text "- $roleLine"))
}
$paragraphs.Add((New-BlankParagraphXml))
$paragraphs.Add((New-ParagraphXml -Text "Módulos del dashboard" -Style "Heading1"))
foreach ($module in $modules) {
  $paragraphs.Add((New-ParagraphXml -Text $module.Title -Style "Heading2"))
  $paragraphs.Add((New-ParagraphXml -Text "Ruta: $($module.Route)"))
  $paragraphs.Add((New-ParagraphXml -Text $module.Purpose))
}
$paragraphs.Add((New-BlankParagraphXml))
$paragraphs.Add((New-ParagraphXml -Text "Flujo operativo recomendado" -Style "Heading1"))
foreach ($line in $flow) {
  $paragraphs.Add((New-ParagraphXml -Text "- $line"))
}
$paragraphs.Add((New-BlankParagraphXml))
$paragraphs.Add((New-ParagraphXml -Text "Relación entre módulos" -Style "Heading1"))
foreach ($line in $relations) {
  $paragraphs.Add((New-ParagraphXml -Text "- $line"))
}
$paragraphs.Add((New-BlankParagraphXml))
$paragraphs.Add((New-ParagraphXml -Text "Observación final" -Style "Heading1"))
$paragraphs.Add((New-ParagraphXml -Text "Este manual fue construido con base en la navegación y las pantallas reales del proyecto actual, por lo que refleja el comportamiento del dashboard implementado en el repositorio."))

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
  <w:body>
    $($paragraphs -join "`n    ")
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="200"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="111111"/>
      <w:sz w:val="34"/>
      <w:szCs w:val="34"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="320" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="111111"/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="240" w:after="80"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="222222"/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$rootRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$documentRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

$created = [DateTime]::UtcNow.ToString("s") + "Z"
$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Manual Ejecutivo del Dashboard Tote Bag</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$created</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$created</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>
"@

$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("dashboard-manual-docx-" + [guid]::NewGuid().ToString())
$zipPath = [System.IO.Path]::ChangeExtension($OutputPath, ".zip")

try {
  New-Item -ItemType Directory -Path $staging | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $staging "_rels") | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $staging "docProps") | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $staging "word") | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $staging "word\_rels") | Out-Null

  Write-Utf8File -Path (Join-Path $staging "[Content_Types].xml") -Content $contentTypesXml
  Write-Utf8File -Path (Join-Path $staging "_rels\.rels") -Content $rootRelsXml
  Write-Utf8File -Path (Join-Path $staging "docProps\core.xml") -Content $coreXml
  Write-Utf8File -Path (Join-Path $staging "docProps\app.xml") -Content $appXml
  Write-Utf8File -Path (Join-Path $staging "word\document.xml") -Content $documentXml
  Write-Utf8File -Path (Join-Path $staging "word\styles.xml") -Content $stylesXml
  Write-Utf8File -Path (Join-Path $staging "word\_rels\document.xml.rels") -Content $documentRelsXml

  if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }

  if (Test-Path $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
  Move-Item -LiteralPath $zipPath -Destination $OutputPath -Force
  Write-Output $OutputPath
}
finally {
  if (Test-Path $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}
