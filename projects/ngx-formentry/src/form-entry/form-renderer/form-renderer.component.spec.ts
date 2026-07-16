import { HttpClient } from '@angular/common/http';

import { DataSources } from '../data-sources/data-sources';
import { EndpointDataSource } from '../data-sources/endpoint-data-source';
import { FormRendererComponent } from './form-renderer.component';

// These tests exercise the built-in `endpoint` data source wiring directly on the
// component instance. They avoid a full TestBed so the focus stays on the injection
// contract: HttpClient is optional, and the data source self-registers only when the
// host hasn't already claimed the name `endpoint`.
describe('FormRendererComponent endpoint data source wiring', () => {
  const endpointOptions = {
    endpointUrl: 'https://example.org/ws/rest/v1/provider'
  };

  function createComponent(
    dataSources: DataSources,
    http: HttpClient | null
  ): FormRendererComponent {
    const component = new FormRendererComponent(
      null as any,
      dataSources,
      null as any,
      null as any,
      http as any,
      null as any
    );
    component.node = {
      question: {
        extras: {},
        renderingType: 'remote-select',
        dataSource: 'endpoint',
        dataSourceOptions: endpointOptions
      }
    } as any;
    return component;
  }

  it('registers a built-in endpoint data source when HttpClient is available', () => {
    const dataSources = new DataSources();
    const component = createComponent(dataSources, {} as HttpClient);

    component.setUpRemoteSelect();

    expect(dataSources.dataSources['endpoint']).toEqual(
      jasmine.any(EndpointDataSource)
    );
    expect(component.dataSource).toBe(dataSources.dataSources['endpoint']);
    expect(component.dataSource.dataSourceOptions).toBe(endpointOptions);
  });

  it('does not register (or throw) when HttpClient is not provided', () => {
    const dataSources = new DataSources();
    const component = createComponent(dataSources, null);

    expect(() => component.setUpRemoteSelect()).not.toThrow();
    expect(dataSources.dataSources['endpoint']).toBeUndefined();
    expect(component.dataSource).toBeUndefined();
  });

  it('does not override an endpoint data source the host already registered', () => {
    const dataSources = new DataSources();
    const hostDataSource = {
      searchOptions: () => {},
      resolveSelectedValue: () => {}
    };
    dataSources.registerDataSource('endpoint', hostDataSource);
    const component = createComponent(dataSources, {} as HttpClient);

    component.setUpRemoteSelect();

    expect(dataSources.dataSources['endpoint']).toBe(hostDataSource);
    expect(component.dataSource).toBe(hostDataSource as any);
  });
});
