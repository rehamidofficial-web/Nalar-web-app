import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catatan Baru",
};

export default function NewNoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
