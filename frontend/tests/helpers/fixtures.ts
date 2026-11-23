export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export function buatCatatan(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-123",
    userId: "user-123",
    title: "Catatan Contoh",
    content: "Ini adalah isi catatan untuk keperluan pengujian.",
    tags: ["testing", "vitest"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buatPengguna(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    name: "Pengguna Uji",
    email: "pengguna@example.test",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
