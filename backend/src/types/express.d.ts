declare global {
  namespace Express {
    interface Request {
      userId?: string;
      /** Diisi true bila permintaan tidak akan memanggil AI (hasil cache), jadi tidak memakai jatah AI harian. */
      lewatiBatasAiHarian?: boolean;
    }
  }
}

export {};
