/**
 * Decoupled Analytics Service for Cable Manager
 * Handles Google Analytics 4 (GA4) event tracking safely and cleanly.
 */

class AnalyticsService {
  private measurementId: string = 'G-2312BHVNX3';
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('ga_measurement_id');
      const savedEnabled = localStorage.getItem('analytics_enabled');
      this.measurementId = (savedId && savedId.trim()) ? savedId.trim() : 'G-2312BHVNX3';
      this.enabled = savedEnabled !== 'false'; // Default to true unless explicitly 'false'
    }
  }

  public initAnalytics(measurementId: string): void {
    if (typeof window === 'undefined') return;
    this.measurementId = measurementId.trim() || 'G-2312BHVNX3';
    localStorage.setItem('ga_measurement_id', this.measurementId);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('analytics_enabled', String(enabled));
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getMeasurementId(): string {
    return this.measurementId;
  }

  public setMeasurementId(id: string): void {
    this.measurementId = id.trim() || 'G-2312BHVNX3';
    localStorage.setItem('ga_measurement_id', this.measurementId);
  }

  /**
   * Tracks a Screen / Page View (Tab Switch)
   */
  public trackPageView(pageName: string): void {
    if (!this.enabled || typeof window === 'undefined') return;

    try {
      if (typeof (window as any).gtag === 'function') {
        (window as any).gtag('config', this.measurementId, {
          page_path: `/${pageName}`,
          page_title: pageName,
          debug_mode: true
        });
        (window as any).gtag('event', 'page_view', {
          send_to: this.measurementId,
          page_title: pageName,
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
    if (!this.enabled || typeof window === 'undefined') return;

    try {
      if (typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', eventName, {
          send_to: this.measurementId,
          ...params
        });
        console.log(`[Analytics Event] ${eventName}`, params);
      }
    } catch (err) {
      console.warn(`[Analytics] trackEvent (${eventName}) failed:`, err);
    }
  }
}

export const analytics = new AnalyticsService();
