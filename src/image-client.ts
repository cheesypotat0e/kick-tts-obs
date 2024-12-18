import { AsyncQueue, QueueEntry } from "./async-queue";

type ImageEntry = {
  url: string;
  duration?: number; // Duration in milliseconds to show the image
} & QueueEntry;

export class ImageClient {
  queue: AsyncQueue<ImageEntry> = new AsyncQueue();
  private currentImage?: HTMLImageElement;
  private container?: HTMLDivElement;
  private cancelTimeout?: ReturnType<typeof setTimeout>;
  private resolve?: () => void;

  constructor() {
    this.setupContainer();
  }

  private setupContainer() {
    this.container = document.createElement("div");
    this.container.style.position = "fixed";
    this.container.style.top = "10px";
    this.container.style.left = "10px";
    this.container.style.zIndex = "1000";
    document.body.appendChild(this.container);
  }

  public enqueue(entry: ImageEntry) {
    this.queue.enqueue({
      ...entry,
      duration: entry.duration ?? 5000, // Default 5 second duration
    });
  }

  public skip() {
    if (this.currentImage) {
      this.currentImage.remove();
    }

    if (this.cancelTimeout) {
      clearTimeout(this.cancelTimeout);
    }

    this.resolve?.();
  }

  private async displayImage(url: string, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.resolve = resolve;

      // Remove existing image if any
      if (this.currentImage) {
        this.currentImage.remove();
      }

      // Create and setup new image
      const img = document.createElement("img");
      img.style.maxWidth = "300px";
      img.style.maxHeight = "300px";
      img.style.borderRadius = "8px";
      img.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";

      img.onload = () => {
        if (this.container) {
          this.container.appendChild(img);
          this.currentImage = img;

          // Remove image after duration
          this.cancelTimeout = setTimeout(() => {
            img.remove();
            resolve();
          }, duration);
        }
      };

      img.onerror = () => {
        console.error("Failed to load image:", url);
        resolve();
      };

      img.src = url;
    });
  }

  public async start() {
    console.debug("Starting image queue...");
    for await (const message of this.queue) {
      try {
        const { url, duration } = message;
        await this.displayImage(url, duration ?? 5000);
      } catch (error) {
        console.error("Error displaying image:", error);
      }
    }
  }

  public cleanup() {
    this.container?.remove();
  }
}
