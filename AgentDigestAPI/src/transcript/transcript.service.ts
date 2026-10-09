import { Injectable } from '@nestjs/common';
import {create} from 'youtube-dl-exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const youtubedl = create('/opt/homebrew/bin/yt-dlp');

interface Subtitle {
  ext: string;
  url?: string;
  data?: string;
}

interface SubtitleInfo {
  [key: string]: Subtitle[] | undefined;
  en?: Subtitle[];
}

@Injectable()
export class TranscriptService {


    isYoutubeUrlRegex(url: string): boolean {
        return /^https:\/\/(www\.)?youtube\.com\/watch\?v=|https:\/\/youtu\.be\//.test(url);
    }

    async isYoutubeUrl(url: string): Promise<boolean> {
        try {
            const sim = await youtubedl(url, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                simulate: true,
                addHeader: ['referer:youtube.com', 'user-agent:googlebot']
            });
            console.log('YouTube URL check result:', sim);

            return true;
        } catch (error) {
            console.log('error:', error);

            return false;
        }
    }

    // Parse YouTube JSON caption format to plain text
    private parseYouTubeJSON(jsonContent: string): string {
        try {
            let data = jsonContent;
            
            // Try to extract JSON array if it's wrapped
            // First try to find array pattern
            const arrayMatch = jsonContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (arrayMatch) {
                data = arrayMatch[0];
            }
            
            const parsed = JSON.parse(data);
            
            // Handle array format - each item is a caption entry with timing info
            if (Array.isArray(parsed)) {
                return parsed
                    .map(item => {
                        // Each item has "segs" array with text segments
                        if (item.segs && Array.isArray(item.segs)) {
                            // Extract utf8 text from each segment and join them
                            return item.segs
                                .map(seg => {
                                    if (seg.utf8) {
                                        // Remove newlines within segments and trim
                                        return seg.utf8.replace(/\n/g, ' ').trim();
                                    }
                                    return '';
                                })
                                .filter(text => text.length > 0)
                                .join(' ');
                        }
                        return '';
                    })
                    .filter(text => text.trim().length > 0)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }
            
            // Handle object format where data might be wrapped
            if (typeof parsed === 'object' && parsed !== null) {
                // Look for 'segs' or similar structure
                if (parsed.segs && Array.isArray(parsed.segs)) {
                    return parsed.segs
                        .map(seg => {
                            if (seg.utf8) {
                                return seg.utf8.replace(/\n/g, ' ').trim();
                            }
                            return '';
                        })
                        .filter(text => text.length > 0)
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                }
                
                // Check if there's a nested structure with events or similar
                const keys = Object.keys(parsed);
                console.log('Object keys:', keys);
                
                for (const key of keys) {
                    if (Array.isArray(parsed[key])) {
                        const result = parsed[key]
                            .map((item: any) => {
                                if (item.segs && Array.isArray(item.segs)) {
                                    return item.segs
                                        .map(seg => {
                                            if (seg.utf8) {
                                                return seg.utf8.replace(/\n/g, ' ').trim();
                                            }
                                            return '';
                                        })
                                        .filter(text => text.length > 0)
                                        .join(' ');
                                }
                                return '';
                            })
                            .filter(text => text.trim().length > 0)
                            .join(' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        
                        if (result.length > 0) {
                            return result;
                        }
                    }
                }
            }
            
            console.error('Could not parse YouTube JSON format');
            return '';
        } catch (error) {
            console.error('Error parsing YouTube JSON captions:', error);
            return '';
        }
    }

    // Parse VTT subtitle format to plain text
    private parseVTT(vttContent: string): string {
        return vttContent
            .split('\n')
            .filter(line => {
                // Remove WEBVTT header, timestamps, and empty lines
                return line.trim() 
                    && !line.includes('WEBVTT') 
                    && !line.includes('-->') 
                    && !line.match(/^\d{2}:\d{2}:\d{2}/);
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Parse SRT subtitle format to plain text
    private parseSRT(srtContent: string): string {
        return srtContent
            .split('\n')
            .filter(line => {
                // Remove sequence numbers, timestamps, and empty lines
                return line.trim() 
                    && !line.match(/^\d+$/)
                    && !line.includes('-->');
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Download subtitle content from URL
    private async downloadSubtitleContent(url: string): Promise<string> {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            let content = await response.text();
            
            // If we got an M3U playlist, extract and fetch the actual subtitle URLs
            if (content.includes('#EXTM3U') || content.includes('#EXT-X')) {
                console.log('Got M3U playlist, extracting URLs');
                const lines = content.split('\n');
                const subtitleUrls = lines.filter(line => 
                    line.startsWith('http') && (line.includes('fmt=vtt') || line.includes('fmt=json'))
                );
                
                if (subtitleUrls.length > 0) {
                    console.log('Found subtitle URL:', subtitleUrls[0]);
                    const response2 = await fetch(subtitleUrls[0]);
                    if (!response2.ok) throw new Error(`HTTP ${response2.status}`);
                    content = await response2.text();
                }
            }
            
            return content;
        } catch (error) {
            console.error('Error downloading subtitle:', error);
            return '';
        }
    }

    // Add a method to download the transcript of a YouTube video
    // different types of transcripts may come up

    async downloadTranscript(url: string): Promise<string> {
        try {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subtitles-'));
            const subtitlePath = path.join(tempDir, '%(title)s.%(ext)s');

            const result = await youtubedl(url, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                skipDownload: true,
                addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
                writeSub: true,
                subLang: 'en',
                subFormat: 'json3',
                output: subtitlePath,
            } as any);

            console.log('Full YouTube result keys:', Object.keys(result));
            console.log('YouTube info result:', JSON.stringify(result, null, 2));

            let transcriptText = '';

            // Try multiple approaches to get subtitles
            
            // Approach 1: Check automatic_captions first (often more reliable)
            if (result.automatic_captions && (result.automatic_captions as any).en) {
                console.log('Found automatic captions');
                const captions = (result.automatic_captions as any).en;
                if (Array.isArray(captions) && captions.length > 0) {
                    const caption = captions[0];
                    console.log('Caption format:', caption);
                    
                    if (caption.url) {
                        const content = await this.downloadSubtitleContent(caption.url);
                        console.log('Downloaded content type:', typeof content, 'length:', content.length);
                        console.log('Content preview:', content.substring(0, 500));
                        
                        if (content.includes('utf8') && content.includes('segs')) {
                            transcriptText = this.parseYouTubeJSON(content);
                        } else if (content.includes('WEBVTT')) {
                            transcriptText = this.parseVTT(content);
                        } else {
                            transcriptText = this.parseSRT(content);
                        }
                    }
                }
            }

            // Approach 2: Check regular subtitles
            if (!transcriptText && result.subtitles && (result.subtitles as SubtitleInfo).en) {
                console.log('Found regular subtitles');
                const enSubs = (result.subtitles as SubtitleInfo).en;
                if (enSubs && enSubs.length > 0) {
                    const subtitle = enSubs[0];
                    console.log('Subtitle format:', subtitle);
                    
                    // If subtitle has a URL, download it
                    if (subtitle.url) {
                        const content = await this.downloadSubtitleContent(subtitle.url);
                        console.log('Downloaded content type:', typeof content, 'length:', content.length);
                        console.log('Content preview:', content.substring(0, 500));
                        
                        if (content.includes('utf8') && content.includes('segs')) {
                            transcriptText = this.parseYouTubeJSON(content);
                        } else if (content.includes('WEBVTT')) {
                            transcriptText = this.parseVTT(content);
                        } else {
                            transcriptText = this.parseSRT(content);
                        }
                    }
                    // If subtitle has data directly
                    else if (subtitle.data) {
                        if (subtitle.data.includes('utf8') && subtitle.data.includes('segs')) {
                            transcriptText = this.parseYouTubeJSON(subtitle.data);
                        } else if (subtitle.data.includes('WEBVTT')) {
                            transcriptText = this.parseVTT(subtitle.data);
                        } else {
                            transcriptText = this.parseSRT(subtitle.data);
                        }
                    }
                }
            }

            // Approach 3: Check for downloaded subtitle files in temp directory
            if (!transcriptText) {
                console.log('Checking temp directory for files');
                const files = fs.readdirSync(tempDir);
                console.log('Files in temp dir:', files);
                
                const subtitleFile = files.find(f => f.endsWith('.vtt') || f.endsWith('.srt') || f.endsWith('.json'));
                
                if (subtitleFile) {
                    const filePath = path.join(tempDir, subtitleFile);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    console.log(`Found subtitle file: ${subtitleFile}, size: ${content.length}`);
                    console.log('Content preview:', content.substring(0, 500));
                    
                    if (subtitleFile.endsWith('.json') || (content.includes('utf8') && content.includes('segs'))) {
                        transcriptText = this.parseYouTubeJSON(content);
                    } else if (subtitleFile.endsWith('.vtt') || content.includes('WEBVTT')) {
                        transcriptText = this.parseVTT(content);
                    } else if (subtitleFile.endsWith('.srt')) {
                        transcriptText = this.parseSRT(content);
                    }
                }
            }

            // Cleanup temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });

            if (!transcriptText) {
                throw new Error('No subtitles found - checked automatic_captions, subtitles object, and temp files');
            }

            return transcriptText;
        } catch (error) {
            console.error('error:', error);
            throw new Error(`Failed to download transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

}