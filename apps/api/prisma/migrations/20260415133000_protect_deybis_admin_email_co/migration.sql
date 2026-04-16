UPDATE "tote-bag"."users"
SET "role" = 'ADMIN'
WHERE lower("email") IN (
  'deybisasprilla@gmail.co',
  'deybisasprilla@gmail.com'
);
