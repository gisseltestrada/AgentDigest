import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { marked } from 'marked';

const API_URL = 'http://localhost:3000';

type AddMode = 'url' | 'text';

interface Source {
  id: number;
  title: string | null;
  url: string | null;
  content: string | null;
  createdAt: string;
}

interface Citation {
  sourceId: number;
  title: string | null;
  url: string | null;
}

interface ChatReply {
  reply: string;
  citations: Citation[];
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly http = inject(HttpClient);

  protected readonly sources = signal<Source[]>([]);
  protected readonly sourcesLoading = signal(true);

  protected readonly addMode = signal<AddMode>('url');
  protected readonly newTitle = signal('');
  protected readonly newUrl = signal('');
  protected readonly newContent = signal('');
  protected readonly creating = signal(false);
  protected readonly sourceError = signal<string | null>(null);
  protected readonly sourceNotice = signal<string | null>(null);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly chatMessage = signal('');
  protected readonly chatReply = signal<ChatReply | null>(null);
  protected readonly chatError = signal<string | null>(null);
  protected readonly asking = signal(false);

  // Angular sanitizes strings bound via [innerHTML] automatically, so this
  // stays a plain string rather than DomSanitizer.bypassSecurityTrustHtml —
  // the reply text ultimately comes from an LLM fed scraped web content.
  protected readonly replyHtml = computed<string>(() => {
    const reply = this.chatReply();
    return reply ? (marked.parse(reply.reply) as string) : '';
  });

  constructor() {
    this.loadSources();
  }

  setAddMode(mode: AddMode): void {
    this.addMode.set(mode);
    this.sourceError.set(null);
  }

  loadSources(): void {
    this.sourcesLoading.set(true);
    this.http.get<Source[]>(`${API_URL}/sources`).subscribe({
      next: (sources) => {
        this.sources.set(sources);
        this.sourcesLoading.set(false);
      },
      error: () => this.sourcesLoading.set(false),
    });
  }

  createSource(): void {
    const url = this.newUrl().trim();
    const content = this.newContent().trim();
    const mode = this.addMode();

    if (mode === 'url' && !url) {
      this.sourceError.set('Enter a URL to fetch.');
      return;
    }
    if (mode === 'text' && !content) {
      this.sourceError.set('Paste some content first.');
      return;
    }

    this.sourceError.set(null);
    this.sourceNotice.set(null);
    this.creating.set(true);
    this.http
      .post<Source>(`${API_URL}/sources`, {
        title: this.newTitle().trim() || undefined,
        url: mode === 'url' ? url : undefined,
        content: mode === 'text' ? content : undefined,
      })
      .subscribe({
        next: (source) => {
          this.newTitle.set('');
          this.newUrl.set('');
          this.newContent.set('');
          this.creating.set(false);
          this.sourceNotice.set(`Added "${source.title || 'Untitled'}".`);
          this.loadSources();
        },
        error: () => {
          this.creating.set(false);
          this.sourceError.set(
            mode === 'url'
              ? "Couldn't fetch that URL. Check it's reachable and try again."
              : "Couldn't add that source. Try again.",
          );
        },
      });
  }

  deleteSource(id: number): void {
    this.deletingId.set(id);
    this.http.delete(`${API_URL}/sources/${id}`).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadSources();
      },
      error: () => this.deletingId.set(null),
    });
  }

  sendChat(): void {
    const message = this.chatMessage().trim();
    if (!message) {
      return;
    }

    this.asking.set(true);
    this.chatReply.set(null);
    this.chatError.set(null);
    this.http.post<ChatReply>(`${API_URL}/chat`, { message }).subscribe({
      next: (reply) => {
        this.chatReply.set(reply);
        this.asking.set(false);
      },
      error: () => {
        this.asking.set(false);
        this.chatError.set("Couldn't get an answer. Try again in a moment.");
      },
    });
  }
}
