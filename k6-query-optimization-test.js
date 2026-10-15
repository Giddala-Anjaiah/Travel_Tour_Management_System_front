import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const baseURL = __ENV.BASE_URL || 'http://localhost:5000';

const endpointLatency = new Trend('endpoint_latency');
const dbQueryDuration = new Trend('db_query_duration');
const errors = new Counter('errors');

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'errors': ['count<50'],
    'checks': ['rate>0.95'],
  },
  tags: { test_run: 'query_optimization_baseline' },
};

export default function () {
  // Test 1: Package listing (indexed query - should be fast)
  group('Packages - Indexed', function () {
    const res = http.get(baseURL + '/api/packages?publishedOnly=true&_t=' + Date.now());
    endpointLatency.add(res.timings.duration, { endpoint: 'packages_indexed' });
    
    check(res, {
      'packages_200': (r) => r.status === 200,
    }) || errors.add(1);
  });

  // Test 2: Package search (uses text search - moderate)
  group('Package Search', function () {
    const res = http.get(baseURL + '/api/packages?publishedOnly=true&search=goa&_t=' + Date.now());
    endpointLatency.add(res.timings.duration, { endpoint: 'package_search' });
    
    check(res, {
      'search_200': (r) => r.status === 200,
    }) || errors.add(1);
  });

  // Test 3: Hotel search (N+1 fixed - single batch query)
  group('Hotel Search - N+1 Fixed', function () {
    const res = http.get(baseURL + '/api/public/hotels?_t=' + Date.now());
    endpointLatency.add(res.timings.duration, { endpoint: 'hotel_search_batch' });
    
    check(res, {
      'hotels_200': (r) => r.status === 200,
    }) || errors.add(1);
  });

  // Test 4: Destinations aggregation (uses $group)
  group('Destinations - Aggregation', function () {
    const res = http.get(baseURL + '/api/public/destinations?_t=' + Date.now());
    endpointLatency.add(res.timings.duration, { endpoint: 'destinations_agg' });
    
    check(res, {
      'destinations_200': (r) => r.status === 200,
    }) || errors.add(1);
  });

  // Test 5: Pagination (tests index on sort fields)
  group('Paginated Packages', function () {
    const res = http.get(baseURL + '/api/packages?page=2&limit=10&_t=' + Date.now());
    endpointLatency.add(res.timings.duration, { endpoint: 'paginated_packages' });
    
    check(res, {
      'paginated_200': (r) => r.status === 200,
    }) || errors.add(1);
  });

  sleep(0.5);
}
