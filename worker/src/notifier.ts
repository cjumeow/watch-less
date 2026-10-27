/** The macOS notification of a digest's result. The tests replace it, so they run on any computer. */
export interface Notifier {
  /** `link` is where the delivered digest opens, when its destination gave one; clicking the notification opens it. */
  notify(title: NotificationTitle, text: string, link?: string): Promise<void>;
}

export type NotificationTitle = "Digest ready" | "Digest failed";
