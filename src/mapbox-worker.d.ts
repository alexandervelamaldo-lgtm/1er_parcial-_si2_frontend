declare module 'mapbox-gl/dist/mapbox-gl-csp-worker.js?worker' {
  const MapboxWorker: {
    new (): Worker;
  };

  export default MapboxWorker;
}
