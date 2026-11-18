export interface NoteSource {
  noteId: string;
  title: string;
  similarity: number | null;
}

export interface InfoKoreksi {
  asli: string;
  dipakai: string;
  perubahan: { dari: string; ke: string }[];
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: NoteSource[] | null;
  koreksi?: InfoKoreksi | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  jumlahPesan: number;
}

export interface AskResponseData {
  conversationId: string;
  answer: string;
  sources: NoteSource[];
  mode: "makna" | "kata";
  koreksi?: InfoKoreksi | null;
}

export interface ConversationDetailData {
  id: string;
  title: string | null;
  createdAt: string;
  messages: AssistantMessage[];
}
