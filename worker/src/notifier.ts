/** The macOS notification of a digest's result. The tests replace it, so they run on any computer. */
export interface Notifier {
  notify(title: NotificationTitle, text: string): Promise<void>;
}

export type NotificationTitle = "Digest ready" | "Digest failed";
