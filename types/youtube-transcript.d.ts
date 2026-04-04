declare module 'youtube-transcript/dist/youtube-transcript.esm.js' {
  export class YoutubeTranscript {
    static fetchTranscript(videoId: string): Promise<Array<{ text: string; offset: number }>>
  }

  export class YoutubeTranscriptDisabledError extends Error {}
  export class YoutubeTranscriptNotAvailableError extends Error {}
  export class YoutubeTranscriptNotAvailableLanguageError extends Error {}
}
