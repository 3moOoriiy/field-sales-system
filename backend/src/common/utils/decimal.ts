import { Prisma } from '@prisma/client';

export type DecLike = number | string | Prisma.Decimal;

export const D = (v: DecLike): Prisma.Decimal => new Prisma.Decimal(v);

export const round2 = (d: Prisma.Decimal): Prisma.Decimal =>
  d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const toNumber = (d: Prisma.Decimal | null | undefined): number =>
  d == null ? 0 : Number(d);
