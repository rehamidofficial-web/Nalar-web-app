export function waktuRelatif(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Jika waktu di masa depan atau beda beberapa detik saja
    if (diffMs < 60 * 1000) {
      return "baru saja";
    }

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 60) {
      return `${diffMinutes} menit lalu`;
    }

    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours < 24) {
      return `${diffHours} jam lalu`;
    }

    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 7) {
      return `${diffDays} hari lalu`;
    }

    // Jika lebih dari 7 hari, tampilkan format tanggal Indonesia: "11 Nov 2026"
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return isoString;
  }
}
