import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  wompiPublicKey:
    process.env.WOMPI_PUBLIC_KEY || process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY,
  wompiPrivateKey: process.env.WOMPI_PRIVATE_KEY,
  wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET,
  wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET,
  wompiCommissionPercent: Number(process.env.WOMPI_COMMISSION_PERCENT ?? 0),
  wompiFixedFeeCop: Number(process.env.WOMPI_FIXED_FEE_COP ?? 0),
  wompiPackagingCifCop: Number(process.env.WOMPI_PACKAGING_CIF_COP ?? 990),
  wompiCommissionVatPercent: Number(
    process.env.WOMPI_COMMISSION_VAT_PERCENT ?? 0,
  ),
  wompiReteFuentePercent: Number(process.env.WOMPI_RETEFUENTE_PERCENT ?? 0),
  wompiReteIvaPercent: Number(process.env.WOMPI_RETEIVA_PERCENT ?? 0),
  wompiReteIcaPercent: Number(process.env.WOMPI_RETEICA_PERCENT ?? 0),
}));
