/**
 * Performance monitoring utilities for Team Auth module
 * Provides consistent performance measurement and logging across auth components
 */

interface PerformanceMetric {
  name: string
  duration: number
  startTime: number
  endTime: number
  category: 'component' | 'network' | 'database' | 'auth' | 'general'
  metadata?: Record<string, any>
}

interface PerformanceLogger {
  start: (name: string, category?: PerformanceMetric['category'], metadata?: Record<string, any>) => void
  end: (name: string) => PerformanceMetric | null
  measure: (name: string, startMark?: string, endMark?: string) => PerformanceMetric | null
  log: (metric: PerformanceMetric) => void
  getMetrics: () => PerformanceMetric[]
  clear: () => void
  group: (name: string, fn: () => void | Promise<void>) => Promise<void>
}

// Store for tracking performance metrics
const performanceStore = {
  metrics: [] as PerformanceMetric[],
  startTimes: new Map<string, { time: number, category: PerformanceMetric['category'], metadata?: Record<string, any> }>(),
}

// Check if performance API is available
const hasPerformanceAPI = () => {
  return typeof performance !== 'undefined' && 
         typeof performance.mark === 'function' && 
         typeof performance.measure === 'function'
}

// Get current high-resolution time
const now = (): number => {
  if (hasPerformanceAPI()) {
    return performance.now()
  }
  return Date.now()
}

// Create a performance mark with consistent naming
const createMark = (name: string, suffix: 'start' | 'end' = 'start'): string => {
  const markName = `team-auth:${name}:${suffix}`
  
  if (hasPerformanceAPI()) {
    try {
      performance.mark(markName)
    } catch (error) {
      console.warn('Failed to create performance mark:', markName, error)
    }
  }
  
  return markName
}

// Get measurement from performance API
const getMeasurement = (name: string, startMark?: string, endMark?: string): number => {
  if (!hasPerformanceAPI()) {
    return 0
  }

  try {
    const measureName = `team-auth:${name}:measure`
    
    if (startMark && endMark) {
      performance.measure(measureName, startMark, endMark)
    } else {
      const autoStartMark = `team-auth:${name}:start`
      const autoEndMark = `team-auth:${name}:end`
      performance.measure(measureName, autoStartMark, autoEndMark)
    }
    
    const entries = performance.getEntriesByName(measureName, 'measure')
    if (entries.length > 0) {
      const entry = entries[entries.length - 1] // Get the most recent measurement
      return entry.duration
    }
  } catch (error) {
    console.warn('Failed to get performance measurement:', name, error)
  }
  
  return 0
}

// Format duration for display
const formatDuration = (duration: number): string => {
  if (duration < 1) {
    return `${duration.toFixed(2)}ms`
  } else if (duration < 1000) {
    return `${Math.round(duration)}ms`
  } else {
    return `${(duration / 1000).toFixed(2)}s`
  }
}

// Create performance logger instance
export const createPerformanceLogger = (debugMode: boolean = false): PerformanceLogger => {
  const shouldLog = debugMode && (import.meta.client || import.meta.dev)

  return {
    start: (name: string, category: PerformanceMetric['category'] = 'general', metadata?: Record<string, any>) => {
      const startTime = now()
      performanceStore.startTimes.set(name, { time: startTime, category, metadata })
      createMark(name, 'start')
      
      if (shouldLog) {
        console.log(`🚀 [Team Auth Performance] Starting: ${name}`, metadata || '')
      }
    },

    end: (name: string): PerformanceMetric | null => {
      const endTime = now()
      const startData = performanceStore.startTimes.get(name)
      
      if (!startData) {
        if (shouldLog) {
          console.warn(`⚠️ [Team Auth Performance] No start time found for: ${name}`)
        }
        return null
      }

      createMark(name, 'end')
      const duration = endTime - startData.time
      
      const metric: PerformanceMetric = {
        name,
        duration,
        startTime: startData.time,
        endTime,
        category: startData.category,
        metadata: startData.metadata,
      }

      performanceStore.metrics.push(metric)
      performanceStore.startTimes.delete(name)

      if (shouldLog) {
        const color = duration > 1000 ? '🔴' : duration > 500 ? '🟡' : '🟢'
        console.log(`${color} [Team Auth Performance] Completed: ${name} - ${formatDuration(duration)}`, metric.metadata || '')
      }

      return metric
    },

    measure: (name: string, startMark?: string, endMark?: string): PerformanceMetric | null => {
      const duration = getMeasurement(name, startMark, endMark)
      
      if (duration === 0) {
        return null
      }

      const metric: PerformanceMetric = {
        name,
        duration,
        startTime: now() - duration,
        endTime: now(),
        category: 'general',
      }

      performanceStore.metrics.push(metric)

      if (shouldLog) {
        const color = duration > 1000 ? '🔴' : duration > 500 ? '🟡' : '🟢'
        console.log(`${color} [Team Auth Performance] Measured: ${name} - ${formatDuration(duration)}`)
      }

      return metric
    },

    log: (metric: PerformanceMetric) => {
      if (shouldLog) {
        const color = metric.duration > 1000 ? '🔴' : metric.duration > 500 ? '🟡' : '🟢'
        console.log(`${color} [Team Auth Performance] ${metric.category}: ${metric.name} - ${formatDuration(metric.duration)}`, metric.metadata || '')
      }
    },

    getMetrics: () => [...performanceStore.metrics],

    clear: () => {
      performanceStore.metrics.length = 0
      performanceStore.startTimes.clear()
      
      if (hasPerformanceAPI()) {
        try {
          // Clear performance marks and measures
          const entries = performance.getEntriesByType('mark').concat(performance.getEntriesByType('measure'))
          entries.forEach(entry => {
            if (entry.name.startsWith('team-auth:')) {
              performance.clearMarks(entry.name)
              performance.clearMeasures(entry.name)
            }
          })
        } catch (error) {
          console.warn('Failed to clear performance entries:', error)
        }
      }

      if (shouldLog) {
        console.log('🧹 [Team Auth Performance] Cleared all metrics')
      }
    },

    group: async (name: string, fn: () => void | Promise<void>) => {
      if (shouldLog) {
        console.group(`📊 [Team Auth Performance] ${name}`)
      }

      const startTime = now()
      createMark(name, 'start')

      try {
        await fn()
      } finally {
        createMark(name, 'end')
        const duration = now() - startTime
        
        const metric: PerformanceMetric = {
          name,
          duration,
          startTime,
          endTime: now(),
          category: 'general',
        }

        performanceStore.metrics.push(metric)

        if (shouldLog) {
          const color = duration > 1000 ? '🔴' : duration > 500 ? '🟡' : '🟢'
          console.log(`${color} Group completed in ${formatDuration(duration)}`)
          console.groupEnd()
        }
      }
    },
  }
}

// Performance decorators for composables and functions
export const withPerformanceLogging = <T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  category: PerformanceMetric['category'] = 'general',
  logger?: PerformanceLogger
): T => {
  return ((...args: any[]) => {
    const perfLogger = logger || createPerformanceLogger(true)
    
    perfLogger.start(name, category, { argsCount: args.length })
    
    try {
      const result = fn(...args)
      
      // Handle async functions
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          perfLogger.end(name)
        })
      } else {
        perfLogger.end(name)
        return result
      }
    } catch (error) {
      perfLogger.end(name)
      throw error
    }
  }) as T
}

// Create global performance logger instance
let globalLogger: PerformanceLogger | null = null

export const getGlobalPerformanceLogger = (): PerformanceLogger => {
  if (!globalLogger) {
    // Get debug mode from runtime config if available
    const debugMode = import.meta.client && 
                     window.__NUXT__?.config?.public?.teamAuth?.debug || 
                     import.meta.dev
    globalLogger = createPerformanceLogger(debugMode)
  }
  return globalLogger
}

// Convenience exports
export const perf = getGlobalPerformanceLogger()

// Performance timing helpers for common patterns
export const timeAsync = async <T>(
  name: string,
  asyncFn: () => Promise<T>,
  category: PerformanceMetric['category'] = 'general',
  metadata?: Record<string, any>
): Promise<T> => {
  const logger = getGlobalPerformanceLogger()
  logger.start(name, category, metadata)
  
  try {
    const result = await asyncFn()
    return result
  } finally {
    logger.end(name)
  }
}

export const timeSync = <T>(
  name: string,
  syncFn: () => T,
  category: PerformanceMetric['category'] = 'general',
  metadata?: Record<string, any>
): T => {
  const logger = getGlobalPerformanceLogger()
  logger.start(name, category, metadata)
  
  try {
    return syncFn()
  } finally {
    logger.end(name)
  }
}

// Export types
export type { PerformanceMetric, PerformanceLogger }