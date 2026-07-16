import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { EndpointDataSource } from './endpoint-data-source';

describe('EndpointDataSource', () => {
  const endpointUrl = 'https://example.org/ws/rest/v1/provider';
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps a results-wrapped response to options via valueKey/labelKey', () => {
    const ds = new EndpointDataSource(http, { endpointUrl });
    let result: any;
    ds.searchOptions('').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === endpointUrl);
    expect(req.request.method).toBe('GET');
    req.flush({
      results: [
        { uuid: '1', display: 'Dr One' },
        { uuid: '2', display: 'Dr Two' }
      ]
    });

    expect(
      result.map((o: any) => ({ value: o.value, label: o.label }))
    ).toEqual([
      { value: '1', label: 'Dr One' },
      { value: '2', label: 'Dr Two' }
    ]);
  });

  it('maps a bare-array response and honors custom keys', () => {
    const ds = new EndpointDataSource(http, {
      endpointUrl,
      valueKey: 'id',
      labelKey: 'name'
    });
    let result: any;
    ds.searchOptions('').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === endpointUrl);
    req.flush([
      { id: 10, name: 'Alice' },
      { id: 20, name: 'Bob' }
    ]);

    expect(
      result.map((o: any) => ({ value: o.value, label: o.label }))
    ).toEqual([
      { value: 10, label: 'Alice' },
      { value: 20, label: 'Bob' }
    ]);
  });

  it('appends the search term and paging params to the request', () => {
    const ds = new EndpointDataSource(http, {
      endpointUrl,
      searchParam: 'q',
      limit: 20
    });
    ds.searchOptions('john').subscribe();

    const req = httpMock.expectOne((r) => r.url === endpointUrl);
    expect(req.request.params.get('q')).toBe('john');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({ results: [] });
  });

  it('does not send the search param for the initial (empty) load', () => {
    const ds = new EndpointDataSource(http, { endpointUrl });
    ds.searchOptions('').subscribe();

    const req = httpMock.expectOne((r) => r.url === endpointUrl);
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ results: [] });
  });

  it('sends a default limit of 20 when none is configured', () => {
    const ds = new EndpointDataSource(http, { endpointUrl });
    ds.searchOptions('john').subscribe();

    const req = httpMock.expectOne((r) => r.url === endpointUrl);
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({ results: [] });
  });

  it('emits an empty array (not an error) for a successful search with no matches', () => {
    const ds = new EndpointDataSource(http, { endpointUrl });
    let nextResult: any;
    let errored = false;
    ds.searchOptions('nobody').subscribe({
      next: (r) => (nextResult = r),
      error: () => (errored = true)
    });

    const req = httpMock.expectOne((r) => r.url === endpointUrl);
    req.flush({ results: [] });

    expect(errored).toBe(false);
    expect(nextResult).toEqual([]);
  });

  it('resolves a saved value to a single option (saved-value resolution)', () => {
    const ds = new EndpointDataSource(http, {
      endpointUrl,
      valueKey: 'uuid',
      labelKey: 'display'
    });
    let result: any;
    ds.resolveSelectedValue('abc-123').subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${endpointUrl}/abc-123`);
    expect(req.request.method).toBe('GET');
    req.flush({ uuid: 'abc-123', display: 'Dr Saved' });

    expect({ value: result.value, label: result.label }).toEqual({
      value: 'abc-123',
      label: 'Dr Saved'
    });
  });

  it('propagates the error when a search request fails (distinct from an empty result)', () => {
    const ds = new EndpointDataSource(http, { endpointUrl });
    let nextResult: any;
    let errorResponse: any;
    ds.searchOptions('').subscribe({
      next: (r) => (nextResult = r),
      error: (e) => (errorResponse = e)
    });

    const req = httpMock.expectOne((r) => r.url === endpointUrl);
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    expect(nextResult).toBeUndefined();
    expect(errorResponse).toBeDefined();
    expect(errorResponse.status).toBe(500);
  });

  it('URL-encodes the saved value when resolving it', () => {
    const ds = new EndpointDataSource(http, { endpointUrl });
    let result: any;
    ds.resolveSelectedValue('a/b c&d').subscribe((r) => (result = r));

    const req = httpMock.expectOne(
      (r) => r.url === `${endpointUrl}/a%2Fb%20c%26d`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ uuid: 'a/b c&d', display: 'Weird Id' });

    expect({ value: result.value, label: result.label }).toEqual({
      value: 'a/b c&d',
      label: 'Weird Id'
    });
  });

  it('resolves a saved value through a resolveUrlTemplate, encoding the value', () => {
    const ds = new EndpointDataSource(http, {
      endpointUrl,
      resolveUrlTemplate: `${endpointUrl}/lookup/{value}`
    });
    let result: any;
    ds.resolveSelectedValue('a b').subscribe((r) => (result = r));

    const req = httpMock.expectOne(
      (r) => r.url === `${endpointUrl}/lookup/a%20b`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ uuid: 'a b', display: 'Templated' });

    expect({ value: result.value, label: result.label }).toEqual({
      value: 'a b',
      label: 'Templated'
    });
  });

  it('resolves to undefined without a request for an empty saved value', () => {
    const ds = new EndpointDataSource(http, { endpointUrl });
    let called = false;
    let result: any = 'sentinel';
    ds.resolveSelectedValue('').subscribe((r) => {
      called = true;
      result = r;
    });

    expect(called).toBe(true);
    expect(result).toBeUndefined();
    httpMock.expectNone(() => true);
  });
});
