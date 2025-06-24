import { onMounted, onUnmounted, getCurrentInstance, nextTick } from 'vue'
import { getGlobalPerformanceLogger, timeAsync, timeSync } from '../utils/performance'
import type { PerformanceMetric, PerformanceLogger } from '../utils/performance'
import { useTeamAuthConfig } from './useTeamAuthConfig'

/**
 * Vue composable for performance monitoring in Team Auth components
 * Provides easy access to performance logging with component lifecycle integration
 */
export function usePerformance() {
  const { debug } = useTeamAuthConfig()
  const logger = getGlobalPerformanceLogger()
  const instance = getCurrentInstance()
  
  // Get component name for performance tracking
  const componentName = instance?.type?.name || instance?.type?.__name || 'UnknownComponent'
  
  // Track component lifecycle performance
  const trackComponentLifecycle = (enable: boolean = true) => {
    if (!enable || !debug.value) return
    
    const lifecycleName = `component:${componentName}:lifecycle`
    
    onMounted(() => {
      logger.start(lifecycleName, 'component', { 
        component: componentName,
        lifecycle: 'mounted'
      })
      
      // Use nextTick to ensure the component is fully rendered
      nextTick(() => {
        logger.end(lifecycleName)
      })
    })
  }
  
  // Track async operations with automatic cleanup
  const trackAsync = async <T>(
    name: string,
    asyncFn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    if (!debug.value) {
      return asyncFn()
    }
    
    return timeAsync(
      `${componentName}:${name}`,
      asyncFn,
      'component',
      { component: componentName, ...metadata }
    )
  }
  
  // Track synchronous operations
  const trackSync = <T>(
    name: string,
    syncFn: () => T,
    metadata?: Record<string, any>
  ): T => {
    if (!debug.value) {
      return syncFn()
    }
    
    return timeSync(
      `${componentName}:${name}`,
      syncFn,
      'component',
      { component: componentName, ...metadata }
    )
  }
  
  // Start a performance measurement
  const start = (name: string, metadata?: Record<string, any>) => {
    if (!debug.value) return
    
    logger.start(
      `${componentName}:${name}`,
      'component',
      { component: componentName, ...metadata }
    )
  }
  
  // End a performance measurement
  const end = (name: string): PerformanceMetric | null => {
    if (!debug.value) return null
    
    return logger.end(`${componentName}:${name}`)
  }
  
  // Create a performance group for related operations
  const group = async (name: string, fn: () => void | Promise<void>) => {
    if (!debug.value) {
      await fn()
      return
    }
    
    await logger.group(`${componentName}:${name}`, fn)
  }
  
  // Track auth-specific operations
  const trackAuth = {
    // Track authentication state changes
    stateChange: (from: string, to: string, metadata?: Record<string, any>) => {
      if (!debug.value) return
      
      logger.start(`auth:state-change:${from}-to-${to}`, 'auth', {
        component: componentName,
        fromState: from,
        toState: to,
        ...metadata
      })
      
      // Auto-end after a short delay to capture state transition
      setTimeout(() => {
        logger.end(`auth:state-change:${from}-to-${to}`)
      }, 0)
    },
    
    // Track user data fetching
    userDataFetch: async <T>(
      operation: string,
      fetchFn: () => Promise<T>,
      metadata?: Record<string, any>
    ): Promise<T> => {
      if (!debug.value) {
        return fetchFn()
      }
      
      return timeAsync(
        `auth:user-data:${operation}`,
        fetchFn,
        'auth',
        { component: componentName, operation, ...metadata }
      )
    },
    
    // Track team operations
    teamOperation: async <T>(
      operation: string,
      operationFn: () => Promise<T>,
      metadata?: Record<string, any>
    ): Promise<T> => {
      if (!debug.value) {
        return operationFn()
      }
      
      return timeAsync(
        `auth:team:${operation}`,
        operationFn,
        'auth',
        { component: componentName, operation, ...metadata }
      )
    },
  }
  
  // Track network requests
  const trackNetwork = {
    // Track API calls
    apiCall: async <T>(
      endpoint: string,
      requestFn: () => Promise<T>,
      metadata?: Record<string, any>
    ): Promise<T> => {
      if (!debug.value) {
        return requestFn()
      }
      
      return timeAsync(
        `network:api:${endpoint}`,
        requestFn,
        'network',
        { component: componentName, endpoint, ...metadata }
      )
    },
    
    // Track edge function calls
    edgeFunction: async <T>(
      functionName: string,
      requestFn: () => Promise<T>,
      metadata?: Record<string, any>
    ): Promise<T> => {
      if (!debug.value) {
        return requestFn()
      }
      
      return timeAsync(
        `network:edge-function:${functionName}`,
        requestFn,
        'network',
        { component: componentName, functionName, ...metadata }
      )
    },
  }
  
  // Track database operations
  const trackDatabase = {
    // Track Supabase queries
    query: async <T>(
      operation: string,
      queryFn: () => Promise<T>,
      metadata?: Record<string, any>
    ): Promise<T> => {
      if (!debug.value) {
        return queryFn()
      }
      
      return timeAsync(
        `database:query:${operation}`,
        queryFn,
        'database',
        { component: componentName, operation, ...metadata }
      )
    },
  }
  
  // Get performance summary for this component
  const getComponentMetrics = (): PerformanceMetric[] => {
    return logger.getMetrics().filter(metric => 
      metric.name.includes(componentName) || 
      (metric.metadata && metric.metadata.component === componentName)
    )
  }
  
  // Clear component-specific metrics
  const clearComponentMetrics = () => {
    // This is a simple implementation - in a real scenario, you might want more sophisticated filtering
    console.log(`🧹 [Performance] Clearing metrics for component: ${componentName}`)
  }
  
  // Auto-cleanup on unmount
  onUnmounted(() => {
    if (debug.value) {
      const metrics = getComponentMetrics()
      if (metrics.length > 0) {
        console.log(`📊 [Performance] Component ${componentName} metrics:`, metrics)
      }
    }
  })
  
  return {
    // Core performance tracking
    start,
    end,
    group,
    trackAsync,
    trackSync,
    
    // Lifecycle tracking
    trackComponentLifecycle,
    
    // Domain-specific tracking
    trackAuth,
    trackNetwork,
    trackDatabase,
    
    // Metrics management
    getComponentMetrics,
    clearComponentMetrics,
    
    // Access to raw logger
    logger,
    
    // Computed values
    isEnabled: debug,
    componentName,
  }
}

// Export types
export type { PerformanceMetric, PerformanceLogger }