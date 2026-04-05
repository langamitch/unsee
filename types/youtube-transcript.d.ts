declare module 'youtube-transcript/dist/youtube-transcript.esm.js' {
  export class YoutubeTranscript {
    static fetchTranscript(
      videoId: string,
      options?: {
        lang?: string
        fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
      },
    ): Promise<Array<{ text: string; offset: number }>>
  }

  export class YoutubeTranscriptDisabledError extends Error {}
  export class YoutubeTranscriptNotAvailableError extends Error {}
  export class YoutubeTranscriptNotAvailableLanguageError extends Error {}
}
