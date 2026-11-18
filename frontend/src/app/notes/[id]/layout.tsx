import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ubah Catatan",
};

export default function EditNoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
