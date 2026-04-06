export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  countryId: number | null;
  campaignId: number | null;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
