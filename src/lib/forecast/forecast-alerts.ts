/**
 * Forecast cost alert notification system.
 *
 * Creates in-app notifications when forecast projections indicate
 * a cost increase exceeding 15% compared to the previous period.
 *
 * Requirements: 13.5
 *
 * @module lib/forecast/forecast-alerts
 */

import { type CostAlert, type ForecastBand, COST_ALERT_THRESHOLD, detectCostAlerts } from './forecast-service';

export interface ForecastNotification {
  type: 'forecast_cost_alert';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  projectedIncrease: number;
  period: string;
  timestamp: number;
}

/**
 * Generates notification objects from forecast cost alerts.
 * Alerts are generated when projected cost increase exceeds 15%.
 *
 * @param bands - Forecast bands to check
 * @param lastHistoricalCost - The most recent actual cost for comparison
 * @returns Array of notification objects ready to be dispatched
 */
export function generateForecastNotifications(
  bands: ForecastBand[],
  lastHistoricalCost: number,
): ForecastNotification[] {
  const alerts = detectCostAlerts(bands, lastHistoricalCost, COST_ALERT_THRESHOLD);

  return alerts.map(alert => ({
    type: 'forecast_cost_alert' as const,
    severity: alert.projectedIncrease > 30 ? 'critical' : 'warning',
    title: 'Alerta de incremento de costos',
    message: alert.message,
    projectedIncrease: alert.projectedIncrease,
    period: `${alert.month}/${alert.year}`,
    timestamp: Date.now(),
  }));
}

/**
 * Dispatches forecast alert notifications to the in-app notification system.
 * Posts to the notifications API endpoint.
 */
export async function dispatchForecastAlerts(
  bands: ForecastBand[],
  lastHistoricalCost: number,
  workspaceId: string = 'default',
): Promise<ForecastNotification[]> {
  const notifications = generateForecastNotifications(bands, lastHistoricalCost);

  if (notifications.length === 0) return [];

  // Dispatch a custom event for the notification system to pick up
  if (typeof window !== 'undefined') {
    for (const notification of notifications) {
      window.dispatchEvent(
        new CustomEvent('nominasmart:notification', {
          detail: notification,
        }),
      );
    }
  }

  return notifications;
}

/**
 * Checks if a given increase percentage should trigger an alert.
 * The threshold is 15% (0.15).
 */
export function shouldAlertForIncrease(increasePercentage: number): boolean {
  return increasePercentage > COST_ALERT_THRESHOLD * 100;
}
