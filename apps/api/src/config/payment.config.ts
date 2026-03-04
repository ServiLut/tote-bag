import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  wompiPublicKey: process.env.WOMPI_PUBLIC_KEY,
  wompiPrivateKey: process.env.WOMPI_PRIVATE_KEY,
  wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET,
}));
