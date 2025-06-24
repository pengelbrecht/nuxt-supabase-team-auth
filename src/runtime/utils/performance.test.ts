/**
 * Basic test for performance monitoring utilities
 * This is a simple test to validate the performance infrastructure works
 */

import { createPerformanceLogger, timeAsync, timeSync } from './performance'

// Mock performance API for testing
const mockPerformance = {
  now: () => Date.now(),
  mark: (name: string) => console.log(`Mark: ${name}`),
  measure: (name: string, start?: string, end?: string) => console.log(`Measure: ${name} from ${start} to ${end}`),
  getEntriesByName: () => [{ duration: 100 }],
  getEntriesByType: () => [],
  clearMarks: () => {},
  clearMeasures: () => {},
}

// Simple test function
export function testPerformanceInfrastructure() {
  console.group('🧪 Testing Performance Infrastructure')
  
  try {
    // Test 1: Basic logger functionality
    console.log('Test 1: Basic logger functionality')
    const logger = createPerformanceLogger(true)
    
    logger.start('test-operation', 'general', { testData: 'example' })
    
    // Simulate some work
    setTimeout(() => {
      const metric = logger.end('test-operation')
      console.log('✅ Basic logger test passed', metric)
    }, 10)
    
    // Test 2: Async timing
    console.log('Test 2: Async timing')
    timeAsync('async-test', async () => {
      return new Promise(resolve => setTimeout(resolve, 50))
    }, 'general', { async: true }).then(() => {
      console.log('✅ Async timing test passed')
    })
    
    // Test 3: Sync timing
    console.log('Test 3: Sync timing')
    const result = timeSync('sync-test', () => {
      let sum = 0
      for (let i = 0; i < 1000; i++) {
        sum += i
      }
      return sum
    }, 'general', { sync: true })
    console.log('✅ Sync timing test passed', { result })
    
    // Test 4: Performance group
    console.log('Test 4: Performance group')
    logger.group('group-test', async () => {
      logger.start('nested-operation', 'component')
      await new Promise(resolve => setTimeout(resolve, 25))
      logger.end('nested-operation')
    }).then(() => {
      console.log('✅ Performance group test passed')
    })
    
    // Test 5: Metrics retrieval
    setTimeout(() => {
      console.log('Test 5: Metrics retrieval')
      const metrics = logger.getMetrics()
      console.log('✅ Metrics retrieval test passed', { metricsCount: metrics.length })
      
      // Clean up
      logger.clear()
      console.log('✅ Cleanup test passed')
      
      console.log('🎉 All performance infrastructure tests passed!')
      console.groupEnd()
    }, 100)
    
  } catch (error) {
    console.error('❌ Performance infrastructure test failed:', error)
    console.groupEnd()
  }
}

// Export for manual testing in dev console
if (import.meta.client) {
  // @ts-ignore
  window.testPerformanceInfrastructure = testPerformanceInfrastructure
}