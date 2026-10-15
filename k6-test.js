import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const baseURL = __ENV.BASE_URL || 'http://localhost:5000';
const apiKey = __ENV.API_KEY || '';

const httpRequestDuration = new Trend('http_req_duration_custom');
const dbQueryCounter = new Counter('db_queries_executed');
const errors = new Counter('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  
    { duration: '1m', target: 50 },   
    { duration: '1m', target: 100 }, 
    { duration: '30s', target: 0 },  
  ],
  thresholds: {
    'http_req_duration_custom': ['p(95)<500'],  
    'http_req_failed': ['rate<0.05'],
    'errors': ['count<10'],
  },
  tags: {
    test_type: 'db_query_optimization',
  },
};

const endpoints = [
  { method: 'GET', url: '/api/packages?publishedOnly=true' },
  { method: 'GET', url: '/api/public/hotels' },
  { method: 'GET', url: '/api/public/destinations' },
];

export default function () {
  group('Public Endpoints - No Auth Required', function () {
    endpoints.forEach((endpoint) => {
      const res = http.request(endpoint.method, baseURL + endpoint.url);

      const ok = check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 300ms': (r) => r.timings.duration < 300,
        'no server error': (r) => r.status < 500,
      });

      httpRequestDuration.add(res.timings.duration, { endpoint: endpoint.url });
      if (!ok) errors.add(1);
    });
  });

  group('Package Search - Optimized Index Usage', function () {
    const searchRes = http.get(baseURL + '/api/packages?publishedOnly=true&search=' + encodeURIComponent('Manali'));

    check(searchRes, {
      'search returns 200': (r) => r.status === 200,
      'packages found': (r) => {
        try {
          const json = r.json();
          return json.packages && json.packages.length > 0;
        } catch (e) {
          return false;
        }
      },
      'search response < 400ms': (r) => r.timings.duration < 400,
    });

    httpRequestDuration.add(searchRes.timings.duration, { endpoint: 'package_search' });
  });

  group('Hotel Search - Batch Room Fetch (N+1 Fixed)', function () {
    const hotelRes = http.get(baseURL + '/api/public/hotels?search=' + encodeURIComponent('Grand'));

    check(hotelRes, {
      'hotels returns 200': (r) => r.status === 200,
      'response < 500ms': (r) => r.timings.duration < 500,
    });

    httpRequestDuration.add(hotelRes.timings.duration, { endpoint: 'hotel_search' });
  });

  dbQueryCounter.add(1);

  sleep(1);
}
