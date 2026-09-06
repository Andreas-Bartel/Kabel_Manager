/**
 * Decoupled Analytics Service for Cable Manager
 * Handles Google Analytics 4 (GA4) event tracking safely and cleanly.
 */

class AnalyticsService {
  private measurementId: string = '';
  private enabled: boolean = true;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('ga_measurement_id');
      const savedEnabled = localStorage.getItem('analytics_enabled');
      this.measurementId = savedId || import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-2312BHVNX3';
      this.enabled = savedEnabled !== null ? savedEnabled === 'true' : true;

      if (this.measurementId && this.enabled) {
        this.initAnalytics(this.measurementId);
      }
    }
  }

  /**
   * Initializes Google Analytics 4 (gtag.js) dynamically
   */
  public initAnalytics(measurementId: string): void {
    if (!measurementId || typeof window === 'undefined') return;

    this.measurementId = measurementId.trim();
    localStorage.setItem('ga_measurement_id', this.measurementId);

    if (!this.enabled) return;

    // Check if script already injected
    if (document.getElementById('ga-gtag-script')) {
      this.initialized = true;
      return;
    }

    try {
      // 1. Initialize dataLayer and window.gtag using standard function arguments
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).gtag = function () {
        (window as any).dataLayer.push(arguments);
      };

      // 2. Queue initial configuration
      (window as any).gtag('js', new Date());
      (window as any).gtag('config', this.measurementId, {
        send_page_view: true,
        anonymize_ip: true,
        debug_mode: true // Enables real-time debugging in GA4 DebugView
      });

      // 3. Inject Google Analytics gtag.js script
      const script = document.createElement('script');
      script.id = 'ga-gtag-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;

      script.onerror = () => {
        console.warn('[Analytics] Google Analytics script failed to load. An AdBlocker or Privacy Extension might be blocking googletagmanager.com.');
      };

      document.head.appendChild(script);

      this.initialized = true;
      console.log(`[Analytics] Google Analytics initialized with ID: ${this.measurementId}`);
    } catch (err) {
      console.warn('[Analytics] Failed to initialize Google Analytics:', err);
    }
  }

  /**
   * Enable or disable analytics tracking (Opt-In / Opt-Out)
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('analytics_enabled', String(enabled));
    if (enabled && this.measurementId && !this.initialized) {
      this.initAnalytics(this.measurementId);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getMeasurementId(): string {
    return this.measurementId;
  }

  public setMeasurementId(id: string): void {
    this.measurementId = id.trim();
    localStorage.setItem('ga_measurement_id', this.measurementId);
    if (this.measurementId && this.enabled) {
      this.initAnalytics(this.measurementId);
    }
  }

  /**
   * Tracks a Screen / Page View (Tab Switch)
   */
  public trackPageView(pageName: string): void {
    if (!this.enabled || !this.measurementId || typeof window === 'undefined') return;

    try {
      if ((window as any).gtag) {
        (window as any).gtag('event', 'page_view', {
          page_title: pageName,
          page_location: window.location.href,
          page_path: `/${pageName}`
        });
        console.log(`[Analytics Event] page_view: /${pageName}`);
      }
    } catch (err) {
      console.warn('[Analytics] trackPageView failed:', err);
    }
  }

  /**
   * Tracks a custom user interaction event
   */
  public trackEvent(eventName: string, params: Record<string, any> = {}): void {
    if (!this.enabled || !this.measurementId || typeof window === 'undefined') return;

    try {
      if ((window as any).gtag) {
        (window as any).gtag('event', eventName, params);
        console.log(`[Analytics Event] ${eventName}`, params);
      }
    } catch (err) {
      console.warn(`[Analytics] trackEvent (${eventName}) failed:`, err);
    }
  }
}

export const analytics = new AnalyticsService();
