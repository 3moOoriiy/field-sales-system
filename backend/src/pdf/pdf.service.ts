import {
  Injectable, Logger, OnModuleInit, OnModuleDestroy, InternalServerErrorException,
} from '@nestjs/common';
import puppeteer, { Browser, PaperFormat } from 'puppeteer-core';
import { existsSync } from 'fs';
import { platform } from 'os';

export interface PdfOptions {
  /** Standard paper format. Mutually exclusive with width/height. */
  format?: PaperFormat;
  /** CSS units, e.g. "58mm". */
  width?: string;
  height?: string;
  /** Margins in CSS units. */
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
}

/**
 * Singleton wrapper around Puppeteer.
 *
 *  - Launches one Chromium instance for the process lifetime
 *  - One short-lived `Page` per render (cheap; avoids cross-render leaks)
 *  - Auto-restarts if the browser crashes
 */
@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  async onModuleInit() {
    // Lazy-launch on first request — keeps boot fast
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    if (this.launching) return this.launching;

    this.launching = (async () => {
      const executablePath = this.findBrowserExecutable();
      if (!executablePath) {
        throw new Error(
          'No Chromium/Chrome/Edge binary found. Set PUPPETEER_EXECUTABLE_PATH in .env to override.',
        );
      }
      this.logger.log(`Launching browser at ${executablePath}`);
      const b = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=medium',
          '--lang=ar',
        ],
      });
      b.on('disconnected', () => {
        this.logger.warn('Chromium disconnected');
        this.browser = null;
      });
      this.browser = b;
      return b;
    })();
    try {
      return await this.launching;
    } finally {
      this.launching = null;
    }
  }

  /**
   * Locate a Chromium-family browser binary across Linux / macOS / Windows.
   * Honours PUPPETEER_EXECUTABLE_PATH first; otherwise tries common install paths.
   */
  private findBrowserExecutable(): string | null {
    const env = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (env && existsSync(env)) return env;

    const candidates: string[] = [];
    const os = platform();
    if (os === 'win32') {
      candidates.push(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
      );
      const localApp = process.env.LOCALAPPDATA;
      if (localApp) {
        candidates.push(
          `${localApp}\\Google\\Chrome\\Application\\chrome.exe`,
          `${localApp}\\Microsoft\\Edge\\Application\\msedge.exe`,
        );
      }
    } else if (os === 'darwin') {
      candidates.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      );
    } else {
      candidates.push(
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
      );
    }

    for (const p of candidates) if (existsSync(p)) return p;
    return null;
  }

  async htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
    let page;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await page.emulateMediaType('print');
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
      // Wait for web fonts (Cairo/Noto) to load
      await page.evaluate(async () => { await (document as Document).fonts?.ready; });

      const pdfData = await page.pdf({
        format: opts.format,
        width: opts.width,
        height: opts.height,
        margin: opts.margin,
        printBackground: opts.printBackground ?? true,
        preferCSSPageSize: opts.preferCSSPageSize ?? false,
      });
      return Buffer.from(pdfData);
    } catch (err) {
      this.logger.error(`PDF render failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('PDF render failed');
    } finally {
      if (page) await page.close().catch(() => undefined);
    }
  }
}
