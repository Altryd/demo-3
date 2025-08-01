import axios from "axios";

const API_BASE = "http://localhost:8000";

export interface User {
  id: number;
  name: string;
}

export interface Chat {
  id: number;
  summary: string;
  user_id: number;
  created_at: string;
}

export interface AttachmentCreate {
  url: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

export interface AttachmentGet {
  id: number;
  url: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

export interface Message {
  id: number;
  chat_id: number;
  text: string;
  role: "user" | "assistant";
  context?: string[];
  attachments?: AttachmentGet[];
}

export interface NewChatResponse {
  id: number;
  user_id: number;
  summary: string;
  created_at: string;
}

export interface QueryResponseContextItem {
  text: string;
  source: string;
  [key: string]: unknown;
}

export interface QueryResponse {
  answer: string;
  context: QueryResponseContextItem[];
  language: string;
  summary?: string;
}

export interface SpeedTestChartData {
  time: number;
  bpm: number;
}

export interface SpeedTestResult {
  id: number;
  taps: number;
  time: number;
  stream_speed: number;
  unstable_rate: number;
  timestamp: string;
  user_id: number;
  chart_data?: SpeedTestChartData[];
}

export interface SpeedTestPayload {
  user_id: number;
  taps: number;
  time: number;
  bpm: number;
  unstable_rate: number;
  chart_data: SpeedTestChartData[];
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  accessRole: string;
}

export interface SelectCalendarPayload {
  user_id: number;
  calendar_id: string;
}

export const getUsers = (): Promise<User[]> =>
  axios.get(`${API_BASE}/users`).then((res) => res.data);

export const getUserChatsById = (userId: number): Promise<Chat[]> =>
  axios.get(`${API_BASE}/user_chats/${userId}`).then((res) => res.data);

export const getChatMessages = (
  chatId: number,
  signal: AbortSignal
): Promise<Message[]> =>
  axios
    .get(`${API_BASE}/chat_messages/${chatId}`, { signal })
    .then((res) => res.data);

export const createChat = (
  user_id: number,
  text: string,
  signal: AbortSignal
): Promise<NewChatResponse> => {
  const payload = {
    user_id: user_id,
    summary: text.substring(0, 30),
  };
  return axios
    .post(`${API_BASE}/user_chat`, payload, { signal })
    .then((res) => res.data);
};

export const uploadFiles = (
  files: File[],
  signal: AbortSignal
): Promise<AttachmentCreate[]> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  return axios
    .post(`${API_BASE}/attachments/upload`, formData, {
      signal,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    .then((res) => res.data);
};

export const postQuery = (
  question: string,
  userId: number,
  chatId: number,
  attachments: AttachmentCreate[] | null,
  signal: AbortSignal
): Promise<QueryResponse> => {
  const payload = {
    question: question,
    language: null,
    user_id: userId,
    chat_id: chatId,
    attachments: attachments,
  };

  return axios.post(`${API_BASE}/query`, payload, { signal }).then((res) => {
    const data = res.data;
    return {
      answer: data.answer,
      context: data.context,
      language: data.language,
      summary: data.summary,
    } as QueryResponse;
  });
};

export const deleteChat = (chatId: number): Promise<void> => {
  return axios.delete(`${API_BASE}/chat/${chatId}`);
};

export const listUserCalendars = (
  userId: number,
  signal: AbortSignal
): Promise<{ calendars: GoogleCalendar[] }> =>
  axios
    .get(`${API_BASE}/calendars?user_id=${userId}`, { signal })
    .then((res) => res.data);

export const selectUserCalendar = (
  payload: SelectCalendarPayload,
  signal: AbortSignal
): Promise<{ message: string }> =>
  axios
    .post(`${API_BASE}/select_calendar`, payload, { signal })
    .then((res) => res.data);

export const saveSpeedTestResult = (
  payload: SpeedTestPayload,
  signal: AbortSignal
): Promise<SpeedTestResult> =>
  axios
    .post(`${API_BASE}/speed-test`, payload, { signal })
    .then((res) => res.data);

export const getSpeedTestResults = (
  userId: number,
  signal: AbortSignal
): Promise<SpeedTestResult[]> =>
  axios
    .get(`${API_BASE}/speed-test/${userId}`, { signal })
    .then((res) => res.data);
