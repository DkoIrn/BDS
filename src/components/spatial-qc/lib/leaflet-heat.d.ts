import 'leaflet'

declare module 'leaflet' {
  interface HeatLayerOptions {
    radius?: number
    blur?: number
    maxZoom?: number
    max?: number
    minOpacity?: number
    gradient?: Record<number, string>
  }

  type HeatLatLngTuple = [number, number, number?]

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: HeatLatLngTuple[]): this
    addLatLng(latlng: HeatLatLngTuple): this
    setOptions(options: HeatLayerOptions): this
    redraw(): this
  }

  function heatLayer(
    latlngs: HeatLatLngTuple[],
    options?: HeatLayerOptions
  ): HeatLayer
}
