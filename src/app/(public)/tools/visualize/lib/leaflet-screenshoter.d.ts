declare module "leaflet-simple-map-screenshoter" {
  import type L from "leaflet"
  export class SimpleMapScreenshoter extends L.Control {
    constructor(options?: { hidden?: boolean })
    addTo(map: L.Map): this
    takeScreen(format?: string): Promise<Blob>
  }
}
